import { faqs } from '@/lib/content'
import { SectionTitle } from '@/components/section-title'

export default function FaqPage() {
  return (
    <main className="container" style={{ padding: '54px 20px 0' }}>
      <SectionTitle
        eyebrow="FAQ"
        title="常见问题"
        description="这页面向公开测试站用户，重点解释 NFT 的分发时机、退款规则、燃烧池、项目详情页与 NFT 市场。"
      />
      <div style={{ display: 'grid', gap: 16 }}>
        {faqs.map((item, index) => (
          <details key={item.q} className="fold" open={index === 0}>
            <summary>{item.q}</summary>
            <div className="fold-body">{item.a}</div>
          </details>
        ))}
      </div>
    </main>
  )
}
