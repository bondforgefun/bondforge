import Link from 'next/link'

export function Footer() {
  return (
    <footer style={{ marginTop: 80, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="container" style={{ padding: '28px 20px 60px', color: '#93a1c3', display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: 8 }}>BondForge</div>
          <div>BSC 测试网公开测试站 · NFT 驱动发射平台</div>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <Link href="/launch">发布项目</Link>
          <Link href="/market">NFT 市场</Link>
          <Link href="/whitepaper">白皮书</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">联系</Link>
        </div>
      </div>
    </footer>
  )
}
