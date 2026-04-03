import { NextRequest, NextResponse } from 'next/server'
import { Contract, JsonRpcProvider, Wallet } from 'ethers'
import { factoryAbi, launchAbi } from '@/lib/bondforge/abi'
import { FACTORY_ADDRESS } from '@/lib/bondforge/config'

const DEFAULT_KEEPER_RPC_URL = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'
const COLLECT_GAS_LIMIT = 1_500_000n

function resolveRpcUrl() {
  return process.env.RPC_URL || DEFAULT_KEEPER_RPC_URL
}

function resolveKeeperKey() {
  return process.env.KEEPER_PRIVATE_KEY || process.env.PRIVATE_KEY || ''
}

function isAuthorizedCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET || ''
  if (!secret) {
    return process.env.NODE_ENV !== 'production'
  }
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!FACTORY_ADDRESS) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_FACTORY_ADDRESS is not configured' }, { status: 500 })
    }

    const keeperKey = resolveKeeperKey()
    if (!keeperKey) {
      return NextResponse.json({ error: 'KEEPER_PRIVATE_KEY is not configured' }, { status: 500 })
    }

    const provider = new JsonRpcProvider(resolveRpcUrl())
    const keeper = new Wallet(keeperKey, provider)
    const factory = new Contract(FACTORY_ADDRESS, factoryAbi, keeper)
    const launches = (await factory.getLaunches()) as string[]

    const summary = {
      scanned: launches.length,
      collected: 0,
      empty: 0,
      skippedUnfinalized: 0,
      skippedLegacy: 0,
      failed: 0,
      txs: [] as { launchAddress: string; txHash: string }[],
      failures: [] as { launchAddress: string; error: string }[],
    }

    for (const launchAddress of launches) {
      const launch = new Contract(launchAddress, launchAbi, keeper)
      try {
        const finalized = await launch.finalized() as boolean
        if (!finalized) {
          summary.skippedUnfinalized += 1
          continue
        }

        let preview: readonly [bigint, bigint]
        try {
          preview = await launch.collectPoolFees.staticCall()
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (message.includes('position missing')) {
            summary.skippedLegacy += 1
            continue
          }
          throw error
        }

        const tokenAmount = BigInt(preview[0].toString())
        const nativeAmount = BigInt(preview[1].toString())
        if (tokenAmount === 0n && nativeAmount === 0n) {
          summary.empty += 1
          continue
        }

        const tx = await launch.collectPoolFees({ gasLimit: COLLECT_GAS_LIMIT })
        await tx.wait()
        summary.collected += 1
        summary.txs.push({ launchAddress, txHash: tx.hash })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'collect failed'
        summary.failed += 1
        summary.failures.push({ launchAddress, error: message })
      }
    }

    return NextResponse.json({
      ok: true,
      keeper: keeper.address,
      summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'cron collect failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
