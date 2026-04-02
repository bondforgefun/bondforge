import Link from 'next/link'
import { SectionTitle } from '@/components/section-title'
import { marketItems } from '@/lib/content'

export default function MarketPage() {
  return (
    <main className="container" style={{ padding: '54px 20px 0' }}>
      <SectionTitle
        eyebrow="NFT Market"
        title="NFT 市场与燃烧池来源 NFT"
        description="这里统一展示 ERC-721 标准 NFT 的市场挂单。来自燃烧池的 NFT 也会在列表中标记来源，方便测试完整流转逻辑。"
      />
      <div className="grid-cards">
        {marketItems.map((item) => (
          <div key={item.id} className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <img src={item.projectLogo} alt={item.projectName} style={{ width: 52, height: 52, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }} />
              <div>
                <div style={{ fontWeight: 700 }}>{item.projectName}</div>
                <div style={{ color: '#9cadcf', fontSize: 13 }}>NFT #{item.tokenId}</div>
              </div>
            </div>
            <div className="kpi" style={{ marginTop: 16 }}>
              <div style={{ color: '#8ea0c8', fontSize: 13 }}>状态</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>{item.status}</div>
            </div>
            <div style={{ marginTop: 14, color: '#9cadcf', lineHeight: 1.7 }}>卖家：{item.seller}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>{item.price}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button className="btn-primary">购买 NFT</button>
              <Link href={`/projects/${item.projectAddress}`} className="btn-secondary">查看项目</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
