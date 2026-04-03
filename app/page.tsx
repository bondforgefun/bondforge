import Link from 'next/link'
import { heroStats } from '@/lib/content'
import { readProjects } from '@/lib/bondforge/read'
import { ProjectCard } from '@/components/project-card'
import { SectionTitle } from '@/components/section-title'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const productPillars = [
  {
    title: '多段释放',
    body: '每个项目都可以配置多段释放曲线，用首段释放、分时递进和长尾解锁来管理初期抛压。',
  },
  {
    title: '双回购模型',
    body: 'LP Fee 会回购地板 NFT 并送入燃烧池，NFT 版税会回购项目 Token 并直接销毁，让发射后的现金流继续作用在仓位和流通量上。',
  },
  {
    title: 'NFT 承接权益',
    body: 'NFT 负责承接释放、燃烧池和二级流转，把“仓位”而不是“碎片余额”作为用户理解和交易的核心单位。',
  },
]

const workflow = [
  '创建项目并上传视觉素材',
  '用户按固定价格认购',
  '项目打满后自动发射与加池',
  '用户领取 NFT、按多段释放解锁并参与回购体系',
]

export default async function HomePage() {
  const projects = await readProjects()

  return (
    <div className="container-shell py-10 md:py-14">
      <section className="hero-grid">
        <div className="glass card hero-panel">
          <span className="eyebrow">BSC 公测中</span>
          <h1 className="mt-6 text-5xl font-bold leading-[0.94] md:text-7xl">
            多段释放与双回购驱动的
            <br />
            NFT 发射市场
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            在 BondForge，认购、发射、加池、NFT 仓位、燃烧池和二级流转都围绕同一套经济结构展开。项目发射后立即开始多段释放，LP Fee 会回购地板 NFT，NFT 版税会回购项目 Token 并销毁，让持有、交易和接手仓位都更容易理解。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/launch" className="btn-primary">立即发布项目</Link>
            <Link href="/market" className="btn-secondary">进入 NFT 市场</Link>
            <Link href="/whitepaper" className="btn-secondary">查看平台说明</Link>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {workflow.map((item, index) => (
              <div key={item} className="panel-soft p-4">
                <div className="muted text-xs uppercase tracking-[0.2em]">步骤 0{index + 1}</div>
                <div className="mt-3 text-lg font-semibold">{item}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="glass card">
            <div className="section-kicker">核心参数</div>
            <div className="grid gap-4 sm:grid-cols-2">
              {heroStats.map((item) => (
                <div key={item.label} className="stat-tile">
                  <div className="muted text-sm">{item.label}</div>
                  <div className="stat-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass card">
            <div className="section-kicker">产品原则</div>
            <div className="grid gap-4">
              {productPillars.map((item) => (
                <div key={item.title} className="panel-soft p-5">
                  <div className="text-xl font-semibold">{item.title}</div>
                  <p className="muted mt-3 text-sm leading-7">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-20 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="glass card">
          <SectionTitle
            title="围绕发射、交易与持有体验设计"
            subtitle="首页只保留最关键的入口和判断信息，让第一次进入的用户也能迅速知道去哪里认购、去哪里交易，以及如何管理自己的 NFT 仓位。"
          />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="panel-soft p-5">
              <div className="muted text-xs uppercase tracking-[0.2em]">Subscribe</div>
              <div className="mt-3 text-xl font-semibold">认购与发射</div>
              <p className="muted mt-3 text-sm leading-7">固定价格认购、打满自动加池，并从发射那一刻开始进入释放周期。</p>
            </div>
            <div className="panel-soft p-5">
              <div className="muted text-xs uppercase tracking-[0.2em]">Trade</div>
              <div className="mt-3 text-xl font-semibold">市场流转</div>
              <p className="muted mt-3 text-sm leading-7">NFT 版权费和市场流转共同参与协议现金流，形成回购来源之一。</p>
            </div>
            <div className="panel-soft p-5">
              <div className="muted text-xs uppercase tracking-[0.2em]">Manage</div>
              <div className="mt-3 text-xl font-semibold">仓位与收益</div>
              <p className="muted mt-3 text-sm leading-7">领取、解锁、燃烧、挂单和收益归集都集中在资产页里完成。</p>
            </div>
          </div>
        </div>

        <div className="glass card">
          <div className="section-kicker">快速入口</div>
          <div className="grid gap-4">
            <Link href="/dashboard" className="panel-soft p-5 transition-transform hover:-translate-y-1">
              <div className="text-xl font-semibold">我的仓位</div>
              <p className="muted mt-3 text-sm leading-7">查看已领取 NFT、解锁进度、可燃烧额度和挂单操作。</p>
            </Link>
            <Link href="/burn-pool" className="panel-soft p-5 transition-transform hover:-translate-y-1">
              <div className="text-xl font-semibold">燃烧池市场</div>
              <p className="muted mt-3 text-sm leading-7">寻找提前退出的 NFT 仓位，用折扣价格接手剩余释放权益。</p>
            </Link>
            <Link href="/whitepaper" className="panel-soft p-5 transition-transform hover:-translate-y-1">
              <div className="text-xl font-semibold">平台说明</div>
              <p className="muted mt-3 text-sm leading-7">快速了解发射流程、NFT 仓位、双回购来源和提前退出机制。</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-20">
        <SectionTitle
          title="正在测试中的项目"
          subtitle="项目卡直接展示认购价格、募资进度、Token 与 NFT 合约地址。进入详情页后可以继续查看池子、Swap、燃烧池和 NFT 数据。"
        />
        <div className="grid-cards">
          {projects.length > 0 ? (
            projects.map((project) => <ProjectCard key={project.launchAddress} project={project} />)
          ) : (
            <div className="glass card text-center text-slate-300">
              链上项目正在准备中，新的认购机会出现后会展示在这里。
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
