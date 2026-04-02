import Link from 'next/link'
import { navItems, site } from '@/lib/content'
import { WalletButton } from '@/components/wallet-button'

export function Navbar() {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,13,20,0.72)' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, minHeight: 76 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/" style={{ fontWeight: 900, letterSpacing: 0.2, fontSize: 22 }}>{site.name}</Link>
          <span className="badge">BSC Testnet</span>
        </div>
        <nav style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} style={{ color: '#cdd6ef', fontSize: 14 }}>
              {item.label}
            </Link>
          ))}
          <WalletButton />
        </nav>
      </div>
    </header>
  )
}
