"use client"

import { Contract, Interface, parseEther } from 'ethers'
import { createBrowserProvider, ensureBscTestnet } from '@/lib/web3/client'
import { FACTORY_ADDRESS, MARKETPLACE_ADDRESS } from './config'
import { factoryAbi, launchAbi, marketAbi, nftAbi } from './abi'

export type CreateLaunchInput = {
  name: string
  symbol: string
  tokenName: string
  tokenSymbol: string
  description: string
  imageURI: string
  bannerURI: string
  website: string
  twitter: string
  telegram: string
  nftBaseURI: string
  memeImageURI: string
  nftMode: number
  mintPriceWei: string
  nftSupply: number
  walletCapBps: number
  multipleBps: number
  firstDelayMinutes: number
  firstUnlockBps: number
  secondDelayMinutes: number
  secondUnlockBps: number
  hourlyUnlockBps: number
  day2To7DailyBps: number
  postDay7DailyBps: number
}

type VanitySearchResult = {
  salt: string
  predictedLaunch: string
  predictedToken: string
  predictedNft: string
  creationCode: string
}

async function getSigner() {
  await ensureBscTestnet()
  const provider = createBrowserProvider()
  if (!provider) throw new Error('未检测到钱包扩展')
  return provider.getSigner()
}

function endsWithBf(value: string) {
  return value.toLowerCase().endsWith('bf')
}

async function findBfVanitySalt(input: CreateLaunchInput, issuer: string): Promise<VanitySearchResult> {
  const response = await fetch('/api/vanity-bf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, issuer }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'BF vanity search failed')
  }
  return payload as VanitySearchResult
}

async function requestKeeperFinalize(launchAddress: string) {
  const response = await fetch(`/api/launches/${launchAddress}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Keeper finalize failed')
  }
  return payload as { finalizedNow: boolean; alreadyFinalized: boolean; soldOut: boolean; txHash?: string }
}

export async function createLaunchTx(input: CreateLaunchInput) {
  if (!FACTORY_ADDRESS) throw new Error('缺少 NEXT_PUBLIC_FACTORY_ADDRESS')
  const signer = await getSigner()
  const factory = new Contract(FACTORY_ADDRESS, factoryAbi, signer)
  const issuer = await signer.getAddress()
  const vanity = await findBfVanitySalt(input, issuer)

  const tx = await factory.createLaunchWithSalt(input, vanity.salt, vanity.creationCode)
  const receipt = await tx.wait()
  const iface = new Interface(factoryAbi)
  let launchAddress = ''
  let tokenAddress = ''
  let nftAddress = ''
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log)
      if (parsed && parsed.name === 'LaunchCreated') {
        launchAddress = String(parsed.args.launch)
        tokenAddress = String(parsed.args.token)
        nftAddress = String(parsed.args.nft)
      }
    } catch {}
  }
  if (!endsWithBf(tokenAddress) || !endsWithBf(nftAddress)) {
    throw new Error(`Vanity verification failed. Expected BF suffixes, got token ${tokenAddress} and nft ${nftAddress}.`)
  }
  return { receipt, launchAddress, tokenAddress, nftAddress, predictedLaunch: vanity.predictedLaunch, predictedToken: vanity.predictedToken, predictedNft: vanity.predictedNft }
}

export async function subscribeTx(launchAddress: string, quantity: number, totalCostWei: bigint) {
  const signer = await getSigner()
  const launch = new Contract(launchAddress, launchAbi, signer)
  const tx = await launch.subscribe(quantity, { value: totalCostWei })
  const receipt = await tx.wait()

  const sold = await launch.totalSold()
  const supply = await launch.nftSupply()
  const finalized = await launch.finalized()
  let finalizeResult: { finalizedNow: boolean; alreadyFinalized: boolean; soldOut: boolean; txHash?: string } | null = null
  let finalizeError = ''

  if (!finalized && sold >= supply) {
    try {
      finalizeResult = await requestKeeperFinalize(launchAddress)
    } catch (error) {
      finalizeError = error instanceof Error ? error.message : 'Keeper finalize failed'
    }
  }

  return { receipt, finalizeResult, finalizeError }
}

export async function refundTx(launchAddress: string, quantity: number) {
  const signer = await getSigner()
  const launch = new Contract(launchAddress, launchAbi, signer)
  const tx = await launch.refund(quantity)
  return tx.wait()
}

export async function finalizeLaunchTx(launchAddress: string) {
  return requestKeeperFinalize(launchAddress)
}

export async function autoFinalizeIfReadyTx(launchAddress: string) {
  return requestKeeperFinalize(launchAddress)
}

export async function claimTx(launchAddress: string, tokenId: bigint | number) {
  const signer = await getSigner()
  const launch = new Contract(launchAddress, launchAbi, signer)
  const tx = await launch.claim(tokenId)
  return tx.wait()
}

export async function claimManyTx(launchAddress: string, tokenIds: Array<bigint | number>) {
  if (tokenIds.length === 0) throw new Error("没有可领取的 NFT 仓位")
  const signer = await getSigner()
  const launch = new Contract(launchAddress, launchAbi, signer)
  const tx = await launch.claimMany(tokenIds)
  return tx.wait()
}

export async function claimReservedNftsTx(launchAddress: string, quantity: number) {
  const signer = await getSigner()
  const launch = new Contract(launchAddress, launchAbi, signer)
  const tx = await launch.claimNFTs(quantity)
  return tx.wait()
}

export async function claimAllReservedNftsTx(launchAddress: string) {
  const signer = await getSigner()
  const launch = new Contract(launchAddress, launchAbi, signer)
  const tx = await launch.claimAllNFTs()
  return tx.wait()
}

export async function burnToPoolTx(launchAddress: string, tokenId: bigint | number) {
  const signer = await getSigner()
  const launch = new Contract(launchAddress, launchAbi, signer)
  const tx = await launch.burnToPool(tokenId)
  return tx.wait()
}

export async function collectPoolFeesTx(launchAddress: string) {
  const signer = await getSigner()
  const launch = new Contract(launchAddress, launchAbi, signer)
  const tx = await launch.collectPoolFees()
  return tx.wait()
}

export async function collectAllPoolFeesTx(launchAddresses: string[]) {
  const receipts = []
  for (const launchAddress of launchAddresses) {
    receipts.push(await collectPoolFeesTx(launchAddress))
  }
  return receipts
}

export async function buyBurnPoolTx(launchAddress: string, tokenId: bigint | number, priceWei: bigint) {
  const signer = await getSigner()
  const launch = new Contract(launchAddress, launchAbi, signer)
  const tx = await launch.buyFromBurnPool(tokenId, { value: priceWei })
  return tx.wait()
}

export async function createListingTx(launchAddress: string, nftAddress: string, tokenId: bigint | number, priceLabel: string) {
  if (!MARKETPLACE_ADDRESS) throw new Error('缺少 NEXT_PUBLIC_MARKETPLACE_ADDRESS')
  const signer = await getSigner()
  const price = parseEther(priceLabel)
  const nft = new Contract(nftAddress, nftAbi, signer)
  const market = new Contract(MARKETPLACE_ADDRESS, marketAbi, signer)
  const approve = await nft.approve(MARKETPLACE_ADDRESS, tokenId)
  await approve.wait()
  const tx = await market.createListing(nftAddress, launchAddress, tokenId, price)
  return tx.wait()
}

export async function buyListingTx(listingId: bigint | number, priceWei: bigint) {
  if (!MARKETPLACE_ADDRESS) throw new Error('缺少 NEXT_PUBLIC_MARKETPLACE_ADDRESS')
  const signer = await getSigner()
  const market = new Contract(MARKETPLACE_ADDRESS, marketAbi, signer)
  const tx = await market.buy(listingId, { value: priceWei })
  return tx.wait()
}

export async function cancelListingTx(listingId: bigint | number) {
  if (!MARKETPLACE_ADDRESS) throw new Error('缺少 NEXT_PUBLIC_MARKETPLACE_ADDRESS')
  const signer = await getSigner()
  const market = new Contract(MARKETPLACE_ADDRESS, marketAbi, signer)
  const tx = await market.cancelListing(listingId)
  return tx.wait()
}
