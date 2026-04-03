"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { collectAllPoolFeesTx, collectPoolFeesTx } from "@/lib/bondforge/write"
import { ensureBscTestnet, getAuthorizedWallet } from "@/lib/web3/client"

type CreatorFeeRow = {
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

type CreatorFeesPayload = {
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

function formatAmount(value: string, fractionDigits = 4) {
  return Number(value || "0").toLocaleString(undefined, { maximumFractionDigits: fractionDigits })
}

export default function CreatorFeesPage() {
  const [wallet, setWallet] = useState("")
  const [data, setData] = useState<CreatorFeesPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [claimingAll, setClaimingAll] = useState(false)
  const [claimingLaunch, setClaimingLaunch] = useState("")

  async function load(nextWallet?: string) {
    try {
      setLoading(true)
      await ensureBscTestnet()
      const activeWallet = nextWallet || await getAuthorizedWallet()
      setWallet(activeWallet)
      if (!activeWallet) {
        setData(null)
        return
      }
      const response = await fetch(`/api/creator-fees?issuer=${activeWallet}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || "创作者收益读取失败")
      }
      setData(payload as CreatorFeesPayload)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const collectibleLaunches = useMemo(
    () => data?.rows.filter((row) => row.canCollectLpFees).map((row) => row.launchAddress) ?? [],
    [data]
  )

  async function handleClaimAll() {
    if (collectibleLaunches.length === 0) {
      alert("当前没有可领取的 LP fee。")
      return
    }
    try {
      setClaimingAll(true)
      await collectAllPoolFeesTx(collectibleLaunches)
      await load(wallet)
      alert("全部待领取 LP fee 已处理完成。")
    } catch (error) {
      alert(error instanceof Error ? error.message : "批量领取失败")
    } finally {
      setClaimingAll(false)
    }
  }

  async function handleClaimLaunch(launchAddress: string) {
    try {
      setClaimingLaunch(launchAddress)
      await collectPoolFeesTx(launchAddress)
      await load(wallet)
      alert("该项目的 LP fee 已领取。")
    } catch (error) {
      alert(error instanceof Error ? error.message : "LP 收益领取失败")
    } finally {
      setClaimingLaunch("")
    }
  }

  return (
    <div className="container-shell py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title">创作者收益</h1>
          <p className="section-subtitle mt-3">
            展示项目方当前可追踪的收入来源。首发分账、NFT 市场收入和燃烧池收入会自动入账；领取按钮只会处理还没归集的 LP 收益。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={() => void load()}>{loading ? "刷新中..." : "刷新"}</button>
          <button className="btn-primary" disabled={claimingAll || collectibleLaunches.length === 0} onClick={() => void handleClaimAll()}>
            {claimingAll ? "领取中..." : `领取全部待领取收益${collectibleLaunches.length ? ` (${collectibleLaunches.length})` : ""}`}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
        已连接地址：{wallet || "未连接"}。如果某个口径没有收入，页面不会把它算进待领取列表；已经自动入账的部分只统计，不会重复领取。
      </div>

      {data?.summary.marketFeeBnb && Number(data.summary.marketFeeBnb) > 0 && data.rows.some((row) => row.marketFeeEstimated) ? (
        <div className="mt-4 rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-100">
          NFT 市场收入当前按链上 listing 状态推断已成交记录。对旧交易这已经足够接近真实值，但严格来说仍属于估算口径。
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="glass card">
          <div className="muted text-sm">首发分账</div>
          <div className="mt-2 text-3xl font-black">{formatAmount(data?.summary.launchShareBnb || "0")} BNB</div>
        </div>
        <div className="glass card">
          <div className="muted text-sm">市场手续费</div>
          <div className="mt-2 text-3xl font-black">{formatAmount(data?.summary.marketFeeBnb || "0")} BNB</div>
        </div>
        <div className="glass card">
          <div className="muted text-sm">燃烧池手续费</div>
          <div className="mt-2 text-3xl font-black">{formatAmount(data?.summary.burnPoolFeeBnb || "0")} BNB</div>
        </div>
        <div className="glass card">
          <div className="muted text-sm">自动入账合计</div>
          <div className="mt-2 text-3xl font-black">{formatAmount(data?.summary.autoSettledBnb || "0")} BNB</div>
        </div>
        <div className="glass card">
          <div className="muted text-sm">待领取 LP 收益</div>
          <div className="mt-2 text-3xl font-black">{formatAmount(data?.summary.claimableLpBnbEquivalent || "0")} BNB</div>
          <div className="muted mt-2 text-xs">
            + {formatAmount(data?.summary.claimableLpToken || "0", 2)} Token / {formatAmount(data?.summary.claimableLpBnb || "0")} WBNB
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="glass card">
          <div className="muted text-sm">可领取项目数</div>
          <div className="mt-2 text-3xl font-black">{data?.summary.collectibleLaunches || 0}</div>
        </div>
        <div className="glass card">
          <div className="muted text-sm">旧版锁仓阻塞</div>
          <div className="mt-2 text-3xl font-black">{data?.summary.blockedLegacyLaunches || 0}</div>
          <div className="muted mt-2 text-xs">旧版 locker 没记录 position token id，会导致 LP 收益暂时无法归集。</div>
        </div>
      </div>

      <div className="glass card mt-8">
        <div className="grid gap-4">
          {!wallet ? (
            <div className="text-slate-300">先连接项目方钱包后再查看收入面板。</div>
          ) : loading && !data ? (
            <div className="text-slate-300">读取链上收入数据中...</div>
          ) : !data || data.rows.length === 0 ? (
            <div className="text-slate-300">这个地址下还没有可统计的项目收入。</div>
          ) : (
            data.rows.map((row) => (
              <div key={row.launchAddress} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <img src={row.imageUri || "/images/project-placeholder.svg"} alt={row.name} className="h-14 w-14 rounded-2xl border border-white/10 object-cover" />
                      <div>
                        <div className="text-xl font-semibold">{row.name}</div>
                        <div className="muted text-sm">${row.symbol}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-slate-400">{row.launchAddress}</div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/projects/${row.launchAddress}`} className="btn-secondary">查看项目</Link>
                    <button
                      className="btn-primary"
                      disabled={!row.canCollectLpFees || claimingLaunch === row.launchAddress}
                      onClick={() => void handleClaimLaunch(row.launchAddress)}
                    >
                      {claimingLaunch === row.launchAddress ? "领取中..." : "领取该项目 LP 收益"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="muted text-xs">首发分账</div>
                    <div className="mt-2 text-lg font-bold">{formatAmount(row.launchShareBnb)} BNB</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="muted text-xs">市场手续费</div>
                    <div className="mt-2 text-lg font-bold">{formatAmount(row.marketFeeBnb)} BNB</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="muted text-xs">燃烧池手续费</div>
                    <div className="mt-2 text-lg font-bold">{formatAmount(row.burnPoolFeeBnb)} BNB</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="muted text-xs">已自动入账</div>
                    <div className="mt-2 text-lg font-bold">{formatAmount(row.autoSettledBnb)} BNB</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="muted text-xs">待领取 LP 收益</div>
                    <div className="mt-2 text-lg font-bold">{formatAmount(row.claimableLpBnbEquivalent)} BNB</div>
                    <div className="muted mt-2 text-xs">
                      + {formatAmount(row.claimableLpToken, 2)} Token / {formatAmount(row.claimableLpBnb)} WBNB
                    </div>
                  </div>
                </div>

                {row.legacyLockerMismatch ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                    这个项目使用的是旧版 locker。链上 position NFT 已经锁住，但 locker 没记录 position token id，所以 LP 收益暂时不能领取。
                  </div>
                ) : null}
                {!row.legacyLockerMismatch && row.lpCollectError && !row.canCollectLpFees ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
                    当前没有可领取的 LP fee，或者池子还没产生足够费用。
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
