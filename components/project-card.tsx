import Link from 'next/link'
import type { ProjectRecord } from '@/lib/content'

export function ProjectCard({ project }: { project: ProjectRecord }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <img src={project.banner} alt={project.name} className="project-cover" />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 16, marginBottom: 10 }}>
        <span className="badge">{project.category}</span>
        <span style={{ color: '#9cadcf', fontSize: 13 }}>{project.mintPrice}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <img src={project.logo} alt={project.name} style={{ width: 52, height: 52, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }} />
        <div>
          <h3 style={{ fontSize: 22, margin: 0 }}>{project.name}</h3>
          <div style={{ color: '#9cadcf', fontSize: 13 }}>{project.symbol} · CA: {project.ca.slice(0, 8)}...{project.ca.slice(-6)}</div>
        </div>
      </div>
      <p style={{ color: '#9cadcf', lineHeight: 1.7, minHeight: 68, marginTop: 12 }}>{project.summary}</p>
      <div className="social-row" style={{ marginTop: 12 }}>
        {project.socials.map((social) => (
          <a key={social.label} href={social.href} target="_blank" className="social-chip">{social.label}</a>
        ))}
      </div>
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#c8d2f2' }}>
          <span>募集进度</span>
          <span>{project.progress}%</span>
        </div>
        <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
          <div style={{ width: `${project.progress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #f3ba2f, #ffe08a)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <Link href={`/projects/${project.address}`} className="btn-primary">查看项目</Link>
        <Link href="/market" className="btn-secondary">NFT 市场</Link>
      </div>
    </div>
  )
}
