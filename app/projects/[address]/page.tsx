"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Contract, JsonRpcProvider, MaxUint256, formatEther } from 'ethers'
import { readProjectByAddress } from '@/lib/bondforge/read'
import { ProjectView } from '@/lib/bondforge/types'
import { getLocalMeta } from '@/lib/bondforge/local-meta'
import { PANCAKE_V3_QUOTER_V2, PANCAKE_V3_SWAP_ROUTER, RPC_URL } from '@/lib/bondforge/config'
import { launchAbi, nftAbi, pancakePoolAbi, pancakeQuoterV2Abi, pancakeSwapRouterAbi, tokenAbi } from '@/lib/bondforge/abi'
import { claimAllReservedNftsTx, finalizeLaunchTx, refundTx, subscribeTx } from '@/lib/bondforge/write'
import { createBrowserProvider, ensureBscTestnet, getAuthorizedWallet, shortenAddress, parseEther } from '@/lib/web3/client'

type HolderRow = {
  address: string
  rawAmount: bigint
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const SWAP_SLIPPAGE_BPS = 100n

type SwapSide = 'buy' | 'sell'

async function loadOwnedCount(nftAddress: string, wallet: string): Promise<number> {
  const provider = new JsonRpcProvider(RPC_URL)
  const nft = new Contract(nftAddress, nftAbi, provider)
  return Number(await nft.balanceOf(wallet))
}

async function loadHolderRows(contractAddress: string, abi: readonly string[]) {
  const provider = new JsonRpcProvider(RPC_URL)
  const contract = new Contract(contractAddress, abi, provider)
  const [holders, balances] = await contract.trackedHolders()
  return holders
    .map((holder: string, index: number) => ({
      address: holder,
      rawAmount: BigInt(balances[index].toString()),
    }))
    .filter((row: HolderRow) => row.rawAmount > 0n)
    .sort((a: HolderRow, b: HolderRow) => (a.rawAmount === b.rawAmount ? 0 : a.rawAmount > b.rawAmount ? -1 : 1))
}

function formatUnitsLabel(value: bigint, decimals: number, fractionDigits = 4) {
  if (decimals === 18) {
    return Number(formatEther(value)).toLocaleString("zh-CN", { maximumFractionDigits: fractionDigits })
  }
  const base = 10n ** BigInt(decimals)
  const whole = value / base
  const fraction = value % base
  if (fraction === 0n) return whole.toLocaleString("zh-CN")
  const padded = fraction.toString().padStart(decimals, '0').slice(0, fractionDigits).replace(/0+$/, '')
  return padded ? `${whole.toLocaleString("zh-CN")}.${padded}` : whole.toLocaleString("zh-CN")
}

function formatCompactNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString("zh-CN", { maximumFractionDigits })
}

function hasAddress(value: string) {
  return Boolean(value) && value.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
}

function bscScanAddressUrl(value: string) {
  return `https://testnet.bscscan.com/address/${value}`
}

function safeParseEther(value: string) {
  try {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = parseEther(trimmed)
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
}

function normalizeSwapError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('STF') || message.includes('TRANSFER_FROM_FAILED')) {
    return '卖出失败：钱包里的项目 Token 不足，或者 Router 授权还没完成。注意，锁在 NFT 里的额度不能直接卖，需要先领取到钱包。'
  }
  if (message.includes('insufficient funds')) {
    return '钱包余额不足，无法支付这笔交易的输入金额或 gas。'
  }
  return message
}

export default function ProjectDetailPage() {
  const params = useParams<{ address: string }>()
  const address = String(params.address || '')

  const [project, setProject] = useState<ProjectView | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [ownedCount, setOwnedCount] = useState(0)
  const [wallet, setWallet] = useState('')
  const [walletNativeBalance, setWalletNativeBalance] = useState<bigint>(0n)
  const [walletTokenBalance, setWalletTokenBalance] = useState<bigint>(0n)
  const [walletTokenAllowance, setWalletTokenAllowance] = useState<bigint>(0n)
  const [claimableNftCount, setClaimableNftCount] = useState(0)
  const [poolNativeReserve, setPoolNativeReserve] = useState<bigint>(0n)
  const [poolTokenReserve, setPoolTokenReserve] = useState<bigint>(0n)
  const [referencePriceWei, setReferencePriceWei] = useState<bigint>(0n)
  const [pancakePoolAddress, setPancakePoolAddress] = useState('')
  const [liquidityLocker, setLiquidityLocker] = useState('')
  const [wrappedNativeToken, setWrappedNativeToken] = useState('')
  const [positionTokenId, setPositionTokenId] = useState<bigint>(0n)
  const [poolLiquidity, setPoolLiquidity] = useState<bigint>(0n)
  const [poolTick, setPoolTick] = useState<number>(0)
  const [poolFeeTier, setPoolFeeTier] = useState<number>(0)
  const [swapSide, setSwapSide] = useState<SwapSide>('buy')
  const [swapAmount, setSwapAmount] = useState('')
  const [swapQuoteWei, setSwapQuoteWei] = useState<bigint>(0n)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [swapError, setSwapError] = useState('')
  const [tokenHolders, setTokenHolders] = useState<HolderRow[]>([])
  const [nftHolders, setNftHolders] = useState<HolderRow[]>([])
  const [copiedKey, setCopiedKey] = useState('')
  const [busyAction, setBusyAction] = useState('')

  const totalCostWei = useMemo(() => {
    if (!project) return 0n
    const price = parseEther(project.mintPriceLabel.replace(' BNB', ''))
    return price * BigInt(quantity)
  }, [project, quantity])
  const isSoldOut = project ? project.totalSold >= project.totalSupply : false
  const swapAmountWei = useMemo(() => safeParseEther(swapAmount), [swapAmount])
  const minSwapOutWei = useMemo(() => {
    if (swapQuoteWei <= 0n) return 0n
    return (swapQuoteWei * (10_000n - SWAP_SLIPPAGE_BPS)) / 10_000n
  }, [swapQuoteWei])
  const hasEnoughSwapBalance = useMemo(() => {
    if (!swapAmountWei) return false
    return swapSide === 'buy' ? walletNativeBalance >= swapAmountWei : walletTokenBalance >= swapAmountWei
  }, [swapAmountWei, swapSide, walletNativeBalance, walletTokenBalance])
  const sellNeedsApproval = useMemo(() => {
    if (swapSide !== 'sell' || !swapAmountWei) return false
    return walletTokenAllowance < swapAmountWei
  }, [swapAmountWei, swapSide, walletTokenAllowance])
  const soldPercent = useMemo(() => {
    if (!project || project.totalSupply === 0) return 0
    return Math.min(100, (project.totalSold / project.totalSupply) * 100)
  }, [project])

  async function copyText(key: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(''), 1200)
  }

  async function loadPageState(nextProject?: ProjectView) {
    const data = nextProject ?? await readProjectByAddress(address)
    if (!data) return

    const provider = new JsonRpcProvider(RPC_URL)
    const launch = new Contract(address, launchAbi, provider)
    const token = new Contract(data.tokenAddress, tokenAbi, provider)
    const local = getLocalMeta(address)

    setProject({
      ...data,
      imageUri: local?.imageDataUrl || data.imageUri,
      bannerUri: local?.bannerDataUrl || data.bannerUri,
    })

    const [poolAddress, lockerAddress, wrappedNative, positionId, refPrice, feeTier] = await Promise.all([
      launch.pancakePool().catch(() => ZERO_ADDRESS),
      launch.liquidityLocker().catch(() => ZERO_ADDRESS),
      launch.wrappedNativeToken().catch(() => ZERO_ADDRESS),
      launch.positionTokenId().catch(() => 0n),
      launch.referencePricePerTokenWei().catch(() => 0n),
      launch.pancakePoolFee().catch(() => 0),
    ])

    const poolAddressString = String(poolAddress)
    const wrappedNativeString = String(wrappedNative)
    setPancakePoolAddress(poolAddressString)
    setLiquidityLocker(String(lockerAddress))
    setWrappedNativeToken(wrappedNativeString)
    setPositionTokenId(BigInt(positionId.toString()))
    setReferencePriceWei(BigInt(refPrice.toString()))
    setPoolFeeTier(Number(feeTier))

    if (hasAddress(poolAddressString) && hasAddress(wrappedNativeString)) {
      const pool = new Contract(poolAddressString, pancakePoolAbi, provider)
      const wrappedNativeContract = new Contract(wrappedNativeString, tokenAbi, provider)
      const [poolLiquidityValue, slot0, nativeReserve, tokenReserve] = await Promise.all([
        pool.liquidity().catch(() => 0n),
        pool.slot0().catch(() => [0n, 0] as const),
        wrappedNativeContract.balanceOf(poolAddressString).catch(() => 0n),
        token.balanceOf(poolAddressString).catch(() => 0n),
      ])
      setPoolLiquidity(BigInt(poolLiquidityValue.toString()))
      setPoolTick(Number(slot0[1] ?? 0))
      setPoolNativeReserve(BigInt(nativeReserve.toString()))
      setPoolTokenReserve(BigInt(tokenReserve.toString()))
    } else {
      setPoolLiquidity(0n)
      setPoolTick(0)
      setPoolNativeReserve(0n)
      setPoolTokenReserve(0n)
    }

    const walletSaved = typeof window !== 'undefined' ? await getAuthorizedWallet() : ''
    setWallet(walletSaved)
    if (walletSaved) {
      const [count, nativeBalance, tokenBalance, claimableNfts] = await Promise.all([
        loadOwnedCount(data.nftAddress, walletSaved),
        provider.getBalance(walletSaved),
        token.balanceOf(walletSaved),
        launch.claimableNFTs(walletSaved).catch(() => 0n),
      ])
      const allowance = await token.allowance(walletSaved, PANCAKE_V3_SWAP_ROUTER).catch(() => 0n)
      setOwnedCount(count)
      setWalletNativeBalance(BigInt(nativeBalance.toString()))
      setWalletTokenBalance(BigInt(tokenBalance.toString()))
      setWalletTokenAllowance(BigInt(allowance.toString()))
      setClaimableNftCount(Number(claimableNfts))
    } else {
      setOwnedCount(0)
      setWalletNativeBalance(0n)
      setWalletTokenBalance(0n)
      setWalletTokenAllowance(0n)
      setClaimableNftCount(0)
    }

    const [tokenRows, nftRows] = await Promise.all([
      loadHolderRows(data.tokenAddress, tokenAbi).catch(() => []),
      loadHolderRows(data.nftAddress, nftAbi).catch(() => []),
    ])
    setTokenHolders(tokenRows.slice(0, 20))
    setNftHolders(nftRows.slice(0, 20))
  }

  useEffect(() => {
    void loadPageState()
  }, [address])

  useEffect(() => {
    let cancelled = false
    const amountIn = swapAmountWei
    const currentProject = project
    if (!currentProject || !hasAddress(wrappedNativeToken) || !hasAddress(pancakePoolAddress) || !poolFeeTier || !amountIn) {
      setSwapQuoteWei(0n)
      setSwapError('')
      setQuoteBusy(false)
      return
    }

    setQuoteBusy(true)
    setSwapError('')
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const provider = new JsonRpcProvider(RPC_URL)
          const quoter = new Contract(PANCAKE_V3_QUOTER_V2, pancakeQuoterV2Abi, provider)
          const tokenIn = swapSide === 'buy' ? wrappedNativeToken : currentProject.tokenAddress
          const tokenOut = swapSide === 'buy' ? currentProject.tokenAddress : wrappedNativeToken
          const quote = await quoter.quoteExactInputSingle.staticCall({
            tokenIn,
            tokenOut,
            amountIn,
            fee: poolFeeTier,
            sqrtPriceLimitX96: 0,
          })
          if (cancelled) return
          setSwapQuoteWei(BigInt(quote[0].toString()))
        } catch (error) {
          if (cancelled) return
          setSwapQuoteWei(0n)
          setSwapError(error instanceof Error ? error.message : '报价读取失败')
        } finally {
          if (!cancelled) setQuoteBusy(false)
        }
      })()
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [project, wrappedNativeToken, pancakePoolAddress, poolFeeTier, swapSide, swapAmountWei])

  async function handleSubscribe() {
    try {
      setBusyAction('subscribe')
      const result = await subscribeTx(address, quantity, totalCostWei)
      await loadPageState()
      if (result.finalizeError) {
        alert(`认购成功，但项目发射还没有完成：${result.finalizeError}`)
      } else if (result.finalizeResult?.finalizedNow) {
        alert('认购成功，项目已满额并完成发射。池子已经初始化，接下来请领取你的 NFT。')
      } else if (result.finalizeResult?.alreadyFinalized) {
        alert('认购成功，项目已完成发射。')
      } else if (result.finalizeResult?.soldOut) {
        alert('认购成功，项目已满额，系统正在处理发射与加池。')
      } else {
        alert('认购成功')
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '认购失败')
    } finally {
      setBusyAction('')
    }
  }

  async function handleFinalizeRetry() {
    try {
      setBusyAction('finalize')
      const result = await finalizeLaunchTx(address)
      await loadPageState()
      if (result.finalizedNow) {
        alert('项目已完成发射，池子已经初始化。接下来请领取你的 NFT。')
      } else if (result.alreadyFinalized) {
        alert('项目已经完成发射。')
      } else if (result.soldOut) {
        alert('项目已满额，但发射流程还没有完成，请稍后再试。')
      } else {
        alert('项目还没有达到发射条件。')
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '重试发射失败')
    } finally {
      setBusyAction('')
    }
  }

  async function handleClaimAllNfts() {
    try {
      setBusyAction('claim-nfts')
      await claimAllReservedNftsTx(address)
      await loadPageState()
      alert('NFT 已领取到你的钱包。')
    } catch (error) {
      alert(error instanceof Error ? error.message : '领取 NFT 失败')
    } finally {
      setBusyAction('')
    }
  }

  async function handleRefundAction() {
    try {
      setBusyAction('refund')
      await refundTx(address, quantity)
      await loadPageState()
      alert('退款已提交。')
    } catch (error) {
      alert(error instanceof Error ? error.message : '退款失败')
    } finally {
      setBusyAction('')
    }
  }

  async function handleSwap() {
    const currentProject = project
    if (!currentProject || !swapAmountWei || !hasAddress(wrappedNativeToken) || !poolFeeTier) return
    try {
      setBusyAction('swap')
      setSwapError('')
      await ensureBscTestnet()
      const provider = createBrowserProvider()
      if (!provider) throw new Error('未检测到钱包扩展')
      const signer = await provider.getSigner()
      const signerAddress = await signer.getAddress()
      const router = new Contract(PANCAKE_V3_SWAP_ROUTER, pancakeSwapRouterAbi, signer)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20)

      if (swapSide === 'buy') {
        const liveNativeBalance = await provider.getBalance(signerAddress)
        if (BigInt(liveNativeBalance.toString()) < swapAmountWei) {
          throw new Error('钱包 BNB 余额不足，无法完成买入。')
        }
        const exactInputCalldata = router.interface.encodeFunctionData('exactInputSingle', [{
          tokenIn: wrappedNativeToken,
          tokenOut: currentProject.tokenAddress,
          fee: poolFeeTier,
          recipient: signerAddress,
          deadline,
          amountIn: swapAmountWei,
          amountOutMinimum: minSwapOutWei,
          sqrtPriceLimitX96: 0,
        }])
        const refundCalldata = router.interface.encodeFunctionData('refundETH')
        const tx = await router.multicall([exactInputCalldata, refundCalldata], { value: swapAmountWei })
        await tx.wait()
      } else {
        const token = new Contract(currentProject.tokenAddress, tokenAbi, signer)
        const liveTokenBalance = await token.balanceOf(signerAddress)
        if (BigInt(liveTokenBalance.toString()) < swapAmountWei) {
          throw new Error('钱包里的项目 Token 余额不足，无法卖出这么多。')
        }
        const allowance = await token.allowance(signerAddress, PANCAKE_V3_SWAP_ROUTER)
        if (BigInt(allowance.toString()) < swapAmountWei) {
          const approveTx = await token.approve(PANCAKE_V3_SWAP_ROUTER, MaxUint256)
          await approveTx.wait()
          setWalletTokenAllowance(MaxUint256)
          alert('授权完成，现在可以继续卖出了。')
          return
        }
        const exactInputCalldata = router.interface.encodeFunctionData('exactInputSingle', [{
          tokenIn: currentProject.tokenAddress,
          tokenOut: wrappedNativeToken,
          fee: poolFeeTier,
          recipient: PANCAKE_V3_SWAP_ROUTER,
          deadline,
          amountIn: swapAmountWei,
          amountOutMinimum: minSwapOutWei,
          sqrtPriceLimitX96: 0,
        }])
        const unwrapCalldata = router.interface.encodeFunctionData('unwrapWETH9', [minSwapOutWei, signerAddress])
        const tx = await router.multicall([exactInputCalldata, unwrapCalldata])
        await tx.wait()
      }

      await loadPageState()
      setSwapAmount('')
      setSwapQuoteWei(0n)
      alert(swapSide === 'buy' ? '买入完成' : '卖出完成')
    } catch (error) {
      const friendlyMessage = normalizeSwapError(error)
      setSwapError(friendlyMessage)
      alert(friendlyMessage)
    } finally {
      setBusyAction('')
    }
  }

  if (!project) {
    return <div className="container-shell py-20"><div className="glass card">读取项目中...</div></div>
  }

  return (
    <div className="container-shell py-14">
      <section className="glass hero-panel overflow-hidden rounded-[34px] border border-white/10">
        <img src={project.bannerUri || project.imageUri || '/images/banner-placeholder.svg'} alt={project.name} className="h-64 w-full object-cover opacity-70" />
        <div className="relative -mt-20 p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <img src={project.imageUri || '/images/project-placeholder.svg'} alt={project.name} className="h-28 w-28 rounded-[28px] border-4 border-[#0a0f14] object-cover shadow-2xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="eyebrow">{project.finalized ? '已发射' : isSoldOut ? '待发射' : '募集中'}</span>
                  <span className="pill px-3 py-1 text-xs">{project.symbol}</span>
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-5xl">{project.name}</h1>
                <p className="muted mt-3 max-w-3xl text-base leading-7">{project.description || '暂无项目简介'}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  {project.website ? <a className="pill px-4 py-2" href={project.website} target="_blank" rel="noreferrer">官网</a> : null}
                  {project.twitter ? <a className="pill px-4 py-2" href={project.twitter} target="_blank" rel="noreferrer">X</a> : null}
                  {project.telegram ? <a className="pill px-4 py-2" href={project.telegram} target="_blank" rel="noreferrer">社群</a> : null}
                  <a className="pill px-4 py-2" href={bscScanAddressUrl(address)} target="_blank" rel="noreferrer">BscScan</a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="copy-chip" onClick={() => void copyText('launch', address)}>
                项目地址 {copiedKey === 'launch' ? '已复制' : shortenAddress(address)}
              </button>
              <button className="copy-chip" onClick={() => void copyText('token', project.tokenAddress)}>
                Token {copiedKey === 'token' ? '已复制' : shortenAddress(project.tokenAddress)}
              </button>
              <button className="copy-chip" onClick={() => void copyText('nft', project.nftAddress)}>
                NFT {copiedKey === 'nft' ? '已复制' : shortenAddress(project.nftAddress)}
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-5">
            <div className="stat-tile">
              <div className="muted text-sm">认购价格</div>
              <div className="stat-value">{project.mintPriceLabel}</div>
            </div>
            <div className="stat-tile">
              <div className="muted text-sm">募资进度</div>
              <div className="stat-value">{formatCompactNumber(soldPercent, 1)}%</div>
            </div>
            <div className="stat-tile">
              <div className="muted text-sm">已售 / 总量</div>
              <div className="stat-value">{formatCompactNumber(project.totalSold, 0)} / {formatCompactNumber(project.totalSupply, 0)}</div>
            </div>
            <div className="stat-tile">
              <div className="muted text-sm">当前持有 NFT</div>
              <div className="stat-value">{ownedCount}</div>
            </div>
            <div className="stat-tile">
              <div className="muted text-sm">待领取 NFT</div>
              <div className="stat-value">{claimableNftCount}</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#f3ba2f,#ffe08a)]" style={{ width: `${soldPercent}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-10 grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="grid gap-6">
          <section className="glass card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="section-kicker">概览</div>
                <h2 className="text-2xl font-bold">项目总览</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="muted text-xs uppercase tracking-[0.18em]">发行模型</div>
                <div className="mt-3 text-lg font-semibold">固定价格 NFT 发射</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="muted text-xs uppercase tracking-[0.18em]">流动性来源</div>
                <div className="mt-3 text-lg font-semibold">PancakeSwap V3</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="muted text-xs uppercase tracking-[0.18em]">NFT 领取方式</div>
                <div className="mt-3 text-lg font-semibold">发射后用户自领</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="muted text-xs uppercase tracking-[0.18em]">锁仓模型</div>
                <div className="mt-3 text-lg font-semibold">Locker 托管</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="muted text-xs uppercase tracking-[0.18em]">筹资规模</div>
                <div className="mt-3 text-lg font-semibold">{formatCompactNumber(project.totalRaised, 4)} BNB</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="muted text-xs uppercase tracking-[0.18em]">项目状态</div>
                <div className="mt-3 text-lg font-semibold">{project.finalized ? '已发射可交易' : isSoldOut ? '满额待发射' : '募集中'}</div>
              </div>
            </div>
          </section>

          <section className="glass card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="section-kicker">流动性</div>
                <h2 className="text-2xl font-bold">池子与即时交换</h2>
                <p className="muted mt-3 text-sm">这里把项目池子状态、钱包余额和项目内嵌交换放到同一个工作区里，更接近成熟交易页的布局。</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {hasAddress(pancakePoolAddress) ? (
                  <a className="btn-secondary" href={bscScanAddressUrl(pancakePoolAddress)} target="_blank" rel="noreferrer">查看池子</a>
                ) : (
                  <button className="btn-secondary" disabled>池子初始化中</button>
                )}
                {hasAddress(liquidityLocker) ? (
                  <a className="btn-secondary" href={bscScanAddressUrl(liquidityLocker)} target="_blank" rel="noreferrer">查看 Locker</a>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="muted text-xs uppercase tracking-[0.18em]">池内 BNB</div>
                <div className="mt-3 text-2xl font-bold">{formatUnitsLabel(poolNativeReserve, 18)} BNB</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="muted text-xs uppercase tracking-[0.18em]">池内 Token</div>
                <div className="mt-3 text-2xl font-bold">{formatUnitsLabel(poolTokenReserve, 18)} {project.symbol}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="muted text-xs uppercase tracking-[0.18em]">钱包 BNB</div>
                <div className="mt-3 text-2xl font-bold">{formatUnitsLabel(walletNativeBalance, 18)} BNB</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="muted text-xs uppercase tracking-[0.18em]">钱包 Token</div>
                <div className="mt-3 text-2xl font-bold">{formatUnitsLabel(walletTokenBalance, 18)} {project.symbol}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-slate-300">
                <div className="muted text-xs uppercase tracking-[0.18em]">池子地址</div>
                <div className="mt-2 font-mono text-white">{hasAddress(pancakePoolAddress) ? shortenAddress(pancakePoolAddress) : '待初始化'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-slate-300">
                <div className="muted text-xs uppercase tracking-[0.18em]">锁仓地址</div>
                <div className="mt-2 font-mono text-white">{hasAddress(liquidityLocker) ? shortenAddress(liquidityLocker) : '待初始化'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-slate-300">
                <div className="muted text-xs uppercase tracking-[0.18em]">仓位 NFT</div>
                <div className="mt-2 font-semibold text-white">{positionTokenId > 0n ? positionTokenId.toString() : '待初始化'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-slate-300">
                <div className="muted text-xs uppercase tracking-[0.18em]">费率 / Tick</div>
                <div className="mt-2 text-white">{poolFeeTier ? `${poolFeeTier / 10000}% / ${poolTick}` : '待初始化'}</div>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-black/15 px-5 py-4 text-sm text-slate-300">
              参考价格：{referencePriceWei > 0n ? `${formatUnitsLabel(referencePriceWei, 18, 8)} BNB / Token` : '待池子初始化'} · 活跃流动性：{poolLiquidity.toString()}
            </div>

            <div className="mt-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,22,32,0.96),rgba(8,12,18,0.96))] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-bold">即时交换</div>
                  <div className="muted mt-2 text-sm">直接在项目页完成 BNB 和 {project.symbol} 的买卖，不需要跳去外部页面。</div>
                </div>
                <div className="flex gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                  <button className={swapSide === 'buy' ? 'btn-primary' : 'btn-secondary'} onClick={() => setSwapSide('buy')}>买入 {project.symbol}</button>
                  <button className={swapSide === 'sell' ? 'btn-primary' : 'btn-secondary'} onClick={() => setSwapSide('sell')}>卖出 {project.symbol}</button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_80px_1fr]">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="muted text-xs uppercase tracking-[0.18em]">{swapSide === 'buy' ? '支付金额（BNB）' : `支付金额（${project.symbol}）`}</div>
                    <button
                      className="text-sm text-amber-100"
                      onClick={() => {
                        const maxValue = swapSide === 'buy'
                          ? walletNativeBalance > 0n
                            ? (walletNativeBalance * 95n) / 100n
                            : 0n
                          : walletTokenBalance
                        setSwapAmount(maxValue > 0n ? Number(formatEther(maxValue)).toString() : '')
                      }}
                    >
                      最大
                    </button>
                  </div>
                  <input
                    className="field mt-4 text-2xl"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={swapAmount}
                    onChange={(event) => setSwapAmount(event.target.value)}
                  />
                  <div className="muted mt-3 text-sm">
                    钱包余额：{swapSide === 'buy' ? `${formatUnitsLabel(walletNativeBalance, 18)} BNB` : `${formatUnitsLabel(walletTokenBalance, 18)} ${project.symbol}`}
                  </div>
                  {swapSide === 'sell' ? (
                    <div className="muted mt-2 text-sm">
                      Router 授权：{walletTokenAllowance > 0n ? `${formatUnitsLabel(walletTokenAllowance, 18)} ${project.symbol}` : '未授权'}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-center text-3xl text-slate-500">⇄</div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="muted text-xs uppercase tracking-[0.18em]">{swapSide === 'buy' ? `预计收到（${project.symbol}）` : '预计收到（BNB）'}</div>
                  <div className="mt-4 text-3xl font-bold">{swapQuoteWei > 0n ? formatUnitsLabel(swapQuoteWei, 18, 6) : '0'}</div>
                  <div className="muted mt-3 text-sm">
                    最少收到：{minSwapOutWei > 0n ? formatUnitsLabel(minSwapOutWei, 18, 6) : '0'} {swapSide === 'buy' ? project.symbol : 'BNB'}
                  </div>
                  <div className="muted mt-2 text-sm">滑点保护：1% · 手续费档位：{poolFeeTier ? `${poolFeeTier / 10000}%` : '待初始化'}</div>
                </div>
              </div>

              {swapSide === 'sell' && walletTokenBalance === 0n ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-slate-300">
                  钱包里还没有可卖出的 {project.symbol}。如果额度还锁在 NFT 里，需要先去资产页领取可解锁部分，或直接燃烧 NFT。
                </div>
              ) : null}

              {swapError ? (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {swapError}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="btn-primary"
                  disabled={
                    busyAction === 'swap' ||
                    quoteBusy ||
                    !wallet ||
                    !project.finalized ||
                    !hasAddress(pancakePoolAddress) ||
                    !swapAmountWei ||
                    !hasEnoughSwapBalance ||
                    swapQuoteWei <= 0n
                  }
                  onClick={() => void handleSwap()}
                >
                  {busyAction === 'swap'
                    ? '交换中...'
                    : quoteBusy
                      ? '报价中...'
                      : swapSide === 'sell' && sellNeedsApproval
                        ? `先授权 ${project.symbol}`
                        : swapSide === 'buy'
                          ? `用 BNB 买入 ${project.symbol}`
                          : `卖出 ${project.symbol} 换 BNB`}
                </button>
                {!wallet ? <div className="muted self-center text-sm">先连接钱包后才能直接交易。</div> : null}
                {!project.finalized ? <div className="muted self-center text-sm">项目完成发射并加池后才可交易。</div> : null}
                {wallet && swapAmountWei && !hasEnoughSwapBalance ? (
                  <div className="muted self-center text-sm">
                    {swapSide === 'buy' ? '钱包 BNB 余额不足。' : `钱包 ${project.symbol} 余额不足。`}
                  </div>
                ) : null}
                {wallet && swapSide === 'sell' && swapAmountWei && hasEnoughSwapBalance && sellNeedsApproval ? (
                  <div className="muted self-center text-sm">首次卖出需要先授权 Router 使用你的 {project.symbol}。</div>
                ) : null}
                {hasAddress(wrappedNativeToken) ? (
                  <button className="btn-secondary" onClick={() => void copyText('wbnb', wrappedNativeToken)}>
                    {copiedKey === 'wbnb' ? '已复制 WBNB' : '复制 WBNB'}
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="glass card">
            <div className="section-kicker">Holders</div>
            <h2 className="text-2xl font-bold">持有人概览</h2>
            <p className="muted mt-3 text-sm">只展示当前链上维护的前 20 个活跃地址。左边看 Token，右边看 NFT，方便快速判断仓位分布。</p>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-lg font-semibold">Token 持有人</div>
                  <span className="pill px-3 py-1 text-xs">{tokenHolders.length} 个地址</span>
                </div>
                <div className="grid gap-3">
                  {tokenHolders.length === 0 ? <div className="text-slate-300">暂无 Token 持有人数据。</div> : tokenHolders.map((holder) => (
                    <div key={`token-${holder.address}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm">
                      <span className="font-mono text-slate-300">{shortenAddress(holder.address)}</span>
                      <span className="font-semibold text-white">{formatUnitsLabel(holder.rawAmount, 18)} {project.symbol}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-lg font-semibold">NFT 持有人</div>
                  <span className="pill px-3 py-1 text-xs">{nftHolders.length} 个地址</span>
                </div>
                <div className="grid gap-3">
                  {nftHolders.length === 0 ? <div className="text-slate-300">暂无 NFT 持有人数据。</div> : nftHolders.map((holder) => (
                    <div key={`nft-${holder.address}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm">
                      <span className="font-mono text-slate-300">{shortenAddress(holder.address)}</span>
                      <span className="font-semibold text-white">{holder.rawAmount.toString()} 张 NFT</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="grid gap-6 xl:sticky xl:top-24 xl:self-start">
          <section className="glass card">
            <div className="section-kicker">操作面板</div>
            <h2 className="text-2xl font-bold">{project.finalized ? '项目状态与领取' : '认购与发射'}</h2>
            <p className="muted mt-3 text-sm">
              {project.finalized
                ? '项目已经完成发射。当前页会显示待领取 NFT 数量；NFT 解锁、Token 领取与挂单统一在 Dashboard 管理。'
                : isSoldOut
                  ? '项目已经打满，下一步是执行 finalize：初始化池子、锁定仓位 NFT，并开始全局解锁计时。'
                  : '募集阶段先获得可退款认购凭证。项目打满后会自动发射并立即加池，随后再按份额领取对应数量的 NFT。'}
            </p>

            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                已持有 <span className="font-semibold text-white">{ownedCount}</span> 张 NFT
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                待领取 <span className="font-semibold text-white">{claimableNftCount}</span> 张 NFT
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                项目状态：<span className="font-semibold text-white">{project.finalized ? '已发射' : isSoldOut ? '已满额待发射' : '募集中'}</span>
              </div>
            </div>

            {project.finalized ? (
              <div className="mt-5 grid gap-3">
                {claimableNftCount > 0 ? (
                  <button className="btn-primary" disabled={busyAction === 'claim-nfts'} onClick={() => void handleClaimAllNfts()}>
                    {busyAction === 'claim-nfts' ? '领取中...' : `领取全部 ${claimableNftCount} 张 NFT`}
                  </button>
                ) : (
                  <button className="btn-secondary" disabled>当前没有待领取 NFT</button>
                )}
                <Link href="/dashboard" className="btn-secondary">前往我的仓位</Link>
              </div>
            ) : isSoldOut ? (
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  当前募集已经满额，下一步不是继续认购，而是完成发射：初始化 Pancake 池、锁定仓位 NFT，并启动发射后的全局解锁。
                </div>
                <button className="btn-primary" disabled={busyAction === 'finalize'} onClick={() => void handleFinalizeRetry()}>
                  {busyAction === 'finalize' ? '发射中...' : '重试自动发射'}
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                <div>
                  <label className="label">认购数量</label>
                  <input className="field" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  应付总价：<span className="font-semibold text-white">{Number(formatEther(totalCostWei)).toFixed(4)} BNB</span>
                </div>
                <button className="btn-primary" disabled={busyAction === 'subscribe'} onClick={() => void handleSubscribe()}>
                  {busyAction === 'subscribe' ? '认购中...' : '立即认购'}
                </button>
                <button className="btn-secondary" disabled={busyAction === 'refund'} onClick={() => void handleRefundAction()}>
                  {busyAction === 'refund' ? '退款中...' : '按当前数量退款'}
                </button>
              </div>
            )}
          </section>

          <section className="glass card">
            <div className="section-kicker">交易提示</div>
            <h2 className="text-2xl font-bold">交易提示</h2>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                锁在 NFT 里的额度不等于钱包里的可卖 Token。卖出前需要先从 NFT 仓位里领取到钱包。
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                项目只有在发射并完成加池后，右侧的即时交换面板才会真正可用。
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                如果项目已满额但还没发射，可以直接在本页点击“重试自动发射”进行补救。
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
