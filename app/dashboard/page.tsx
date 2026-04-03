"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Contract, JsonRpcProvider, formatEther, formatUnits } from "ethers"
import { FACTORY_ADDRESS, RPC_URL } from "@/lib/bondforge/config"
import { factoryAbi, launchAbi, nftAbi } from "@/lib/bondforge/abi"
import { burnToPoolTx, claimAllReservedNftsTx, claimManyTx, claimTx, createListingTx, refundTx } from "@/lib/bondforge/write"
import { getAuthorizedWallet, shortenAddress } from "@/lib/web3/client"

type OwnedRow = {
  launch: string
  nft: string
  tokenId: bigint
  vestedBps: bigint
  claimedAmount: bigint
  tokensPerNFT: bigint
  name: string
  symbol: string
  imageUri: string
  tokenDecimals: number
  launchTime: bigint
  firstDelayMinutes: number
  firstUnlockBps: number
  secondDelayMinutes: number
  secondUnlockBps: number
  hourlyUnlockBps: number
  day2To7DailyBps: number
  postDay7DailyBps: number
}

function toSafeNumber(value: bigint | number | string) {
  return typeof value === "bigint" ? Number(value) : Number(value)
}

type PendingReceiptRow = {
  launch: string
  quantity: number
  mintPriceLabel: string
  refundLabel: string
  name: string
  symbol: string
  imageUri: string
}

type PendingClaimRow = {
  launch: string
  quantity: number
  name: string
  symbol: string
  imageUri: string
}

type UnlockSnapshot = {
  unlockedAmount: bigint
  claimableAmount: bigint
  lockedAmount: bigint
  nextUnlockAt: number | null
  fullUnlockAt: number | null
  isFullyUnlocked: boolean
  scheduleCanFullyUnlock: boolean
}

function formatTokenAmount(value: bigint, decimals = 18) {
  const asNumber = Number(formatUnits(value, decimals))
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: asNumber >= 1000 ? 2 : 4,
  }).format(asNumber)
}

function formatCountdown(targetMs: number | null, nowMs: number) {
  if (!targetMs) return "—"
  const diff = targetMs - nowMs
  if (diff <= 0) return "现在"
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}天 ${hours}小时`
  if (hours > 0) return `${hours}小时 ${minutes}分钟`
  if (minutes > 0) return `${minutes}分 ${seconds}秒`
  return `${seconds}秒`
}

function buildUnlockSchedule(row: OwnedRow, launchTimeMs: number) {
  const checkpoints: Array<{ at: number; bps: number }> = []
  let cumulativeBps = 0

  const pushPoint = (at: number, addBps: number) => {
    if (addBps <= 0) return
    cumulativeBps = Math.min(10_000, cumulativeBps + addBps)
    checkpoints.push({ at, bps: cumulativeBps })
  }

  const firstMs = launchTimeMs + row.firstDelayMinutes * 60_000
  const secondMs = launchTimeMs + row.secondDelayMinutes * 60_000

  pushPoint(firstMs, row.firstUnlockBps)
  pushPoint(secondMs, row.secondUnlockBps)

  if (row.hourlyUnlockBps > 0) {
    for (let hour = 1; hour <= 23 && cumulativeBps < 10_000; hour += 1) {
      pushPoint(secondMs + hour * 3_600_000, row.hourlyUnlockBps)
    }
  }

  if (row.day2To7DailyBps > 0) {
    for (let day = 2; day <= 7 && cumulativeBps < 10_000; day += 1) {
      pushPoint(launchTimeMs + day * 86_400_000, row.day2To7DailyBps)
    }
  }

  if (row.postDay7DailyBps > 0) {
    for (let day = 8; day <= 365 && cumulativeBps < 10_000; day += 1) {
      pushPoint(launchTimeMs + day * 86_400_000, row.postDay7DailyBps)
    }
  }

  checkpoints.sort((a, b) => a.at - b.at)
  return checkpoints
}

function computeUnlockSnapshot(row: OwnedRow, nowMs: number): UnlockSnapshot {
  const vestedAmount = (row.tokensPerNFT * row.vestedBps) / 10_000n
  const claimableAmount = vestedAmount > row.claimedAmount ? vestedAmount - row.claimedAmount : 0n
  const lockedAmount = row.tokensPerNFT > vestedAmount ? row.tokensPerNFT - vestedAmount : 0n

  const launchTimeMs = Number(row.launchTime) * 1000
  if (!launchTimeMs) {
    return {
      unlockedAmount: vestedAmount,
      claimableAmount,
      lockedAmount,
      nextUnlockAt: null,
      fullUnlockAt: null,
      isFullyUnlocked: row.vestedBps >= 10_000n,
      scheduleCanFullyUnlock: row.vestedBps >= 10_000n,
    }
  }

  const checkpoints = buildUnlockSchedule(row, launchTimeMs)
  const currentBps = Number(row.vestedBps)
  const nextUnlockAt = checkpoints.find((point) => point.at > nowMs && point.bps > currentBps)?.at ?? null
  const fullUnlockAt =
    row.vestedBps >= 10_000n
      ? nowMs
      : checkpoints.find((point) => point.bps >= 10_000)?.at ?? null
  const scheduleCanFullyUnlock = checkpoints.some((point) => point.bps >= 10_000)

  return {
    unlockedAmount: vestedAmount,
    claimableAmount,
    lockedAmount,
    nextUnlockAt,
    fullUnlockAt,
    isFullyUnlocked: row.vestedBps >= 10_000n,
    scheduleCanFullyUnlock,
  }
}

export default function DashboardPage() {
  const [address, setAddress] = useState("")
  const [items, setItems] = useState<OwnedRow[]>([])
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceiptRow[]>([])
  const [pendingClaims, setPendingClaims] = useState<PendingClaimRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadNote, setLoadNote] = useState("")
  const [busyClaim, setBusyClaim] = useState("")
  const [busyMintClaim, setBusyMintClaim] = useState("")
  const [busyBurn, setBusyBurn] = useState("")
  const [busyRefund, setBusyRefund] = useState("")
  const [busyList, setBusyList] = useState("")
  const [listingPrices, setListingPrices] = useState<Record<string, string>>({})
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [expandedLaunches, setExpandedLaunches] = useState<Record<string, boolean>>({})

  async function withTimeout<T>(promise: Promise<T>, label: string, ms = 10_000): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        window.setTimeout(() => reject(new Error(`${label} timeout`)), ms)
      }),
    ])
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function resolveWalletForLoad(requestWallet: boolean) {
    const authorized = await withTimeout(getAuthorizedWallet(), "eth_accounts", 5_000).catch(() => "")
    if (authorized) return authorized
    if (requestWallet) return ""
    return ""
  }

  async function load(requestWallet = false) {
    if (!FACTORY_ADDRESS) return
    try {
      setLoading(true)
      setLoadNote("")
      const wallet = await resolveWalletForLoad(requestWallet)
      if (!wallet) {
        setAddress("")
        setItems([])
        setPendingReceipts([])
        setPendingClaims([])
        setLoadNote("连接钱包后即可查看未退款认购、待领取 NFT 与已持有仓位。")
        return
      }
      setAddress(wallet)

      const provider = new JsonRpcProvider(RPC_URL)
      const factory = new Contract(FACTORY_ADDRESS, factoryAbi, provider)
      const launches = (await withTimeout(factory.getLaunches() as Promise<string[]>, "getLaunches")) as string[]
      const rows: OwnedRow[] = []
      const pendingRows: PendingReceiptRow[] = []
      const claimRows: PendingClaimRow[] = []
      const launchResults = await Promise.all(
        launches.map(async (launchAddress) => {
          try {
            const launch = new Contract(launchAddress, launchAbi, provider)
            const [
              card,
              reservation,
              finalized,
              mintPriceWei,
              nftAddress,
              tokenAddress,
              launchTime,
              tokensPerNFT,
              firstDelayMinutes,
              firstUnlockBps,
              secondDelayMinutes,
              secondUnlockBps,
              hourlyUnlockBps,
              day2To7DailyBps,
              postDay7DailyBps,
              claimableNfts,
            ] = await withTimeout(
              Promise.all([
                launch.projectCard(),
                launch.reservationOf(wallet) as Promise<bigint>,
                launch.finalized() as Promise<boolean>,
                launch.mintPriceWei() as Promise<bigint>,
                launch.nftAddress() as Promise<string>,
                launch.tokenAddress() as Promise<string>,
                launch.launchTime() as Promise<bigint>,
                launch.tokensPerNFT() as Promise<bigint>,
                launch.firstDelayMinutes() as Promise<number>,
                launch.firstUnlockBps() as Promise<number>,
                launch.secondDelayMinutes() as Promise<number>,
                launch.secondUnlockBps() as Promise<number>,
                launch.hourlyUnlockBps() as Promise<number>,
                launch.day2To7DailyBps() as Promise<number>,
                launch.postDay7DailyBps() as Promise<number>,
                launch.claimableNFTs(wallet).catch(() => 0n),
              ]),
              `launch ${launchAddress}`,
            )

            const [name, symbol, , , , , imageUri] = card as readonly unknown[]
            const nft = new Contract(nftAddress, nftAbi, provider)
            const token = new Contract(tokenAddress, ["function decimals() view returns (uint8)"], provider)
            const [tokenDecimalsRaw, balanceRaw] = await withTimeout(
              Promise.all([
                token.decimals() as Promise<number>,
                nft.balanceOf(wallet) as Promise<bigint>,
              ]),
              `balances ${launchAddress}`,
            )
            const tokenDecimals = toSafeNumber(tokenDecimalsRaw)
            const balance = Number(balanceRaw)

            let pending: PendingReceiptRow | null = null
            if (!finalized && Number(reservation) > 0) {
              const refundWei = (mintPriceWei * reservation * 99n) / 100n
              pending = {
                launch: launchAddress,
                quantity: Number(reservation),
                mintPriceLabel: `${Number(formatEther(mintPriceWei)).toFixed(4)} BNB`,
                refundLabel: `${Number(formatEther(refundWei)).toFixed(4)} BNB`,
                name: String(name) || shortenAddress(launchAddress),
                symbol: String(symbol) || "--",
                imageUri: String(imageUri) || "/images/project-placeholder.svg",
              }
            }

            const pendingClaim: PendingClaimRow | null = finalized && Number(claimableNfts) > 0
              ? {
                  launch: launchAddress,
                  quantity: Number(claimableNfts),
                  name: String(name) || shortenAddress(launchAddress),
                  symbol: String(symbol) || "--",
                  imageUri: String(imageUri) || "/images/project-placeholder.svg",
                }
              : null

            if (balance === 0) {
              return { pending, pendingClaim, rows: [] as OwnedRow[] }
            }

            const tokenIds = await withTimeout(
              Promise.all(
                Array.from({ length: balance }, (_, index) => nft.tokenOfOwnerByIndex(wallet, index) as Promise<bigint>),
              ),
              `token ids ${launchAddress}`,
            )

            const tokenStates = await withTimeout(
              Promise.all(
                tokenIds.map((tokenId) =>
                  Promise.all([
                    launch.vestedBpsForToken(tokenId) as Promise<bigint>,
                    launch.claimed(tokenId) as Promise<bigint>,
                  ]),
                ),
              ),
              `token states ${launchAddress}`,
            )

            const ownedRows: OwnedRow[] = tokenIds.map((tokenId, index) => {
              const [vestedBps, claimedAmount] = tokenStates[index]
              return {
                launch: launchAddress,
                nft: nftAddress,
                tokenId,
                vestedBps,
                claimedAmount,
                tokensPerNFT,
                name: String(name) || shortenAddress(launchAddress),
                symbol: String(symbol) || "--",
                imageUri: String(imageUri) || "/images/project-placeholder.svg",
                tokenDecimals,
                launchTime,
                firstDelayMinutes: toSafeNumber(firstDelayMinutes),
                firstUnlockBps: toSafeNumber(firstUnlockBps),
                secondDelayMinutes: toSafeNumber(secondDelayMinutes),
                secondUnlockBps: toSafeNumber(secondUnlockBps),
                hourlyUnlockBps: toSafeNumber(hourlyUnlockBps),
                day2To7DailyBps: toSafeNumber(day2To7DailyBps),
                postDay7DailyBps: toSafeNumber(postDay7DailyBps),
              }
            })

            return { pending, pendingClaim, rows: ownedRows }
          } catch (error) {
            console.error("Dashboard launch read failed", launchAddress, error)
            return { pending: null as PendingReceiptRow | null, pendingClaim: null as PendingClaimRow | null, rows: [] as OwnedRow[], skipped: true }
          }
        }),
      )

      let skipped = 0
      for (const result of launchResults) {
        if ("skipped" in result && result.skipped) skipped += 1
        if (result.pending) pendingRows.push(result.pending)
        if (result.pendingClaim) claimRows.push(result.pendingClaim)
        rows.push(...result.rows)
      }

      setItems(rows)
      setPendingReceipts(pendingRows)
      setPendingClaims(claimRows)
      if (skipped > 0) {
        setLoadNote(`${skipped} 个项目因 RPC 读取超时或异常被暂时跳过。`)
      }
    } catch (error) {
      console.error("Dashboard load failed", error)
      setLoadNote(error instanceof Error ? error.message : "资产页读取失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, OwnedRow[]>()
    for (const item of items) {
      if (!map.has(item.launch)) map.set(item.launch, [])
      map.get(item.launch)!.push(item)
    }
    return Array.from(map.entries())
  }, [items])

  const activeLaunchCount = useMemo(() => {
    return new Set([
      ...grouped.map(([launch]) => launch),
      ...pendingClaims.map((row) => row.launch),
      ...pendingReceipts.map((row) => row.launch),
    ]).size
  }, [grouped, pendingClaims, pendingReceipts])

  function toggleLaunch(launch: string) {
    setExpandedLaunches((current) => ({
      ...current,
      [launch]: !(current[launch] ?? true),
    }))
  }

  async function handleClaim(launch: string, tokenId: bigint) {
    try {
      const key = `${launch}-${tokenId.toString()}`
      setBusyClaim(key)
      await claimTx(launch, tokenId)
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : "领取失败")
    } finally {
      setBusyClaim("")
    }
  }

  async function handleClaimAll(rows: OwnedRow[]) {
    try {
      const launch = rows[0]?.launch || ""
      const claimableTokenIds = rows
        .filter((row) => computeUnlockSnapshot(row, Date.now()).claimableAmount > 0n)
        .map((row) => row.tokenId)

      if (claimableTokenIds.length === 0) {
        alert("当前没有可领取的额度")
        return
      }

      setBusyClaim(`all-${launch}`)
      await claimManyTx(launch, claimableTokenIds)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "批量领取失败"
      if (message.includes("claimMany") || message.includes("is not a function") || message.includes("missing revert data")) {
        alert("这个项目使用的是旧版合约，一键领取会退回逐笔模式。新创建的项目会支持真正的一笔批量领取。")
      } else {
        alert(message)
      }
    } finally {
      setBusyClaim("")
    }
  }

  async function handleClaimReserved(launch: string) {
    try {
      setBusyMintClaim(launch)
      await claimAllReservedNftsTx(launch)
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : "NFT 领取失败")
    } finally {
      setBusyMintClaim("")
    }
  }

  async function handleBurn(row: OwnedRow) {
    const key = `${row.launch}-${row.tokenId.toString()}`
    try {
      setBusyBurn(key)
      await burnToPoolTx(row.launch, row.tokenId)
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : "燃烧失败")
    } finally {
      setBusyBurn("")
    }
  }

  async function handleRefund(launch: string, quantity: number) {
    try {
      setBusyRefund(`${launch}-${quantity}`)
      await refundTx(launch, quantity)
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : "退款失败")
    } finally {
      setBusyRefund("")
    }
  }

  async function handleList(row: OwnedRow) {
    const key = `${row.launch}-${row.tokenId.toString()}`
    const price = listingPrices[key] || "0.05"
    try {
      setBusyList(key)
      await createListingTx(row.launch, row.nft, row.tokenId, price)
      alert("已挂单到市场")
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : "挂单失败")
    } finally {
      setBusyList("")
    }
  }

  const claimableRows = items.filter((item) => computeUnlockSnapshot(item, nowMs).claimableAmount > 0n).length

  return (
    <div className="container-shell py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title">我的仓位</h1>
          <p className="section-subtitle mt-3">这里集中管理认购凭证、待领取 NFT、已持有仓位、燃烧池操作和挂单动作。</p>
        </div>
        <button className="btn-secondary" onClick={() => void load(true)}>{loading ? "刷新中..." : "刷新"}</button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-5">
        <div className="glass card">
          <div className="muted text-sm">待退款认购</div>
          <div className="mt-2 text-3xl font-black">{pendingReceipts.reduce((sum, item) => sum + item.quantity, 0)}</div>
        </div>
        <div className="glass card">
          <div className="muted text-sm">待领取 NFT</div>
          <div className="mt-2 text-3xl font-black">{pendingClaims.reduce((sum, item) => sum + item.quantity, 0)}</div>
        </div>
        <div className="glass card">
          <div className="muted text-sm">持有中 NFT</div>
          <div className="mt-2 text-3xl font-black">{items.length}</div>
        </div>
        <div className="glass card">
          <div className="muted text-sm">可操作仓位</div>
          <div className="mt-2 text-3xl font-black">{claimableRows}</div>
        </div>
        <div className="glass card">
          <div className="muted text-sm">活跃项目</div>
          <div className="mt-2 text-3xl font-black">{activeLaunchCount}</div>
        </div>
      </div>

      {loadNote ? (
        <div className="glass card mt-6 border-amber-400/20 bg-amber-500/5 text-amber-100">
          <div className="text-sm">{loadNote}</div>
        </div>
      ) : null}

      <div className="glass card mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">认购凭证</h2>
            <p className="muted mt-2 text-sm">项目打满前，认购记录会以可退款凭证的形式显示在这里；一旦发射完成，这部分会转为可领取 NFT。</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {pendingReceipts.length === 0 ? (
            <div className="text-slate-300">钱包里还没有待退款的认购凭证。</div>
          ) : (
            pendingReceipts.map((receipt) => {
              const refundKey = `${receipt.launch}-${receipt.quantity}`
              return (
                <div key={receipt.launch} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img src={receipt.imageUri} alt={receipt.name} className="h-16 w-16 rounded-2xl border border-white/10 object-cover" />
                      <div>
                        <div className="text-xl font-semibold">{receipt.name}</div>
                        <div className="muted mt-1 text-sm">{receipt.symbol} · {receipt.quantity} 份认购凭证</div>
                        <div className="muted mt-1 text-sm">{shortenAddress(receipt.launch)}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link href={`/projects/${receipt.launch}`} className="btn-secondary">查看项目</Link>
                      <button
                        className="btn-danger"
                        disabled={busyRefund === refundKey}
                        onClick={() => void handleRefund(receipt.launch, receipt.quantity)}
                      >
                        {busyRefund === refundKey ? "退款中..." : `退款 ${receipt.refundLabel}`}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <div className="muted text-xs">凭证数量</div>
                      <div className="mt-2 text-lg font-bold">{receipt.quantity}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <div className="muted text-xs">认购价格</div>
                      <div className="mt-2 text-lg font-bold">{receipt.mintPriceLabel}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <div className="muted text-xs">退款到账</div>
                      <div className="mt-2 text-lg font-bold">{receipt.refundLabel}</div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="glass card mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">待领取 NFT</h2>
            <p className="muted mt-2 text-sm">项目发射并启动全局解锁时钟后，钱包仍需要把自己对应的认购份额铸造成 NFT，后续才能继续管理仓位。</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {pendingClaims.length === 0 ? (
            <div className="text-slate-300">钱包里还没有待领取的 NFT 份额。</div>
          ) : (
            pendingClaims.map((row) => (
              <div key={row.launch} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img src={row.imageUri} alt={row.name} className="h-16 w-16 rounded-2xl border border-white/10 object-cover" />
                    <div>
                      <div className="text-xl font-semibold">{row.name}</div>
                      <div className="muted mt-1 text-sm">{row.symbol} · 待领取 {row.quantity} 张 NFT</div>
                      <div className="muted mt-1 text-sm">{shortenAddress(row.launch)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/projects/${row.launch}`} className="btn-secondary">查看项目</Link>
                    <button className="btn-primary" disabled={busyMintClaim === row.launch} onClick={() => void handleClaimReserved(row.launch)}>
                      {busyMintClaim === row.launch ? "领取中..." : `领取全部 ${row.quantity} 张 NFT`}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6">
        {grouped.length === 0 ? (
          <div className="glass card text-slate-300">钱包里还没有持有中的 NFT。认购凭证和待领取份额会先显示在上方，领取之后才会进入这里。</div>
        ) : (
          grouped.map(([launch, rows]) => {
            const first = rows[0]
            const snapshots = rows.map((row) => ({ row, snapshot: computeUnlockSnapshot(row, nowMs) }))
            const totalClaimable = snapshots.reduce((sum, entry) => sum + entry.snapshot.claimableAmount, 0n)
            const totalLocked = snapshots.reduce((sum, entry) => sum + entry.snapshot.lockedAmount, 0n)
            const nextUnlockAt = snapshots
              .map((entry) => entry.snapshot.nextUnlockAt)
              .filter((value): value is number => value !== null)
              .sort((a, b) => a - b)[0] ?? null
            const fullUnlockAt = snapshots
              .map((entry) => entry.snapshot.fullUnlockAt)
              .filter((value): value is number => value !== null)
              .sort((a, b) => b - a)[0] ?? null
            const expanded = expandedLaunches[launch] ?? true

            return (
              <div key={launch} className="glass card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img src={first.imageUri} alt={first.name} className="h-20 w-20 rounded-3xl border border-white/10 object-cover" />
                    <div>
                      <div className="text-2xl font-bold">{first.name}</div>
                      <div className="muted mt-1 text-sm">${first.symbol} · 持有 {rows.length} 张 NFT</div>
                      <div className="muted mt-1 text-sm">{shortenAddress(launch)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button className="btn-secondary" onClick={() => toggleLaunch(launch)}>
                      {expanded ? "收起" : "展开"}
                    </button>
                    <Link href={`/projects/${launch}`} className="btn-secondary">查看项目</Link>
                    <button className="btn-primary" disabled={busyClaim === `all-${launch}` || totalClaimable === 0n} onClick={() => void handleClaimAll(rows)}>
                      {busyClaim === `all-${launch}` ? "领取中..." : totalClaimable > 0n ? `一键领取 ${formatTokenAmount(totalClaimable, first.tokenDecimals)}` : "暂无可领取"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <div className="muted text-xs">当前可领取</div>
                      <div className="mt-2 text-xl font-bold">{formatTokenAmount(totalClaimable, first.tokenDecimals)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <div className="muted text-xs">仍在锁仓</div>
                      <div className="mt-2 text-xl font-bold">{formatTokenAmount(totalLocked, first.tokenDecimals)}</div>
                    </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="muted text-xs">下次解锁</div>
                    <div className="mt-2 text-xl font-bold">{formatCountdown(nextUnlockAt, nowMs)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="muted text-xs">完全解锁</div>
                    <div className="mt-2 text-xl font-bold">{formatCountdown(fullUnlockAt, nowMs)}</div>
                  </div>
                </div>

                {expanded ? (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {snapshots.map(({ row, snapshot }) => {
                      const key = `${row.launch}-${row.tokenId.toString()}`
                      const unlockedPercent = `${Number(row.vestedBps) / 100}%`
                      const burnImmediate = (row.tokensPerNFT - row.claimedAmount) / 2n
                      const timerLabel = snapshot.isFullyUnlocked
                        ? "已全部解锁"
                        : snapshot.nextUnlockAt
                          ? formatCountdown(snapshot.nextUnlockAt, nowMs)
                          : snapshot.scheduleCanFullyUnlock
                            ? "等待下一次解锁"
                            : "当前无后续节点"
                      const fullUnlockLabel = snapshot.isFullyUnlocked
                        ? "现在"
                        : snapshot.fullUnlockAt
                          ? formatCountdown(snapshot.fullUnlockAt, nowMs)
                          : "当前计划未覆盖"

                      return (
                        <div key={key} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xl font-bold">NFT #{row.tokenId.toString()}</div>
                              <div className="muted mt-1 text-sm">{shortenAddress(row.launch)}</div>
                            </div>
                            <div className="rounded-full border border-white/10 bg-slate-950/30 px-3 py-1 text-sm font-semibold text-slate-200">
                              {unlockedPercent}
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                              <div className="muted text-[11px] uppercase tracking-[0.18em]">当前可领取</div>
                              <div className="mt-2 text-lg font-bold">{formatTokenAmount(snapshot.claimableAmount, row.tokenDecimals)}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                                <div className="muted text-[11px] uppercase tracking-[0.18em]">仍在锁仓</div>
                                <div className="mt-2 text-base font-semibold">{formatTokenAmount(snapshot.lockedAmount, row.tokenDecimals)}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                                <div className="muted text-[11px] uppercase tracking-[0.18em]">下一次解锁</div>
                                <div className="mt-2 text-base font-semibold">{timerLabel}</div>
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                              <div className="muted text-[11px] uppercase tracking-[0.18em]">完全解锁</div>
                              <div className="mt-2 text-base font-semibold">{fullUnlockLabel}</div>
                            </div>
                            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                              <div className="muted text-[11px] uppercase tracking-[0.18em]">立即燃烧可得</div>
                              <div className="mt-2 text-base font-semibold text-amber-100">
                                {formatTokenAmount(burnImmediate, row.tokenDecimals)}
                              </div>
                              <div className="mt-1 text-xs text-amber-200/80">
                                燃烧并注入燃烧池后，可立刻拿回剩余未领取代币的 50%。
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            <input
                              className="field h-12 text-sm"
                              value={listingPrices[key] ?? "0.05"}
                              onChange={(event) =>
                                setListingPrices((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                              placeholder="挂单价格（BNB）"
                            />
                            <div className="grid grid-cols-3 gap-3">
                              <button className="btn-primary w-full" disabled={busyClaim === key || snapshot.claimableAmount === 0n} onClick={() => void handleClaim(row.launch, row.tokenId)}>
                                {busyClaim === key ? "领取中..." : snapshot.claimableAmount > 0n ? "领取" : "锁定中"}
                              </button>
                              <button className="btn-danger w-full" disabled={busyBurn === key || burnImmediate === 0n} onClick={() => void handleBurn(row)}>
                                {busyBurn === key ? "燃烧中..." : burnImmediate > 0n ? "燃烧" : "无可燃烧额度"}
                              </button>
                              <button className="btn-secondary w-full" disabled={busyList === key} onClick={() => void handleList(row)}>
                                {busyList === key ? "挂单中..." : "挂单"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-slate-300">
                    已折叠 {rows.length} 张 NFT，展开后可查看每张卡片的领取、燃烧与挂单状态。
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
