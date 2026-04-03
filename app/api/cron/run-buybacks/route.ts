import { NextRequest, NextResponse } from 'next/server'
import { Contract, JsonRpcProvider, Wallet } from 'ethers'
import { factoryAbi, launchAbi, nftBuybackVaultAbi, tokenBuybackVaultAbi } from '@/lib/bondforge/abi'
import { FACTORY_ADDRESS } from '@/lib/bondforge/config'

const DEFAULT_KEEPER_RPC_URL = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'
const NFT_BUYBACK_GAS_LIMIT = 1_800_000n
const TOKEN_BUYBACK_GAS_LIMIT = 1_500_000n

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
      skippedUnfinalized: 0,
      nftExecuted: 0,
      tokenExecuted: 0,
      idle: 0,
      failed: 0,
      nftTxs: [] as { launchAddress: string; txHash: string }[],
      tokenTxs: [] as { launchAddress: string; txHash: string }[],
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

        const [nftVaultAddress, tokenVaultAddress] = await Promise.all([
          launch.buybackNftVault() as Promise<string>,
          launch.buybackTokenVault() as Promise<string>,
        ])

        let executedThisLaunch = false

        const nftVault = new Contract(nftVaultAddress, nftBuybackVaultAbi, keeper)
        const nftPreview = await nftVault.canExecuteBuyback().catch(() => null)
        if (nftPreview && Boolean(nftPreview[0])) {
          const tx = await nftVault.executeBuyback({ gasLimit: NFT_BUYBACK_GAS_LIMIT })
          await tx.wait()
          summary.nftExecuted += 1
          summary.nftTxs.push({ launchAddress, txHash: tx.hash })
          executedThisLaunch = true
        }

        const tokenVault = new Contract(tokenVaultAddress, tokenBuybackVaultAbi, keeper)
        const tokenPreview = await tokenVault.canExecuteBuyback().catch(() => null)
        if (tokenPreview && Boolean(tokenPreview[0])) {
          const tx = await tokenVault.executeBuyback(0, { gasLimit: TOKEN_BUYBACK_GAS_LIMIT })
          await tx.wait()
          summary.tokenExecuted += 1
          summary.tokenTxs.push({ launchAddress, txHash: tx.hash })
          executedThisLaunch = true
        }

        if (!executedThisLaunch) {
          summary.idle += 1
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'buyback failed'
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
    const message = error instanceof Error ? error.message : 'cron buyback failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
