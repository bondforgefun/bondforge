import './globals.css'
import type { Metadata } from 'next'
import { Noto_Sans_SC, Space_Grotesk } from 'next/font/google'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'

const bodyFont = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-body',
})

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'BondForge | NFT 发射与市场',
  description: 'BondForge 提供认购、发射、NFT 市场与燃烧池体验，核心机制为多段释放与 Token LP Fee、NFT 版权费双回购。',
  icons: {
    icon: '/bondforge-bf.svg?v=2',
    shortcut: '/bondforge-bf.svg?v=2',
    apple: '/bondforge-bf.svg?v=2',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <div className="page-shell">
          <Navbar />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
