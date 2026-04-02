export function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <span className="badge">{eyebrow}</span>
      <h2 style={{ fontSize: 34, margin: '14px 0 10px' }}>{title}</h2>
      <p style={{ color: '#99a6c7', lineHeight: 1.8, maxWidth: 760 }}>{description}</p>
    </div>
  )
}
