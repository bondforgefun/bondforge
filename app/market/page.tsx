"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Contract, JsonRpcProvider, formatEther } from "ethers"
import { marketAbi } from "@/lib/bondforge/abi"
import { MARKETPLACE_ADDRESS, RPC_URL } from "@/lib/bondforge/config"
import { readProjects } from "@/lib/bondforge/read"
import { buyListingTx, cancelListingTx } from "@/lib/bondforge/write"
import { getAuthorizedWallet, shortenAddress } from "@/lib/web3/client"

type Listing = { id: bigint; seller: string; nft: string; launch: string; tokenId: bigint; price: bigint; active: boolean }

function formatBnb(value: bigint) {
  return Number(formatEther(value)).toLocaleString("zh-CN", { maximumFractionDigits: 4 })
}

export default function MarketPage() {
  const [rows, setRows] = useState<Listing[]>([])
  const [wallet, setWallet] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [projectMeta, setProjectMeta] = useState<Record<string, { name: string; symbol: string; imageUri: string }>>({})

  async function load() {
    if (!MARKETPLACE_ADDRESS) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const provider = new JsonRpcProvider(RPC_URL)
      const market = new Contract(MARKETPLACE_ADDRESS, marketAbi, provider)
      const list = (await market.getListings()) as Listing[]
      setRows(list.filter((row) => row.active))
      const projects = await readProjects()
      setProjectMeta(
        Object.fromEntries(
          projects.map((project) => [
            project.launchAddress.toLowerCase(),
            { name: project.name, symbol: project.symbol, imageUri: project.imageUri },
          ])
        )
      )
      const saved = await getAuthorizedWallet()
      if (saved) setWallet(saved)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, Listing[]>()
    for (const row of rows) {
      const key = row.launch.toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    return Array.from(map.entries())
      .map(([launch, listings]) => {
        const sorted = [...listings].sort((a, b) => (a.price === b.price ? 0 : a.price < b.price ? -1 : 1))
        const prices = sorted.map((item) => item.price)
        return {
          launch,
          listings: sorted,
          floorPrice: prices[0] ?? 0n,
          topPrice: prices[prices.length - 1] ?? 0n,
          sellerCount: new Set(listings.map((item) => item.seller.toLowerCase())).size,
        }
      })
      .sort((a, b) => a.floorPrice === b.floorPrice ? b.listings.length - a.listings.length : a.floorPrice < b.floorPrice ? -1 : 1)
  }, [rows])

  const summary = useMemo(() => {
    const uniqueSellers = new Set(rows.map((row) => row.seller.toLowerCase())).size
    const floorPrice = rows.reduce<bigint | null>((current, row) => {
      if (current === null || row.price < current) return row.price
      return current
    }, null)
    return {
      activeProjects: grouped.length,
      activeListings: rows.length,
      uniqueSellers,
      floorPrice,
    }
  }, [grouped.length, rows])

  async function handleBuy(listing: Listing) {
    try {
      setBusyId(`buy-${listing.id.toString()}`)
      await buyListingTx(listing.id, listing.price)
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : "买入失败")
    } finally {
      setBusyId("")
    }
  }

  async function handleCancel(listing: Listing) {
    try {
      setBusyId(`cancel-${listing.id.toString()}`)
      await cancelListingTx(listing.id)
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : "取消挂单失败")
    } finally {
      setBusyId("")
    }
  }

  return (
    <div className="container-shell py-14">
      <section className="glass card hero-panel">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <span className="eyebrow">二级市场</span>
            <h1 className="mt-6 text-5xl font-bold leading-[0.96] md:text-6xl">按项目聚合查看 NFT 挂单</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              市场页优先展示项目层信息，再展开查看单张 NFT 仓位。这样新用户先理解这个项目值不值得看，再决定要不要点进具体挂单。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/launch" className="btn-secondary">发布新项目</Link>
            <button className="btn-primary" onClick={() => void load()}>{loading ? "刷新中..." : "刷新市场"}</button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="stat-tile">
            <div className="muted text-sm">活跃项目</div>
            <div className="stat-value">{summary.activeProjects}</div>
          </div>
          <div className="stat-tile">
            <div className="muted text-sm">活跃挂单</div>
            <div className="stat-value">{summary.activeListings}</div>
          </div>
          <div className="stat-tile">
            <div className="muted text-sm">独立卖家</div>
            <div className="stat-value">{summary.uniqueSellers}</div>
          </div>
          <div className="stat-tile">
            <div className="muted text-sm">全市场地板价</div>
            <div className="stat-value">{summary.floorPrice === null ? "—" : `${formatBnb(summary.floorPrice)} BNB`}</div>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-white/8 bg-black/15 px-5 py-4 text-sm leading-7 text-slate-300">
          成交后卖家会自动完成收益分账；买家进入项目详情页后，还能继续查看池子深度、即时交换和对应 NFT 的解锁逻辑。
        </div>
      </section>

      <section className="mt-8 grid gap-6">
        {loading ? (
          <div className="glass card text-slate-300">读取市场挂单中...</div>
        ) : grouped.length === 0 ? (
          <div className="glass card text-slate-300">当前没有活跃挂单，等第一批 NFT 仓位进入市场后会显示在这里。</div>
        ) : (
          grouped.map((group) => {
            const meta = projectMeta[group.launch]
            return (
              <details key={group.launch} className="glass card overflow-hidden" open>
                <summary className="details-summary flex cursor-pointer list-none items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <img
                      src={meta?.imageUri || "/images/project-placeholder.svg"}
                      alt={meta?.name || group.launch}
                      className="h-20 w-20 rounded-[22px] border border-white/10 object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-2xl font-semibold">{meta?.name || shortenAddress(group.launch)}</div>
                        <span className="pill px-3 py-1 text-xs">{meta?.symbol || "未命名"}</span>
                      </div>
                      <div className="muted mt-2 text-sm">项目地址 {shortenAddress(group.launch)} · {group.listings.length} 个在售仓位</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/projects/${group.launch}`} className="btn-secondary">查看项目</Link>
                  </div>
                </summary>

                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="muted text-xs uppercase tracking-[0.18em]">地板价</div>
                    <div className="mt-3 text-2xl font-bold">{formatBnb(group.floorPrice)} BNB</div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="muted text-xs uppercase tracking-[0.18em]">最高挂单</div>
                    <div className="mt-3 text-2xl font-bold">{formatBnb(group.topPrice)} BNB</div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="muted text-xs uppercase tracking-[0.18em]">活跃卖家</div>
                    <div className="mt-3 text-2xl font-bold">{group.sellerCount}</div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="muted text-xs uppercase tracking-[0.18em]">仓位数量</div>
                    <div className="mt-3 text-2xl font-bold">{group.listings.length}</div>
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-[26px] border border-white/10 bg-black/20">
                  <div className="hidden grid-cols-[1fr_140px_160px_200px] gap-4 border-b border-white/8 px-5 py-4 text-xs uppercase tracking-[0.18em] text-slate-400 md:grid">
                    <div>仓位信息</div>
                    <div>挂单价格</div>
                    <div>卖家</div>
                    <div className="text-right">操作</div>
                  </div>

                  <div className="grid">
                    {group.listings.map((row, index) => {
                      const isSeller = wallet && row.seller.toLowerCase() === wallet.toLowerCase()
                      const buyBusy = busyId === `buy-${row.id.toString()}`
                      const cancelBusy = busyId === `cancel-${row.id.toString()}`
                      return (
                        <div
                          key={String(row.id)}
                          className={`grid gap-4 px-5 py-5 md:grid-cols-[1fr_140px_160px_200px] md:items-center ${index !== group.listings.length - 1 ? "border-b border-white/8" : ""}`}
                        >
                          <div className="min-w-0">
                            <div className="text-lg font-semibold">NFT #{row.tokenId.toString()}</div>
                            <div className="muted mt-1 text-sm">挂单编号 #{row.id.toString()}</div>
                          </div>
                          <div>
                            <div className="muted text-xs md:hidden">挂单价格</div>
                            <div className="text-xl font-bold">{formatBnb(row.price)} BNB</div>
                          </div>
                          <div>
                            <div className="muted text-xs md:hidden">卖家</div>
                            <div className="font-mono text-sm text-slate-300">{shortenAddress(row.seller)}</div>
                          </div>
                          <div className="flex justify-start md:justify-end">
                            {isSeller ? (
                              <button className="btn-danger" disabled={cancelBusy} onClick={() => void handleCancel(row)}>
                                {cancelBusy ? "取消中..." : "取消挂单"}
                              </button>
                            ) : (
                              <button className="btn-primary" disabled={buyBusy} onClick={() => void handleBuy(row)}>
                                {buyBusy ? "买入中..." : "立即买入"}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </details>
            )
          })
        )}
      </section>
    </div>
  )
}
