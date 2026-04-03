import Link from 'next/link'

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/6 py-14">
      <div className="container-shell footer-grid">
        <div>
          <div className="flex items-center gap-3">
            <img src="/bondforge-bf.svg" alt="BondForge" className="h-11 w-11 rounded-[16px] shadow-[0_14px_28px_rgba(243,186,47,0.18)]" />
            <div>
              <div className="display-face text-xl font-bold">BondForge</div>
              <div className="muted text-sm">多段释放与双回购驱动的 NFT 发射市场</div>
            </div>
          </div>
          <p className="muted mt-5 max-w-xl text-sm leading-7">
            认购、发射、交易、燃烧和收益归集都围绕同一套仓位逻辑展开。核心机制是多段释放，以及由 Token LP Fee 和 NFT 版权费共同驱动的双回购。
          </p>
        </div>

        <div>
          <div className="section-kicker">产品</div>
          <div className="grid gap-3 text-sm">
            <Link href="/launch" className="footer-link">发布项目</Link>
            <Link href="/market" className="footer-link">NFT 市场</Link>
            <Link href="/dashboard" className="footer-link">我的仓位</Link>
            <Link href="/creator-fees" className="footer-link">创作者收益</Link>
          </div>
        </div>

        <div>
          <div className="section-kicker">文档</div>
          <div className="grid gap-3 text-sm">
            <Link href="/whitepaper" className="footer-link">平台说明</Link>
            <Link href="/faq" className="footer-link">常见问题</Link>
            <Link href="/contact" className="footer-link">联系团队</Link>
            <Link href="/burn-pool" className="footer-link">燃烧池</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
