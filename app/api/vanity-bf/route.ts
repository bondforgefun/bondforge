import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { Contract, ContractFactory, JsonRpcProvider, getCreate2Address, getCreateAddress, keccak256, toBeHex } from 'ethers'
import { FACTORY_ADDRESS, RPC_URL } from '@/lib/bondforge/config'
import { factoryAbi } from '@/lib/bondforge/abi'

export const runtime = 'nodejs'

const SUFFIX = 'bf'
const MAX_ITERATIONS = 262144

function endsWithBf(value: string) {
  return value.toLowerCase().endsWith(SUFFIX)
}

async function loadLaunchArtifact() {
  const artifactPath = path.join(process.cwd(), 'artifacts/contracts/BondForgeLaunch.sol/BondForgeLaunch.json')
  const raw = await readFile(artifactPath, 'utf8')
  return JSON.parse(raw) as { abi: any[]; bytecode: string }
}

export async function POST(request: Request) {
  try {
    if (!FACTORY_ADDRESS) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_FACTORY_ADDRESS is not set' }, { status: 500 })
    }

    const { input, issuer } = await request.json()
    if (!input || !issuer) {
      return NextResponse.json({ error: 'Missing launch params or issuer address' }, { status: 400 })
    }

    const provider = new JsonRpcProvider(RPC_URL)
    const factory = new Contract(FACTORY_ADDRESS, factoryAbi, provider)
    const [owner, create2Deployer, positionManager, marketplace, swapRouter] = await Promise.all([
      factory.owner(),
      factory.create2Deployer(),
      factory.positionManager(),
      factory.marketplace(),
      factory.swapRouter(),
    ])
    const artifact = await loadLaunchArtifact()
    const launchFactory = new ContractFactory(artifact.abi, artifact.bytecode)
    const deployTx = await launchFactory.getDeployTransaction(input, issuer, owner, marketplace, swapRouter, positionManager)
    const deployData = deployTx.data

    if (!deployData) {
      return NextResponse.json({ error: 'Failed to build BondForgeLaunch deploy data' }, { status: 500 })
    }

    const initCodeHash = keccak256(deployData)

    for (let nonce = 0; nonce < MAX_ITERATIONS; nonce += 1) {
      const salt = toBeHex(nonce, 32)
      const predictedLaunch = getCreate2Address(create2Deployer, salt, initCodeHash)
      const predictedToken = getCreateAddress({ from: predictedLaunch, nonce: 1 })
      const predictedNft = getCreateAddress({ from: predictedLaunch, nonce: 2 })

      if (endsWithBf(predictedToken) && endsWithBf(predictedNft)) {
        return NextResponse.json({
          salt,
          predictedLaunch,
          predictedToken,
          predictedNft,
          creationCode: deployData,
        })
      }
    }

    return NextResponse.json({ error: 'Unable to find BF vanity addresses in the current search window' }, { status: 422 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown vanity search error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
