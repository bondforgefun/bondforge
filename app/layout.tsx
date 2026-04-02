import type { Metadata } from 'next'
import './globals.css'
import { site } from '@/lib/content'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'

export const metadata: Metadata = {
  title: site.title,
  description: site.description,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  )
}
