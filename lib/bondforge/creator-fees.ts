import { Contract, Interface, JsonRpcProvider, formatEther } from 'ethers'
import { FACTORY_ADDRESS, MARKETPLACE_ADDRESS, RPC_URL } from './config'
import { factoryAbi, launchAbi, marketAbi, nftAbi } from './abi'

const SERVER_RPC_URL = process.env.BONDFORGE_SERVER_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'
const stateProvider = new JsonRpcProvider(SERVER_RPC_URL, undefined, { batchMaxCount: 1 })
const logsProvider = new JsonRpcProvider(RPC_URL || 'https://bsc-testnet-rpc.publicnode.com', undefined, { batchMaxCount: 1 })
const launchLogInterface = new Interface([
  'event BurnPoolBought(uint256 indexed tokenId, address indexed buyer, uint256 price)',
])

type CreatorProjectBase = {
  launchAddress: string
  tokenAddress: string
  nftAddress: string
  issuer: string
  name: string
  symbol: string
  imageUri: string
  totalRaisedWei: bigint
  finalized: boolean
}

export type CreatorFeeRow = {
  launchAddress: string
  name: string
  symbol: string
  imageUri: string
  launchShareBnb: string
  marketFeeBnb: string
  burnPoolFeeBnb: string
  autoSettledBnb: string
  claimableLpBnb: string
  claimableLpToken: string
  claimableLpBnbEquivalent: string
  canCollectLpFees: boolean
  legacyLockerMismatch: boolean
  lpCollectError: string
  marketFeeEstimated: boolean
}

export type CreatorFeesPayload = {
  issuer: string
  rows: CreatorFeeRow[]
  summary: {
    launchShareBnb: string
    marketFeeBnb: string
    burnPoolFeeBnb: string
    autoSettledBnb: string
    claimableLpBnb: string
    claimableLpToken: string
    claimableLpBnbEquivalent: string
    collectibleLaunches: number
    blockedLegacyLaunches: number
  }
}

function formatWei(value: bigint) {
  return formatEther(value)
}

function normalizeCard(address: string, card: readonly unknown[], totalRaisedWei: bigint): CreatorProjectBase {
  const [name, symbol, , , , , imageUri, , tokenAddress, nftAddress, issuer, , , , finalized] = card
  return {
    launchAddress: address,
    tokenAddress: String(tokenAddress),
    nftAddress: String(nftAddress),
    issuer: String(issuer),
    name: String(name),
    symbol: String(symbol),
    imageUri: String(imageUri),
    totalRaisedWei,
    finalized: Boolean(finalized),
  }
}

async function readCreatorProjects(issuer: string): Promise<CreatorProjectBase[]> {
  if (!FACTORY_ADDRESS) return []
  const factory = new Contract(FACTORY_ADDRESS, factoryAbi, stateProvider)
  const launches = (await factory.getLaunches()) as string[]
  const rows = (
    await Promise.all(launches.map(async (launchAddress) => {
      try {
        const launch = new Contract(launchAddress, launchAbi, stateProvider)
        const [card, totalRaised] = await Promise.all([
          launch.projectCard(),
          launch.totalRaised(),
        ])
        return normalizeCard(launchAddress, card, totalRaised as bigint)
      } catch {
        return null
      }
    }))
  ).filter((row): row is CreatorProjectBase => row !== null)
  return rows.filter((row) => row.issuer.toLowerCase() === issuer.toLowerCase()).reverse()
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function getLogsChunked(address: string, fromBlock: number, toBlock: number, step = 2_000) {
  const logs = []
  for (let start = fromBlock; start <= toBlock; start += step + 1) {
    const end = Math.min(start + step, toBlock)
    let part = null
    let waitMs = 250
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        part = await logsProvider.getLogs({ address, fromBlock: start, toBlock: end })
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.includes('limit exceeded') && !message.includes('rate limit')) {
          throw error
        }
        await sleep(waitMs)
        waitMs *= 2
      }
    }
    if (!part) {
      throw new Error(`log scan failed for ${address} @ ${start}-${end}`)
    }
    logs.push(...part)
  }
  return logs
}

async function estimateStartBlock(latestBlock: number, latestTimestamp: number, launchTime: bigint) {
  if (launchTime <= 0n) return Math.max(0, latestBlock - 30_000)
  const secondsAgo = Math.max(0, latestTimestamp - Number(launchTime))
  const estimatedBlocksAgo = Math.ceil(secondsAgo / 2) + 8_000
  return Math.max(0, latestBlock - estimatedBlocksAgo)
}

async function getEstimatedMarketFees(launches: CreatorProjectBase[]) {
  const byLaunch = new Map<string, bigint>()
  if (!MARKETPLACE_ADDRESS || launches.length === 0) return { byLaunch, estimated: false }

  const targetLaunches = new Set(launches.map((launch) => launch.launchAddress.toLowerCase()))
  const market = new Contract(MARKETPLACE_ADDRESS, marketAbi, stateProvider)
  const nextId = Number(await market.nextId().catch(() => 1n))
  const nftCache = new Map<string, Contract>()
  let estimated = false

  for (let id = 1; id < nextId; id++) {
    const item = await market.listings(id).catch(() => null)
    if (!item) continue
    const launchAddress = String(item.launch).toLowerCase()
    if (!targetLaunches.has(launchAddress) || Boolean(item.active)) continue
    const nftAddress = String(item.nft)
    const nft = nftCache.get(nftAddress) ?? new Contract(nftAddress, nftAbi, stateProvider)
    nftCache.set(nftAddress, nft)
    const owner = await nft.ownerOf(item.tokenId).catch(() => '')
    if (!owner || owner.toLowerCase() === String(item.seller).toLowerCase()) continue
    const fee = BigInt(item.price.toString()) / 2_000n
    byLaunch.set(launchAddress, (byLaunch.get(launchAddress) ?? 0n) + fee)
    estimated = true
  }

  return { byLaunch, estimated }
}

export async function readCreatorFees(issuer: string): Promise<CreatorFeesPayload> {
  const projects = await readCreatorProjects(issuer)
  const { byLaunch: marketFeesByLaunch, estimated: marketFeeEstimated } = await getEstimatedMarketFees(projects)
  const latestBlock = await stateProvider.getBlockNumber()
  const latest = await stateProvider.getBlock(latestBlock)
  const latestTimestamp = latest?.timestamp ?? Math.floor(Date.now() / 1000)

  let launchShareTotal = 0n
  let marketFeeTotal = 0n
  let burnPoolFeeTotal = 0n
  let claimableLpBnbTotal = 0n
  let claimableLpTokenTotal = 0n
  let claimableLpBnbEquivalentTotal = 0n
  let collectibleLaunches = 0
  let blockedLegacyLaunches = 0

  const rows = await Promise.all(projects.map(async (project) => {
    const launch = new Contract(project.launchAddress, launchAbi, stateProvider)
    const [mintPriceWei, launchTime, referencePricePerTokenWei, positionTokenId, liquidityLocker] = await Promise.all([
      launch.mintPriceWei() as Promise<bigint>,
      launch.launchTime().catch(() => 0n),
      launch.referencePricePerTokenWei().catch(() => 0n),
      launch.positionTokenId().catch(() => 0n),
      launch.liquidityLocker().catch(() => ''),
    ])

    const fromBlock = await estimateStartBlock(latestBlock, latestTimestamp, BigInt(launchTime.toString()))
    const logs = await getLogsChunked(project.launchAddress, fromBlock, latestBlock)

    let burnPoolFeeWei = 0n
    for (const log of logs) {
      try {
        const parsed = launchLogInterface.parseLog(log)
        if (!parsed) continue
        if (parsed.name === 'BurnPoolBought') {
          burnPoolFeeWei += BigInt(parsed.args.price.toString()) / 20n
        }
      } catch {}
    }

    const launchShareWei = project.finalized ? (project.totalRaisedWei * 5n) / 100n : 0n
    const marketFeeWei = marketFeesByLaunch.get(project.launchAddress.toLowerCase()) ?? 0n
    const autoSettledWei = launchShareWei + burnPoolFeeWei + marketFeeWei

    let claimableLpWrappedWei = 0n
    let claimableLpTokenWei = 0n
    let claimableLpBnbEquivalentWei = 0n
    let canCollectLpFees = false
    let legacyLockerMismatch = false
    let lpCollectError = ''

    if (project.finalized) {
      try {
        const result = await launch.collectPoolFees.staticCall()
        claimableLpTokenWei = BigInt(result[0].toString())
        claimableLpWrappedWei = BigInt(result[1].toString())
        claimableLpBnbEquivalentWei = claimableLpWrappedWei + ((claimableLpTokenWei * BigInt(referencePricePerTokenWei.toString())) / 10n ** 18n)
        canCollectLpFees = claimableLpTokenWei > 0n || claimableLpWrappedWei > 0n
      } catch (error) {
        lpCollectError = error instanceof Error ? error.message : 'collect failed'
        if (lpCollectError.includes('position missing') && BigInt(positionTokenId.toString()) > 0n && liquidityLocker) {
          legacyLockerMismatch = true
          blockedLegacyLaunches += 1
        }
      }
    }

    launchShareTotal += launchShareWei
    marketFeeTotal += marketFeeWei
    burnPoolFeeTotal += burnPoolFeeWei
    claimableLpBnbTotal += claimableLpWrappedWei
    claimableLpTokenTotal += claimableLpTokenWei
    claimableLpBnbEquivalentTotal += claimableLpBnbEquivalentWei
    if (canCollectLpFees) collectibleLaunches += 1

    return {
      launchAddress: project.launchAddress,
      name: project.name,
      symbol: project.symbol,
      imageUri: project.imageUri,
      launchShareBnb: formatWei(launchShareWei),
      marketFeeBnb: formatWei(marketFeeWei),
      burnPoolFeeBnb: formatWei(burnPoolFeeWei),
      autoSettledBnb: formatWei(autoSettledWei),
      claimableLpBnb: formatWei(claimableLpWrappedWei),
      claimableLpToken: formatWei(claimableLpTokenWei),
      claimableLpBnbEquivalent: formatWei(claimableLpBnbEquivalentWei),
      canCollectLpFees,
      legacyLockerMismatch,
      lpCollectError,
      marketFeeEstimated,
    } satisfies CreatorFeeRow
  }))

  return {
    issuer,
    rows,
    summary: {
      launchShareBnb: formatWei(launchShareTotal),
      marketFeeBnb: formatWei(marketFeeTotal),
      burnPoolFeeBnb: formatWei(burnPoolFeeTotal),
      autoSettledBnb: formatWei(launchShareTotal + marketFeeTotal + burnPoolFeeTotal),
      claimableLpBnb: formatWei(claimableLpBnbTotal),
      claimableLpToken: formatWei(claimableLpTokenTotal),
      claimableLpBnbEquivalent: formatWei(claimableLpBnbEquivalentTotal),
      collectibleLaunches,
      blockedLegacyLaunches,
    },
  }
}
