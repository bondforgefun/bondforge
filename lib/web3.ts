export const BSC_TESTNET = {
  chainId: '0x61',
  chainName: 'BNB Smart Chain Testnet',
  nativeCurrency: {
    name: 'tBNB',
    symbol: 'tBNB',
    decimals: 18,
  },
  rpcUrls: ['https://data-seed-prebsc-1-s1.bnbchain.org:8545'],
  blockExplorerUrls: ['https://testnet.bscscan.com'],
}

export async function switchToBscTestnet() {
  if (typeof window === 'undefined') return false
  const ethereum = (window as Window & { ethereum?: any }).ethereum
  if (!ethereum) return false
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_TESTNET.chainId }],
    })
    return true
  } catch (error: any) {
    if (error?.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [BSC_TESTNET],
      })
      return true
    }
    throw error
  }
}

export async function connectWallet() {
  if (typeof window === 'undefined') return null
  const ethereum = (window as Window & { ethereum?: any }).ethereum
  if (!ethereum) return null
  await switchToBscTestnet()
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
  return accounts?.[0] ?? null
}

declare global {
  interface Window {
    ethereum?: any
  }
}
