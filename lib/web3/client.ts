import { BrowserProvider, formatEther, parseEther } from 'ethers'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}

export const BSC_TESTNET = {
  chainId: '0x61',
  chainName: 'BSC Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: ['https://data-seed-prebsc-1-s1.bnbchain.org:8545'],
  blockExplorerUrls: ['https://testnet.bscscan.com'],
}

export function createBrowserProvider() {
  if (typeof window === 'undefined' || !window.ethereum) return null
  return new BrowserProvider(window.ethereum)
}

export async function ensureBscTestnet() {
  if (typeof window === 'undefined' || !window.ethereum) throw new Error('未检测到钱包扩展')
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_TESTNET.chainId }] })
  } catch (error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error ? Number((error as { code: unknown }).code) : 0
    if (code === 4902) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [BSC_TESTNET] })
    } else {
      throw error instanceof Error ? error : new Error('切换到 BSC Testnet 失败')
    }
  }
}

export async function connectWallet() {
  if (typeof window === 'undefined' || !window.ethereum) throw new Error('未检测到钱包扩展')
  const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[]
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('bondforge:walletDisconnected', '0')
    if (accounts[0]) window.localStorage.setItem('bondforge:lastWallet', accounts[0])
  }
  return accounts[0] || ''
}

export async function getAuthorizedWallet() {
  if (typeof window === 'undefined' || !window.ethereum) return ''
  if (window.localStorage.getItem('bondforge:walletDisconnected') === '1') return ''
  const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[]
  return accounts[0] || ''
}

export function clearWalletCache() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem('bondforge:lastWallet')
  window.localStorage.setItem('bondforge:walletDisconnected', '1')
}

export function markWalletConnected(address: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('bondforge:walletDisconnected', '0')
  window.localStorage.setItem('bondforge:lastWallet', address)
}

export async function getConnectedAddress() {
  const provider = createBrowserProvider()
  if (!provider) return ''
  const signer = await provider.getSigner()
  return signer.address
}

export function shortenAddress(value: string) {
  if (!value) return '--'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export function formatNative(value: bigint | string) {
  try { return `${Number(formatEther(value)).toFixed(4)} BNB` } catch { return '0 BNB' }
}

export { parseEther }
