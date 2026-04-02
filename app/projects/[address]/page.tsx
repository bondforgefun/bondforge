'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { getProjectByAddress } from '@/lib/content'

export default function ProjectDetailPage({ params }: { params: { address: string } }) {
  const project = useMemo(() => getProjectByAddress(params.address), [params.address])
  const [copied, setCopied] = useState(false)

  if (!project) {
    return (
      <main className="container" style={{ padding: '54px 20px 0' }}>
        <div className="card" style={{ padding: 28 }}>
          <h1 style={{ marginTop: 0 }}>项目不存在</h1>
          <p style={{ color: '#9cadcf' }}>当前测试站没有找到这个项目地址对应的数据。</p>
          <Link href="/" className="btn-primary">返回首页</Link>
        </div>
      </main>
    )
  }

  async function copyCA() {
    try {
      await navigator.clipboard.writeText(project.ca)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="container" style={{ padding: '54px 20px 0' }}>
      <section className="card" style={{ padding: 24, overflow: 'hidden' }}>
        <img src={project.banner} alt={project.name} className="project-cover" style={{ height: 240 }} />
        <div className="two-col" style={{ marginTop: 22 }}>
          <div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <img src={project.logo} alt={project.name} style={{ width: 78, height: 78, borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }} />
              <div>
                <div className="badge">{project.category}</div>
                <h1 style={{ margin: '10px 0 6px', fontSize: 38 }}>{project.name}</h1>
                <div style={{ color: '#9cadcf' }}>{project.symbol}</div>
              </div>
            </div>
            <p style={{ marginTop: 18, color: '#9cadcf', lineHeight: 1.8 }}>{project.description}</p>
            <div className="social-row" style={{ marginTop: 16 }}>
              {project.socials.map((social) => (
                <a key={social.label} href={social.href} target="_blank" className="social-chip">{social.label}</a>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 20, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ color: '#8ea0c8', fontSize: 13 }}>CA</div>
            <div style={{ marginTop: 10, lineHeight: 1.8, wordBreak: 'break-all' }}>{project.ca}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={copyCA}>{copied ? '已复制' : '复制 CA'}</button>
              <a className="btn-secondary" href={`https://testnet.bscscan.com/address/${project.ca}`} target="_blank">BscScan</a>
            </div>
            <div className="grid-cards" style={{ marginTop: 18 }}>
              <div className="kpi"><div className="small-note">价格</div><div style={{ marginTop: 6, fontWeight: 700 }}>{project.mintPrice}</div></div>
              <div className="kpi"><div className="small-note">Launch Multiple</div><div style={{ marginTop: 6, fontWeight: 700 }}>{project.launchMultiple}</div></div>
              <div className="kpi"><div className="small-note">钱包上限</div><div style={{ marginTop: 6, fontWeight: 700 }}>{project.walletCap}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="two-col" style={{ marginTop: 22 }}>
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>认购与退款</h2>
          <p className="small-note">募集阶段先拿到可退款认购凭证，不立即分发 NFT。项目打满并完成发射后，系统统一铸造并分发 NFT。</p>
          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', marginTop: 16 }}>
            <div className="kpi"><div className="small-note">募集进度</div><div style={{ marginTop: 6, fontWeight: 700 }}>{project.progress}%</div></div>
            <div className="kpi"><div className="small-note">认购凭证总量</div><div style={{ marginTop: 6, fontWeight: 700 }}>{project.receiptSupply}</div></div>
            <div className="kpi"><div className="small-note">募集窗口</div><div style={{ marginTop: 6, fontWeight: 700 }}>{project.saleWindow}</div></div>
            <div className="kpi"><div className="small-note">退款费</div><div style={{ marginTop: 6, fontWeight: 700 }}>1% 固定</div></div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            <button className="btn-primary">认购</button>
            <button className="btn-secondary">退款</button>
            <button className="btn-secondary">完成发射后分发 NFT</button>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>单项目 Swap 与 NFT 信息</h2>
          <div className="kpi"><div className="small-note">NFT 类型</div><div style={{ marginTop: 6, fontWeight: 700 }}>{project.nftMode}</div></div>
          <div className="kpi" style={{ marginTop: 12 }}><div className="small-note">单项目 Swap</div><div style={{ marginTop: 6, color: '#dfe6f7' }}>项目详情页保留单项目 swap 区块，用于买入 / 卖出当前项目代币。</div></div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            <button className="btn-primary">Buy Token</button>
            <button className="btn-secondary">Sell Token</button>
            <Link href="/market" className="btn-secondary">去 NFT 市场</Link>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 24, marginTop: 22 }}>
        <h2 style={{ marginTop: 0 }}>燃烧池</h2>
        <p className="small-note">提前退出并被送入燃烧池的 NFT 会显示在这里。进入燃烧池后会暂停后续释放，等待重新购买或处理。</p>
        <div className="grid-cards" style={{ marginTop: 16 }}>
          <div className="kpi"><div className="small-note">燃烧池 NFT 数量</div><div style={{ marginTop: 6, fontWeight: 700 }}>{project.burnPool.total}</div></div>
          <div className="kpi"><div className="small-note">当前燃烧池底价</div><div style={{ marginTop: 6, fontWeight: 700 }}>{project.burnPool.floorPrice}</div></div>
          <div className="kpi"><div className="small-note">处理方式</div><div style={{ marginTop: 6, fontWeight: 700 }}>折价重售 / 再流转</div></div>
        </div>
        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          {project.burnPool.entries.map((entry) => (
            <div key={entry.tokenId} className="card" style={{ padding: 18, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>NFT #{entry.tokenId}</div>
                  <div className="small-note">来源：{entry.source}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{entry.value}</div>
                  <div className="small-note">{entry.status}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
