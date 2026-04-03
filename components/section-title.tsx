export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <div className="section-kicker">BondForge</div>
      <h2 className="section-title">{title}</h2>
      {subtitle ? <p className="section-subtitle mt-3 text-base">{subtitle}</p> : null}
    </div>
  )
}
