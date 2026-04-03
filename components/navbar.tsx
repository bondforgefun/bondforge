"use client"

import Link from 'next/link'
import { navItems } from '@/lib/content'
import { useEffect, useState } from 'react'
import { clearWalletCache, connectWallet, ensureBscTestnet, getAuthorizedWallet, shortenAddress } from '@/lib/web3/client'

export function Navbar() {
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const existing = await getAuthorizedWallet()
      if (mounted) setAddress(existing)
    })()
    return () => {
      mounted = false
    }
  }, [])

  async function onConnect() {
    try {
      setBusy(true)
      await ensureBscTestnet()
      const account = await connectWallet()
      setAddress(account)
      setMenuOpen(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : '钱包连接失败')
    } finally {
      setBusy(false)
    }
  }

  function onDisconnect() {
    clearWalletCache()
    setAddress('')
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-[rgba(5,7,10,0.82)] backdrop-blur-xl">
      <div className="container-shell flex items-center justify-between gap-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/bondforge-bf.svg" alt="BondForge" className="h-11 w-11 rounded-[16px] shadow-[0_14px_28px_rgba(243,186,47,0.18)]" />
          <div>
            <div className="display-face text-lg font-bold">BondForge</div>
            <div className="muted text-xs">BSC NFT 发射与市场</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-slate-200 xl:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="muted transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="pill hidden px-3 py-2 text-xs md:inline-flex">BSC 测试网</div>
          {address ? (
            <div className="relative">
              <button className="btn-primary" onClick={() => setMenuOpen((value) => !value)} disabled={busy}>
                {shortenAddress(address)}
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-3 w-64 rounded-[24px] border border-white/10 bg-[rgba(10,14,18,0.98)] p-4 shadow-2xl">
                  <div className="muted px-1 pb-3 text-xs">当前已连接钱包</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100">
                    {address}
                  </div>
                  <button className="btn-secondary mt-3 w-full" onClick={onDisconnect}>断开连接</button>
                </div>
              ) : null}
            </div>
          ) : (
            <button className="btn-primary" onClick={onConnect} disabled={busy}>
              {busy ? '连接中...' : '连接钱包'}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
