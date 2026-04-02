import { SectionTitle } from '@/components/section-title'
import { whitepaperSections } from '@/lib/content'

export default function WhitepaperPage() {
  return (
    <main className="container" style={{ padding: '54px 20px 0' }}>
      <SectionTitle
        eyebrow="Whitepaper"
        title="BondForge 白皮书"
        description="白皮书直接在站内阅读。当前重点是把 BSC 测试站的核心逻辑讲清楚：图片与资料录入、先认购后分发 NFT、固定 1% 退款费、初始释放计划、燃烧池与项目详情页。"
      />
      <div style={{ display: 'grid', gap: 16 }}>
        {whitepaperSections.map((section, index) => (
          <details key={section.title} className="fold" open={index === 0}>
            <summary>{section.title}</summary>
            <div className="fold-body">{section.body}</div>
          </details>
        ))}
      </div>
    </main>
  )
}
