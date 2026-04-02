"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type RouteParams = Promise<{ address: string }>

type Project = {
  address: string
  name: string
  symbol: string
  ca: string
  description: string
  logo?: string
  banner?: string
  website?: string
  twitter?: string
  telegram?: string
  stage: "募集中" | "已发射" | "燃烧池已启用"
}

export default function ProjectDetailPage({
  params,
}: {
  params: RouteParams
}) {
  const [address, setAddress] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    params.then((p) => setAddress(p.address)).catch(() => setAddress(""))
  }, [params])

  const project = useMemo<Project | undefined>(() => {
    if (!address) return undefined
    return {
      address,
      name: "BondForge 测试项目",
      symbol: "BFGT",
      ca: address,
      description:
        "这是 BondForge BSC 测试网项目详情页。这里会展示项目资料、合约地址、社媒信息、认购入口、NFT 铸造与燃烧池入口。当前先用安全版页面保证构建通过，后续再继续接真实链上数据。",
      website: "https://www.bondforge.fun",
      twitter: "https://x.com",
      telegram: "https://t.me",
      stage: "募集中",
    }
  }, [address])

  async function copyCA() {
    if (!project?.ca) return
    try {
      await navigator.clipboard.writeText(project.ca)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  if (!project) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/70">
          正在读取项目地址...
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-white">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
            {project.stage}
          </div>
          <h1 className="text-3xl font-semibold">{project.name}</h1>
          <p className="mt-2 text-sm text-white/60">
            {project.symbol} · BSC Testnet
          </p>
        </div>

        <Link
          href="/market"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
        >
          前往 NFT 市场
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div className="h-48 w-full bg-gradient-to-r from-fuchsia-600/30 via-cyan-500/20 to-emerald-500/30" />
            <div className="p-6">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-lg font-semibold">
                  {project.symbol.slice(0, 2)}
                </div>
                <div>
                  <div className="text-xl font-semibold">{project.name}</div>
                  <div className="mt-1 text-sm text-white/60">
                    合约地址 / CA
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/40">
                  Contract Address
                </div>
                <div className="break-all text-sm text-white/80">{project.ca}</div>
                <button
                  type="button"
                  onClick={copyCA}
                  className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-medium text-black transition hover:opacity-90"
                >
                  {copied ? "已复制" : "复制 CA"}
                </button>
              </div>

              <p className="mt-4 leading-7 text-white/75">{project.description}</p>

              <div className="mt-6 flex flex-wrap gap-3">
                {project.website ? (
                  <a
                    href={project.website}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                  >
                    Website
                  </a>
                ) : null}
                {project.twitter ? (
                  <a
                    href={project.twitter}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                  >
                    X / Twitter
                  </a>
                ) : null}
                {project.telegram ? (
                  <a
                    href={project.telegram}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                  >
                    Telegram
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">项目说明</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InfoCard label="NFT 发放时机" value="项目打满并发射后统一分发 NFT" />
              <InfoCard label="退款费率" value="固定 1%" />
              <InfoCard label="网络" value="BSC Testnet" />
              <InfoCard label="燃烧池" value="支持，燃烧的 NFT 会进入燃烧池" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <ActionCard
            title="认购 / 发射"
            items={[
              "连接钱包",
              "自动切换 BSC 测试网",
              "认购项目",
              "满额后 Finalize",
            ]}
          />
          <ActionCard
            title="Swap"
            items={[
              "单项目页展示买卖入口",
              "后续接真实 BSC Testnet 合约",
            ]}
          />
          <ActionCard
            title="NFT / 燃烧池"
            items={[
              "发射成功后统一分发 NFT",
              "提前退出后 NFT 进入燃烧池",
              "后续接 ERC-721 市场合约",
            ]}
          />
        </div>
      </section>
    </main>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-2 text-sm text-white/85">{value}</div>
    </div>
  )
}

function ActionCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm text-white/75">
        {items.map((item) => (
          <li key={item} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
