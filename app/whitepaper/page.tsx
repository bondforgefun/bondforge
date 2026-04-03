import { SectionTitle } from '@/components/section-title'
import { whitepaperSections } from '@/lib/content'

export default function WhitepaperPage() {
  return (
    <div className="container-shell py-14">
      <SectionTitle title="平台说明" subtitle="这里用用户视角介绍 BondForge 的发射、仓位、交易、燃烧池和双回购路径，帮助你快速理解平台是如何运作的。" />
      <div className="grid-cards">
        {whitepaperSections.map((section) => (
          <details key={section.title} open className="glass card">
            <summary className="details-summary flex items-center justify-between gap-4">
              <div className="text-xl font-semibold">{section.title}</div>
              <span className="pill px-3 py-1 text-xs">展开 / 收起</span>
            </summary>
            <p className="mt-5 whitespace-pre-line leading-8 text-slate-300">{section.content}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
