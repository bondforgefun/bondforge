import { NextRequest, NextResponse } from 'next/server'
import { Contract, JsonRpcProvider, Wallet } from 'ethers'
import { launchAbi } from '@/lib/bondforge/abi'

const DEFAULT_KEEPER_RPC_URL = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'
const FINALIZE_GAS_LIMIT = 10_000_000n

function resolveRpcUrl() {
  return process.env.RPC_URL || DEFAULT_KEEPER_RPC_URL
}

function resolveKeeperKey() {
  return process.env.KEEPER_PRIVATE_KEY || process.env.PRIVATE_KEY || ''
}

export async function POST(_request: NextRequest, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params
    if (!address) {
      return NextResponse.json({ error: 'Missing launch address' }, { status: 400 })
    }

    const keeperKey = resolveKeeperKey()
    if (!keeperKey) {
      return NextResponse.json({ error: 'KEEPER_PRIVATE_KEY is not configured' }, { status: 500 })
    }

    const provider = new JsonRpcProvider(resolveRpcUrl())
    const keeper = new Wallet(keeperKey, provider)
    const launch = new Contract(address, launchAbi, keeper)

    const [sold, supply, finalized] = await Promise.all([
      launch.totalSold() as Promise<bigint>,
      launch.nftSupply() as Promise<bigint>,
      launch.finalized() as Promise<boolean>,
    ])

    if (finalized) {
      return NextResponse.json({ finalizedNow: false, alreadyFinalized: true, soldOut: sold >= supply })
    }

    if (sold < supply) {
      return NextResponse.json({ finalizedNow: false, alreadyFinalized: false, soldOut: false })
    }

    const tx = await launch.finalizeLaunch({ gasLimit: FINALIZE_GAS_LIMIT })
    await tx.wait()

    return NextResponse.json({
      finalizedNow: true,
      alreadyFinalized: false,
      soldOut: true,
      txHash: tx.hash,
      keeper: keeper.address,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Keeper finalize failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
