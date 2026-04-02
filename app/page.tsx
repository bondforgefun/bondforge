import Link from 'next/link'
import { metrics, featuredProjects } from '@/lib/content'
import { ProjectCard } from '@/components/project-card'
import { SectionTitle } from '@/components/section-title'

export default function HomePage() {
  return (
    <main>
      <section className="container" style={{ padding: '72px 20px 34px' }}>
        <div className="card" style={{ padding: 34, overflow: 'hidden' }}>
          <span className="badge">BondForge · BSC 公测中</span>
          <h1 style={{ fontSize: 54, lineHeight: 1.08, maxWidth: 860, margin: '18px 0 14px' }}>
            NFT 驱动的 Meme 发射平台
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.85, color: '#a6b3d1', maxWidth: 860 }}>
            BondForge 面向 BSC 测试网，支持项目上传图片、填写资料、固定价格认购、发射后统一分发 NFT、初始释放计划、燃烧池与单项目详情页。
            募资阶段先获得可退款的认购凭证，打满后再统一铸造并分发 NFT。
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 22 }}>
            <Link href="/launch" className="btn-primary">发布项目</Link>
            <Link href="/whitepaper" className="btn-secondary">查看白皮书</Link>
          </div>
          <div className="grid-cards" style={{ marginTop: 26 }}>
            {metrics.map((item) => (
              <div key={item.label} className="card" style={{ padding: 20, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ color: '#8ea0c8', fontSize: 13 }}>{item.label}</div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: '24px 20px 0' }}>
        <SectionTitle
          eyebrow="发射流程"
          title="先认购，后分发 NFT"
          description="这版测试站按你 Sol 侧的节奏表达：募集阶段先发可退款认购凭证；项目打满并完成发射后，再统一铸造并分发 NFT；之后 NFT 承接释放与燃烧池逻辑。"
        />
        <div className="grid-cards">
          {[
            ['上传图片与资料', '创建项目时需要填写项目头像、横幅、描述、社媒、NFT 类型与释放参数。'],
            ['固定价格认购', '所有用户同价认购，退款费固定 1%，募资期内先拿认购凭证。'],
            ['发射后统一分发 NFT', '项目满额并完成发射后统一铸造 NFT，再承接后续释放与二级市场流转。'],
          ].map(([t, d]) => (
            <div key={t} className="card" style={{ padding: 22 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 22 }}>{t}</h3>
              <p style={{ color: '#9cadcf', lineHeight: 1.75 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: '44px 20px 0' }}>
        <SectionTitle
          eyebrow="测试项目"
          title="项目卡片会展示图片、社媒和 CA"
          description="公开测试站的项目卡片会直接展示图片、名称、社媒与合约地址摘要，详情页里可以复制 CA、查看燃烧池、NFT 市场与单项目 swap 区块。"
        />
        <div className="grid-cards">
          {featuredProjects.map((project) => <ProjectCard key={project.address} project={project} />)}
        </div>
      </section>
    </main>
  )
}
