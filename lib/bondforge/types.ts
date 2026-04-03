export type ProjectView = {
  launchAddress: string
  tokenAddress: string
  nftAddress: string
  issuer: string
  name: string
  symbol: string
  description: string
  imageUri: string
  bannerUri: string
  website: string
  twitter: string
  telegram: string
  mintPriceLabel: string
  progressLabel: string
  totalRaised: number
  totalSold: number
  totalSupply: number
  finalized: boolean
}

export type LaunchLocalMeta = {
  imageDataUrl?: string
  bannerDataUrl?: string
  nftMode?: 'own-metadata' | 'uniform-meme'
}
