import { Contract, JsonRpcProvider, formatEther } from 'ethers'
import { FACTORY_ADDRESS, RPC_URL } from './config'
import { factoryAbi, launchAbi } from './abi'
import { ProjectView } from './types'

async function withTimeout<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('read timeout')), ms)
    }),
  ])
}

export async function readProjects(): Promise<ProjectView[]> {
  if (!FACTORY_ADDRESS) return []
  const provider = new JsonRpcProvider(RPC_URL)
  const factory = new Contract(FACTORY_ADDRESS, factoryAbi, provider)
  const launches = (await withTimeout(factory.getLaunches() as Promise<string[]>)) as string[]
  const rows = (
    await Promise.all(launches.map(async (launchAddress) => {
      try {
        const launch = new Contract(launchAddress, launchAbi, provider)
        const [card, totalRaised] = await withTimeout(Promise.all([
          launch.projectCard(),
          launch.totalRaised(),
        ]))
        return normalizeCard(launchAddress, card, totalRaised)
      } catch {
        return null
      }
    }))
  ).filter((row): row is ProjectView => row !== null)
  return rows.reverse()
}

export async function readProjectByAddress(launchAddress: string): Promise<ProjectView | null> {
  if (!launchAddress) return null
  const provider = new JsonRpcProvider(RPC_URL)
  const launch = new Contract(launchAddress, launchAbi, provider)
  const [card, totalRaised] = await withTimeout(Promise.all([
    launch.projectCard(),
    launch.totalRaised(),
  ]))
  return normalizeCard(launchAddress, card, totalRaised)
}

function normalizeCard(address: string, card: readonly unknown[], totalRaisedWei: bigint): ProjectView {
  const [name, symbol, description, website, twitter, telegram, imageUri, bannerUri, tokenAddress, nftAddress, issuer, mintPriceWei, totalSold, totalSupply, finalized] = card
  return {
    launchAddress: address,
    tokenAddress: String(tokenAddress),
    nftAddress: String(nftAddress),
    issuer: String(issuer),
    name: String(name),
    symbol: String(symbol),
    description: String(description),
    imageUri: String(imageUri),
    bannerUri: String(bannerUri),
    website: String(website),
    twitter: String(twitter),
    telegram: String(telegram),
    mintPriceLabel: `${Number(formatEther(mintPriceWei as bigint)).toFixed(4)} BNB`,
    progressLabel: `${Number(totalSold)}/${Number(totalSupply)}`,
    totalRaised: Number(formatEther(totalRaisedWei)),
    totalSold: Number(totalSold),
    totalSupply: Number(totalSupply),
    finalized: Boolean(finalized),
  }
}
