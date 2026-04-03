export const factoryAbi = [
  'function getLaunches() view returns (address[])',
  'function owner() view returns (address)',
  'function create2Deployer() view returns (address)',
  'function positionManager() view returns (address)',
  'function marketplace() view returns (address)',
  'function swapRouter() view returns (address)',
  'function createLaunchWithSalt((string name,string symbol,string tokenName,string tokenSymbol,string description,string imageURI,string bannerURI,string website,string twitter,string telegram,string nftBaseURI,string memeImageURI,uint8 nftMode,uint256 mintPriceWei,uint256 nftSupply,uint16 walletCapBps,uint16 multipleBps,uint32 firstDelayMinutes,uint16 firstUnlockBps,uint32 secondDelayMinutes,uint16 secondUnlockBps,uint16 hourlyUnlockBps,uint16 day2To7DailyBps,uint16 postDay7DailyBps),bytes32 salt,bytes creationCode) returns (address)',
  'event LaunchCreated(address indexed launch,address indexed token,address indexed nft,address issuer,string name,string symbol)'
] as const

export const launchAbi = [
  'function projectCard() view returns (string,string,string,string,string,string,string,string,address,address,address,uint256,uint256,uint256,bool)',
  'function totalRaised() view returns (uint256)',
  'function totalSold() view returns (uint256)',
  'function nftSupply() view returns (uint256)',
  'function finalized() view returns (bool)',
  'function launchTime() view returns (uint256)',
  'function initialLiquidityNative() view returns (uint256)',
  'function initialLiquidityToken() view returns (uint256)',
  'function referencePricePerTokenWei() view returns (uint256)',
  'function pancakePool() view returns (address)',
  'function liquidityLocker() view returns (address)',
  'function marketplace() view returns (address)',
  'function swapRouter() view returns (address)',
  'function buybackNftVault() view returns (address)',
  'function buybackTokenVault() view returns (address)',
  'function wrappedNativeToken() view returns (address)',
  'function pancakePoolFee() view returns (uint24)',
  'function positionTokenId() view returns (uint256)',
  'function tokensPerNFT() view returns (uint256)',
  'function claimed(uint256) view returns (uint256)',
  'function firstDelayMinutes() view returns (uint32)',
  'function firstUnlockBps() view returns (uint16)',
  'function secondDelayMinutes() view returns (uint32)',
  'function secondUnlockBps() view returns (uint16)',
  'function hourlyUnlockBps() view returns (uint16)',
  'function day2To7DailyBps() view returns (uint16)',
  'function postDay7DailyBps() view returns (uint16)',
  'function reservationOf(address) view returns (uint256)',
  'function claimedReservations(address) view returns (uint256)',
  'function claimableNFTs(address) view returns (uint256)',
  'function mintPriceWei() view returns (uint256)',
  'function subscribe(uint256 quantity) payable',
  'function refund(uint256 quantity)',
  'function finalizeLaunch()',
  'function claimNFTs(uint256 quantity)',
  'function claimAllNFTs()',
  'function collectPoolFees() returns (uint256,uint256)',
  'function nftAddress() view returns (address)',
  'function tokenAddress() view returns (address)',
  'function burnPoolLength() view returns (uint256)',
  'function burnPoolTokenIdAt(uint256 index) view returns (uint256)',
  'function burnPoolItem(uint256 tokenId) view returns (uint256 remaining,uint256 price,bool active)',
  'function vestedBpsForToken(uint256 tokenId) view returns (uint256)',
  'function claim(uint256 tokenId)',
  'function claimMany(uint256[] tokenIds) returns (uint256 totalClaimedAmount)',
  'function burnToPool(uint256 tokenId)',
  'function buyFromBurnPool(uint256 tokenId) payable'
] as const

export const pancakePoolAbi = [
  'function liquidity() view returns (uint128)',
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)'
] as const

export const pancakeSwapRouterAbi = [
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
  'function multicall(bytes[] data) payable returns (bytes[] results)',
  'function unwrapWETH9(uint256 amountMinimum,address recipient) payable',
  'function refundETH() payable'
] as const

export const pancakeQuoterV2Abi = [
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)'
] as const

export const nftAbi = [
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function approve(address,uint256)',
  'function trackedHolders() view returns (address[] holders,uint256[] balances)',
  'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)'
] as const

export const tokenAbi = [
  'function approve(address,uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function trackedHolders() view returns (address[] holders,uint256[] balances)',
  'event Transfer(address indexed from,address indexed to,uint256 value)'
] as const

export const marketAbi = [
  'function nextId() view returns (uint256)',
  'function listings(uint256) view returns (uint256 id,address seller,address nft,address launch,uint256 tokenId,uint256 price,bool active)',
  'function createListing(address nft,address launch,uint256 tokenId,uint256 price)',
  'function buy(uint256 listingId) payable',
  'function cancelListing(uint256 listingId)',
  'function getListings() view returns ((uint256 id,address seller,address nft,address launch,uint256 tokenId,uint256 price,bool active)[])'
] as const

export const nftBuybackVaultAbi = [
  'function canExecuteBuyback() view returns (bool eligible,uint256 listingId,uint256 tokenId,uint256 price,uint256 wrappedBalance,uint256 requiredBalance)',
  'function executeBuyback() returns (uint256 listingId,uint256 tokenId,uint256 pricePaid,uint256 tokenBurned)'
] as const

export const tokenBuybackVaultAbi = [
  'function canExecuteBuyback() view returns (bool eligible,uint256 nativeToSpend)',
  'function executeBuyback(uint256 amountOutMinimum) returns (uint256 amountOut)'
] as const
