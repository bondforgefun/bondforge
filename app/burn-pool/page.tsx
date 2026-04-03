"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Contract, JsonRpcProvider, formatEther } from "ethers"
import { launchAbi } from "@/lib/bondforge/abi"
import { RPC_URL } from "@/lib/bondforge/config"
import { readProjects } from "@/lib/bondforge/read"
import { buyBurnPoolTx } from "@/lib/bondforge/write"

type BurnPoolCard = {
  launch: string
  tokenId: bigint
  priceWei: bigint
  remaining: bigint
  imageUri: string
  name: string
  symbol: string
}

export default function BurnPoolPage() {
  const [items, setItems] = useState<BurnPoolCard[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState("")

  async function load() {
    try {
      setLoading(true)
      const projects = await readProjects()
      const provider = new JsonRpcProvider(RPC_URL)
      const nextItems: BurnPoolCard[] = []

      for (const project of projects) {
        const launch = new Contract(project.launchAddress, launchAbi, provider)
        const length = Number(await launch.burnPoolLength())
        for (let index = 0; index < length; index += 1) {
          const tokenId = (await launch.burnPoolTokenIdAt(index)) as bigint
          const item = await launch.burnPoolItem(tokenId)
          if (item[2]) {
            nextItems.push({
              launch: project.launchAddress,
              tokenId,
              remaining: item[0],
              priceWei: item[1],
              imageUri: project.imageUri,
              name: project.name,
              symbol: project.symbol,
            })
          }
        }
      }

      setItems(nextItems)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleBuy(item: BurnPoolCard) {
    try {
      const key = `${item.launch}-${item.tokenId.toString()}`
      setBusyKey(key)
      await buyBurnPoolTx(item.launch, item.tokenId, item.priceWei)
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : "买入失败")
    } finally {
      setBusyKey("")
    }
  }

  return (
    <div className="container-shell py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title">燃烧池</h1>
          <p className="section-subtitle mt-3">这里汇总所有提前退出并送入燃烧池的 NFT。买入后，剩余未释放权益会继续跟着这张 NFT 走。</p>
        </div>
        <button className="btn-secondary" onClick={() => void load()}>{loading ? "刷新中..." : "刷新燃烧池"}</button>
      </div>

      <div className="mt-8 grid-cards">
        {loading ? (
          <div className="glass card text-slate-300">读取中...</div>
        ) : items.length === 0 ? (
          <div className="glass card text-slate-300">当前没有 NFT 在燃烧池里。</div>
        ) : (
          items.map((item) => {
            const key = `${item.launch}-${item.tokenId.toString()}`
            return (
              <div key={key} className="glass card">
                <div className="flex flex-wrap items-start gap-5">
                  <img src={item.imageUri || "/images/project-placeholder.svg"} alt={item.name} className="h-24 w-24 rounded-3xl border border-white/10 object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-2xl font-bold">{item.name}</div>
                        <div className="muted mt-1 text-sm">${item.symbol} · NFT #{item.tokenId.toString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="muted text-xs">当前价格</div>
                        <div className="text-2xl font-black">{Number(formatEther(item.priceWei)).toFixed(4)} BNB</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href={`/projects/${item.launch}`} className="btn-secondary">查看项目</Link>
                      <button className="btn-primary" disabled={busyKey === key} onClick={() => void handleBuy(item)}>
                        {busyKey === key ? "买入中..." : "买入燃烧池 NFT"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
