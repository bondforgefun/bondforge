import { faqs } from '@/lib/content'
import { SectionTitle } from '@/components/section-title'

export default function FaqPage() {
  return (
    <div className="container-shell py-14">
      <SectionTitle title="FAQ" subtitle="当前最常见的问题都整理在这里。" />
      <div className="grid-cards">
        {faqs.map((item) => (
          <details key={item.q} className="glass card">
            <summary className="details-summary text-lg font-semibold">{item.q}</summary>
            <p className="mt-4 leading-8 text-slate-300">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
