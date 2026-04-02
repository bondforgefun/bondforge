export default function ContactPage() {
  return (
    <main className="container" style={{ padding: '54px 20px 0' }}>
      <div className="card" style={{ padding: 28 }}>
        <span className="badge">Contact</span>
        <h1 style={{ fontSize: 40, margin: '16px 0 12px' }}>联系 BondForge</h1>
        <p style={{ color: '#9cadcf', lineHeight: 1.8, maxWidth: 760 }}>
          公开测试站当前保留官方联系入口、社媒入口与网络信息。后续可以继续替换为真实表单、工单系统或项目方入驻流程。
        </p>
        <div className="grid-cards" style={{ marginTop: 24 }}>
          <div className="card" style={{ padding: 20, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ color: '#95a6cc', fontSize: 13 }}>X / Twitter</div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>@bondforgefun</div>
          </div>
          <div className="card" style={{ padding: 20, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ color: '#95a6cc', fontSize: 13 }}>Email</div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>hello@bondforge.fun</div>
          </div>
          <div className="card" style={{ padding: 20, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ color: '#95a6cc', fontSize: 13 }}>Network</div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>BSC Testnet</div>
          </div>
        </div>
      </div>
    </main>
  )
}
