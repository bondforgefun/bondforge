import { SectionTitle } from '@/components/section-title'

export default function DashboardPage() {
  return (
    <main className="container" style={{ padding: '54px 20px 0' }}>
      <SectionTitle
        eyebrow="Dashboard"
        title="钱包控制台"
        description="控制台按完整测试站逻辑拆分：认购凭证、待分发 NFT、已分发 NFT、可领取资产、燃烧池记录与创建者项目管理。"
      />
      <div className="grid-cards">
        {[
          ['认购凭证', '项目募集期间，钱包里先显示可退款认购凭证，而不是 NFT。'],
          ['待分发 NFT', '项目完成发射后，系统会统一铸造并分发 NFT。'],
          ['已分发 NFT', 'NFT 到账后，这里会显示 NFT 数量、项目归属与状态。'],
          ['可领取资产', '按初始释放计划与后续节奏展示当前可领取数量。'],
          ['燃烧池记录', '提前退出并送入燃烧池的 NFT 会在这里记录。'],
          ['创建者项目管理', '创建者可以管理项目资料、查看进度与发射状态。'],
        ].map(([t, d]) => (
          <div key={t} className="card" style={{ padding: 24 }}>
            <h3 style={{ marginTop: 0 }}>{t}</h3>
            <p style={{ color: '#98a8cb', lineHeight: 1.75 }}>{d}</p>
            <button className="btn-secondary">测试站保留入口</button>
          </div>
        ))}
      </div>
    </main>
  )
}
