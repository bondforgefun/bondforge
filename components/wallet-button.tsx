'use client'

import { useEffect, useState } from 'react'
import { connectWallet, switchToBscTestnet } from '@/lib/web3'

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function WalletButton() {
  const [account, setAccount] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ethereum = typeof window !== 'undefined' ? window.ethereum : undefined
    if (!ethereum) return

    ethereum.request({ method: 'eth_accounts' })
      .then(async (accounts: string[]) => {
        if (accounts?.[0]) {
          setAccount(accounts[0])
          try {
            await switchToBscTestnet()
          } catch {
            // ignore
          }
        }
      })
      .catch(() => undefined)
  }, [])

  async function onConnect() {
    try {
      setLoading(true)
      const addr = await connectWallet()
      if (addr) setAccount(addr)
    } finally {
      setLoading(false)
    }
  }

  if (account) {
    return (
      <button className="btn-primary" disabled>
        {short(account)} · BSC Testnet
      </button>
    )
  }

  return (
    <button className="btn-primary" onClick={onConnect} disabled={loading}>
      {loading ? '连接中...' : '连接钱包'}
    </button>
  )
}
