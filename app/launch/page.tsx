"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { parseEther } from "@/lib/web3/client"
import { createLaunchTx } from "@/lib/bondforge/write"
import { saveLocalMeta } from "@/lib/bondforge/local-meta"
import { defaultVesting } from "@/lib/content"

const TOTAL_TOKEN_SUPPLY = 1_000_000_000
const NFT_SUPPLY_PRESETS = [100, 500, 1000, 5000] as const
const MULTIPLE_PRESETS = [1.5, 2, 3] as const
const WALLET_CAP_PRESETS = ["no-cap", "2", "5", "custom"] as const
const MIN_MULTIPLE = 1.5
const MAX_MULTIPLE = 5
const MIN_RULE_MINUTES = 10
const MAX_RULE_MINUTES = 1_051_200
const RULE_SLIDER_STEPS = 1000
const RULE_TIME_PRESETS = [1440, 10080, 43200, 525600] as const

type VestingPresetKey = "standard" | "diamond" | "quick" | "custom"
type ReleaseRule = {
  pct: number
  minutes: number
}

const VESTING_PRESETS: Record<Exclude<VestingPresetKey, "custom">, { label: string; description: string; rules: ReleaseRule[] }> = {
  standard: {
    label: "标准释放",
    description: "适合常规发射节奏，7 天内逐步释放",
    rules: [
      { pct: 25, minutes: 1440 },
      { pct: 50, minutes: 4320 },
      { pct: 100, minutes: 10080 },
    ],
  },
  diamond: {
    label: "长线持有",
    description: "更慢的释放曲线，适合长周期社区",
    rules: [
      { pct: 20, minutes: 10080 },
      { pct: 50, minutes: 21600 },
      { pct: 100, minutes: 43200 },
    ],
  },
  quick: {
    label: "快速测试",
    description: "更快看到认购、发射、领取与交易的完整节奏",
    rules: [
      { pct: 30, minutes: 60 },
      { pct: 65, minutes: 720 },
      { pct: 100, minutes: 1440 },
    ],
  },
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadAssetFile(file: File) {
  const formData = new FormData()
  formData.append("file", file)
  const response = await fetch("/api/local-asset-upload", {
    method: "POST",
    body: formData,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error || "图片上传失败")
  }
  return String(payload.url)
}

function formatDisplayNumber(value: number, maximumFractionDigits = 6) {
  if (!Number.isFinite(value)) return "—"
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })
}

function formatInputNumber(value: number, maximumFractionDigits = 6) {
  if (!Number.isFinite(value)) return ""
  return value.toFixed(maximumFractionDigits).replace(/\.?0+$/, "")
}

function clampMultiple(value: number) {
  if (!Number.isFinite(value)) return MIN_MULTIPLE
  return Math.min(MAX_MULTIPLE, Math.max(MIN_MULTIPLE, value))
}

function clampWalletCapPercent(value: number) {
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(1, Math.round(value * 100) / 100))
}

function calculateWalletCap(nftSupply: number, walletCapPercent: number) {
  if (walletCapPercent >= 100) return Math.max(1, nftSupply)
  return Math.max(1, Math.floor(nftSupply * (walletCapPercent / 100)))
}

function clampRulePct(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(100, Math.max(1, Math.round(value)))
}

function clampRuleMinutes(value: number) {
  if (!Number.isFinite(value)) return MIN_RULE_MINUTES
  return Math.min(MAX_RULE_MINUTES, Math.max(MIN_RULE_MINUTES, Math.round(value)))
}

function formatMinutesReadable(totalMinutes: number) {
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}分钟`)
  return parts.join(" ")
}

function sanitizeDecimalInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "")
  const [head, ...rest] = cleaned.split(".")
  return rest.length ? `${head}.${rest.join("")}` : head
}

function sanitizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "")
}

function sliderValueFromMinutes(minutes: number) {
  const normalized = (clampRuleMinutes(minutes) - MIN_RULE_MINUTES) / (MAX_RULE_MINUTES - MIN_RULE_MINUTES)
  return Math.round(Math.pow(normalized, 1 / 2.2) * RULE_SLIDER_STEPS)
}

function minutesFromSliderValue(value: number) {
  const ratio = Math.min(1, Math.max(0, value / RULE_SLIDER_STEPS))
  const minutes = MIN_RULE_MINUTES + Math.pow(ratio, 2.2) * (MAX_RULE_MINUTES - MIN_RULE_MINUTES)
  return clampRuleMinutes(minutes)
}

function clampSliderValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundSliderStep(value: number, min: number, step: number) {
  return Math.round((value - min) / step) * step + min
}

function EditableSlider({
  label,
  value,
  min,
  max,
  step = 1,
  accent,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  accent: "emerald" | "blue"
  display: string
  onChange: (value: number) => void
}) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const ratio = max === min ? 0 : (value - min) / (max - min)

  function updateFromClientX(clientX: number) {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const nextRatio = clampSliderValue((clientX - rect.left) / rect.width, 0, 1)
    const rawValue = min + nextRatio * (max - min)
    const steppedValue = clampSliderValue(roundSliderStep(rawValue, min, step), min, max)
    onChange(steppedValue)
  }

  useEffect(() => {
    if (!dragging) return

    function handleMouseMove(event: MouseEvent) {
      updateFromClientX(event.clientX)
    }

    function handleMouseUp() {
      setDragging(false)
    }

    function handleTouchMove(event: TouchEvent) {
      const touch = event.touches[0]
      if (!touch) return
      event.preventDefault()
      updateFromClientX(touch.clientX)
    }

    function handleTouchEnd() {
      setDragging(false)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("touchmove", handleTouchMove, { passive: false })
    window.addEventListener("touchend", handleTouchEnd)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [dragging, max, min, onChange, step])

  function onMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(true)
    updateFromClientX(event.clientX)
  }

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    if (!touch) return
    event.preventDefault()
    setDragging(true)
    updateFromClientX(touch.clientX)
  }

  function stopDragging() {
    setDragging(false)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault()
      onChange(clampSliderValue(value - step, min, max))
    }
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault()
      onChange(clampSliderValue(value + step, min, max))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <label className="label !mb-0">{label}</label>
        <span className={accent === "emerald" ? "text-2xl font-bold text-emerald-300" : "text-xl font-bold text-blue-200"}>
          {display}
        </span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display}
        className={`interactive-slider mt-5 ${dragging ? "interactive-slider-active" : ""} ${
          accent === "emerald" ? "interactive-slider-emerald" : "interactive-slider-blue"
        }`}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onMouseUp={stopDragging}
        onTouchEnd={stopDragging}
        onKeyDown={onKeyDown}
      >
        <div className="interactive-slider-track">
          <div className="interactive-slider-fill" style={{ width: `${ratio * 100}%` }} />
          <div className="interactive-slider-thumb" style={{ left: `${ratio * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

function normalizeRulesForSubmit(rules: ReleaseRule[]) {
  return [...rules]
    .map((rule) => ({
      pct: clampRulePct(rule.pct),
      minutes: clampRuleMinutes(rule.minutes),
    }))
    .sort((a, b) => a.minutes - b.minutes)
}

function mapRulesToContractVesting(rules: ReleaseRule[]) {
  const normalized = normalizeRulesForSubmit(rules)
  const first = normalized[0] ?? { pct: defaultVesting.firstUnlockBps / 100, minutes: defaultVesting.firstDelayMinutes }
  const second = normalized[1] ?? {
    pct: Math.max(first.pct + 1, 50),
    minutes: Math.max(first.minutes + 60, defaultVesting.secondDelayMinutes),
  }
  const finalRule = normalized[normalized.length - 1] ?? { pct: 100, minutes: 10080 }

  const firstUnlockBps = first.pct * 100
  const secondUnlockBps = Math.max(0, (second.pct - first.pct) * 100)
  let remainingBps = Math.max(0, (finalRule.pct - second.pct) * 100)

  const secondMinutes = second.minutes
  const finalMinutes = Math.max(finalRule.minutes, secondMinutes)

  const hourlyWindow = secondMinutes < 2880 ? Math.min(23, Math.max(0, Math.floor((Math.min(finalMinutes, 2880) - secondMinutes) / 60))) : 0
  const dayWindow = finalMinutes > 2880 ? Math.max(0, Math.ceil((Math.min(finalMinutes, 10080) - Math.max(secondMinutes, 2880)) / 1440)) : 0
  const postDay7Window = finalMinutes > 10080 ? Math.max(0, Math.ceil((finalMinutes - Math.max(secondMinutes, 10080)) / 1440)) : 0

  let hourlyUnlockBps = 0
  let day2To7DailyBps = 0
  let postDay7DailyBps = 0

  const totalWindows = hourlyWindow + dayWindow + postDay7Window
  if (remainingBps > 0 && totalWindows > 0) {
    if (hourlyWindow > 0) {
      hourlyUnlockBps = Math.floor(remainingBps * (hourlyWindow / totalWindows) / hourlyWindow)
      remainingBps -= hourlyUnlockBps * hourlyWindow
    }
    if (dayWindow > 0) {
      day2To7DailyBps = Math.floor(remainingBps * (dayWindow / (dayWindow + postDay7Window || 1)) / dayWindow)
      remainingBps -= day2To7DailyBps * dayWindow
    }
    if (postDay7Window > 0) {
      postDay7DailyBps = Math.ceil(remainingBps / postDay7Window)
      remainingBps = 0
    } else if (dayWindow > 0 && remainingBps > 0) {
      day2To7DailyBps += Math.ceil(remainingBps / dayWindow)
      remainingBps = 0
    } else if (hourlyWindow > 0 && remainingBps > 0) {
      hourlyUnlockBps += Math.ceil(remainingBps / hourlyWindow)
      remainingBps = 0
    }
  }

  return {
    firstDelayMinutes: first.minutes,
    firstUnlockBps,
    secondDelayMinutes: Math.max(first.minutes + 1, second.minutes),
    secondUnlockBps,
    hourlyUnlockBps,
    day2To7DailyBps,
    postDay7DailyBps,
  }
}

export default function LaunchPage() {
  const [name, setName] = useState("")
  const [symbol, setSymbol] = useState("")
  const [description, setDescription] = useState("")
  const [website, setWebsite] = useState("")
  const [twitter, setTwitter] = useState("")
  const [telegram, setTelegram] = useState("")
  const [mintPrice, setMintPrice] = useState("0.01")
  const [supplyInput, setSupplyInput] = useState("100")
  const [multipleInput, setMultipleInput] = useState("2")
  const [walletCapMode, setWalletCapMode] = useState<(typeof WALLET_CAP_PRESETS)[number]>("no-cap")
  const [customWalletCapPercentInput, setCustomWalletCapPercentInput] = useState("2")
  const [vestingPreset, setVestingPreset] = useState<VestingPresetKey>("standard")
  const [releaseRules, setReleaseRules] = useState<ReleaseRule[]>(VESTING_PRESETS.standard.rules)
  const [nftMode, setNftMode] = useState<"own-metadata" | "uniform-meme">("uniform-meme")
  const [nftBaseURI, setNftBaseURI] = useState("")
  const [imagePreview, setImagePreview] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [createdAddress, setCreatedAddress] = useState("")

  const parsedMintPrice = Number(mintPrice || "0")
  const safeSupply = Math.max(0, Number(supplyInput || "0"))
  const safeMultiple = clampMultiple(Number(multipleInput || "0"))
  const walletCapPercent = walletCapMode === "no-cap"
    ? 100
    : walletCapMode === "custom"
      ? clampWalletCapPercent(Number(customWalletCapPercentInput || "0"))
      : Number(walletCapMode)

  const releaseTimeline = useMemo(() => normalizeRulesForSubmit(releaseRules), [releaseRules])
  const releaseDuration = releaseTimeline[releaseTimeline.length - 1]?.minutes ?? 0
  const releaseCheckpointCount = releaseTimeline.length
  const avgUnlockGap = releaseCheckpointCount > 1
    ? Math.round((releaseDuration - releaseTimeline[0].minutes) / (releaseCheckpointCount - 1))
    : releaseDuration

  const economics = useMemo(() => {
    const totalRaise = parsedMintPrice * safeSupply
    const poolBnb = totalRaise * 0.9
    const poolShare = 1 / (1 + safeMultiple)
    const nftShare = safeMultiple / (1 + safeMultiple)
    const poolTokens = Math.floor(TOTAL_TOKEN_SUPPLY * poolShare)
    const nftTokenAllocation = TOTAL_TOKEN_SUPPLY - poolTokens
    const tokensPerNft = safeSupply > 0 ? nftTokenAllocation / safeSupply : 0
    const launchPrice = poolTokens > 0 ? poolBnb / poolTokens : 0
    const nftFullValue = tokensPerNft * launchPrice
    const burnNowValue = nftFullValue * 0.5
    const walletCap = calculateWalletCap(Math.max(safeSupply, 1), walletCapPercent)

    return {
      totalRaise,
      poolBnb,
      poolTokens,
      nftTokenAllocation,
      tokensPerNft,
      launchPrice,
      nftFullValue,
      burnNowValue,
      walletCap,
    }
  }, [parsedMintPrice, safeMultiple, safeSupply, walletCapPercent])

  async function onImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setImageFile(file)
    setImagePreview(dataUrl)
  }

  async function submit() {
    try {
      if (!name.trim()) throw new Error("请输入项目名称")
      if (!symbol.trim()) throw new Error("请输入项目简称")
      if (!description.trim()) throw new Error("请输入项目描述")
      if (!imagePreview || !imageFile) throw new Error("请上传项目图片")
      if (safeSupply <= 0) throw new Error("NFT 数量必须大于 0")
      if (!Number.isFinite(parsedMintPrice) || parsedMintPrice <= 0) throw new Error("请输入有效的认购单价")
      if (nftMode === "own-metadata" && !nftBaseURI.trim()) throw new Error("请选择自定义 NFT 元数据后填写 URI")
      const normalizedRules = normalizeRulesForSubmit(releaseRules)
      if (normalizedRules.length < 3) throw new Error("至少需要 3 条释放规则")
      for (let index = 1; index < normalizedRules.length; index += 1) {
        if (normalizedRules[index].pct <= normalizedRules[index - 1].pct) throw new Error(`第 ${index + 1} 条规则的释放比例必须大于上一条`)
        if (normalizedRules[index].minutes <= normalizedRules[index - 1].minutes) throw new Error(`第 ${index + 1} 条规则的释放时间必须晚于上一条`)
      }
      if (normalizedRules[normalizedRules.length - 1].pct !== 100) throw new Error("最后一条释放规则必须到 100%")

      setBusy(true)
      const tokenName = `${name.trim()} Token`
      const tokenSymbol = symbol.trim().toUpperCase()
      const contractVesting = mapRulesToContractVesting(normalizedRules)
      const uploadedImageUrl = await uploadAssetFile(imageFile)
      const result = await createLaunchTx({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        tokenName,
        tokenSymbol,
        description: description.trim(),
        imageURI: uploadedImageUrl,
        bannerURI: "",
        website: website.trim(),
        twitter: twitter.trim(),
        telegram: telegram.trim(),
        nftBaseURI: nftMode === "own-metadata" ? nftBaseURI.trim() : "",
        memeImageURI: nftMode === "uniform-meme" ? uploadedImageUrl : "",
        nftMode: nftMode === "own-metadata" ? 0 : 1,
        mintPriceWei: parseEther(mintPrice).toString(),
        nftSupply: safeSupply,
        walletCapBps: Math.round(walletCapPercent * 100),
        multipleBps: Math.round(safeMultiple * 10000),
        firstDelayMinutes: contractVesting.firstDelayMinutes,
        firstUnlockBps: contractVesting.firstUnlockBps,
        secondDelayMinutes: contractVesting.secondDelayMinutes,
        secondUnlockBps: contractVesting.secondUnlockBps,
        hourlyUnlockBps: contractVesting.hourlyUnlockBps,
        day2To7DailyBps: contractVesting.day2To7DailyBps,
        postDay7DailyBps: contractVesting.postDay7DailyBps,
      })

      if (result.launchAddress) {
        saveLocalMeta(result.launchAddress, {
          imageDataUrl: uploadedImageUrl,
          bannerDataUrl: "",
          nftMode,
        })
        setCreatedAddress(result.launchAddress)
      }
      alert("项目已发送到 BSC Testnet")
    } catch (error) {
      alert(error instanceof Error ? error.message : "创建失败")
    } finally {
      setBusy(false)
    }
  }

  function applyVestingPreset(nextPreset: Exclude<VestingPresetKey, "custom">) {
    setVestingPreset(nextPreset)
    setReleaseRules(VESTING_PRESETS[nextPreset].rules)
  }

  function updateReleaseRule(index: number, field: keyof ReleaseRule, value: number) {
    setVestingPreset("custom")
    setReleaseRules((current) =>
      current.map((rule, ruleIndex) =>
        ruleIndex === index
          ? {
              ...rule,
              [field]: field === "pct" ? clampRulePct(value) : clampRuleMinutes(value),
            }
          : rule
      )
    )
  }

  function updateReleaseRuleTimePart(index: number, part: "days" | "hours" | "minutes", nextValue: string) {
    const numeric = Math.max(0, Number(sanitizeIntegerInput(nextValue || "0")))
    setVestingPreset("custom")
    setReleaseRules((current) =>
      current.map((rule, ruleIndex) => {
        if (ruleIndex !== index) return rule
        const currentDays = Math.floor(rule.minutes / 1440)
        const currentHours = Math.floor((rule.minutes % 1440) / 60)
        const currentMinutes = rule.minutes % 60

        const days = part === "days" ? numeric : currentDays
        const hours = part === "hours" ? Math.min(23, numeric) : currentHours
        const minutes = part === "minutes" ? Math.min(59, numeric) : currentMinutes

        return {
          ...rule,
          minutes: clampRuleMinutes(days * 1440 + hours * 60 + minutes),
        }
      })
    )
  }

  function addReleaseRule() {
    setVestingPreset("custom")
    setReleaseRules((current) => {
      const lastRule = current[current.length - 1] ?? { pct: 100, minutes: 1440 }
      const previousRule = current[current.length - 2] ?? { pct: Math.max(1, lastRule.pct - 25), minutes: Math.max(MIN_RULE_MINUTES, lastRule.minutes - 720) }
      const nextPct = Math.min(100, Math.max(previousRule.pct + 5, lastRule.pct))
      const nextMinutes = Math.min(MAX_RULE_MINUTES, lastRule.minutes + 720)
      return [...current, { pct: nextPct, minutes: nextMinutes }]
    })
  }

  function removeReleaseRule(index: number) {
    setVestingPreset("custom")
    setReleaseRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index))
  }

  return (
    <div className="container-shell py-14">
      <section className="glass card launch-hero-shell">
        <div className="launch-hero-grid">
          <div>
            <div className="pill inline-flex px-4 py-2 text-sm">发布项目</div>
            <h1 className="mt-6 text-4xl font-black tracking-[-0.04em] md:text-5xl">创建一个新的 NFT 发射项目</h1>
            <p className="mt-4 max-w-3xl text-slate-300">
              发射页现在把项目资料、经济参数和释放曲线拆成三段流程。先完成基础信息，再确认募资与池子结构，最后用更平滑的滑块和时间输入把释放规则调到你想要的节奏。
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="panel-soft p-4">
              <div className="muted text-xs uppercase tracking-[0.2em]">认购</div>
              <div className="mt-3 text-lg font-semibold">固定价格认购</div>
              <p className="muted mt-2 text-sm">用户先拿到可退款认购凭证，路径清晰，适合社区发射和测试项目。</p>
            </div>
            <div className="panel-soft p-4">
              <div className="muted text-xs uppercase tracking-[0.2em]">流动性</div>
              <div className="mt-3 text-lg font-semibold">发射即建池</div>
              <p className="muted mt-2 text-sm">募资打满后自动完成加池与锁仓位，项目一发射就能直接交易。</p>
            </div>
            <div className="panel-soft p-4">
              <div className="muted text-xs uppercase tracking-[0.2em]">释放</div>
              <div className="mt-3 text-lg font-semibold">最长两年曲线</div>
              <p className="muted mt-2 text-sm">从短周期快节奏到两年长线释放，都可以通过同一套编辑器配置出来。</p>
            </div>
          </div>
        </div>
      </section>

      <div className="launch-layout mt-8">
        <div className="grid gap-6">
          <section className="glass card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="section-kicker">Step 01</div>
                <h2 className="text-2xl font-bold">项目资料</h2>
                <p className="muted mt-3 text-sm">先把用户会看到的基础信息补齐，后面的发射页、项目页和市场页都会直接复用这些内容。</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                发射地址会在提交后生成
              </div>
            </div>

            <div className="launch-section-grid mt-6">
              <div>
                <label className="label">项目名称</label>
                <input className="field field-lg" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 Cult Cat" />
              </div>
              <div>
                <label className="label">项目简称</label>
                <input className="field field-lg" value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="例如 CCAT" />
              </div>
            </div>

            <div className="mt-5">
              <label className="label">项目描述</label>
              <textarea
                className="field min-h-[170px]"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="介绍项目背景、玩法、社区定位和发射目标。"
              />
            </div>

            <div className="launch-section-grid mt-5">
              <div>
                <label className="label">官网</label>
                <input className="field" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="label">X 主页</label>
                <input className="field" value={twitter} onChange={(event) => setTwitter(event.target.value)} placeholder="https://x.com/..." />
              </div>
              <div>
                <label className="label">社群链接</label>
                <input className="field" value={telegram} onChange={(event) => setTelegram(event.target.value)} placeholder="https://t.me/..." />
              </div>
            </div>

            <div className="launch-section-grid mt-6 launch-media-grid">
              <div>
                <label className="label">项目图片 / NFT 主图上传</label>
                <input className="field" type="file" accept="image/*" onChange={(event) => void onImageChange(event)} />
                <p className="muted mt-2 text-sm">项目详情和 meme NFT 模式都会优先使用这张图片。</p>
              </div>

              <div className="panel-soft overflow-hidden">
                {imagePreview ? (
                  <img src={imagePreview} alt="项目图片预览" className="h-52 w-full object-cover" />
                ) : (
                  <div className="flex h-52 items-center justify-center px-6 text-center text-sm text-slate-400">
                    上传后会在这里看到卡片预览图
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="label">NFT 类型</label>
              <select
                className="field"
                value={nftMode}
                onChange={(event) => setNftMode(event.target.value as "own-metadata" | "uniform-meme")}
              >
                <option value="uniform-meme">上传 Meme 图片并自动使用这张图做 NFT</option>
                <option value="own-metadata">调用自己的 NFT 元数据</option>
              </select>

              {nftMode === "own-metadata" ? (
                <div className="mt-4">
                  <label className="label">NFT 元数据 URI</label>
                  <input
                    className="field"
                    value={nftBaseURI}
                    onChange={(event) => setNftBaseURI(event.target.value)}
                    placeholder="填写你的 NFT 元数据基础 URI"
                  />
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  当前模式会直接使用你上传的项目图片作为 NFT 图像来源，不需要再单独填写 meme URI。
                </div>
              )}
            </div>
          </section>

          <section className="glass card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="section-kicker">Step 02</div>
                <h2 className="text-2xl font-bold">发射参数</h2>
                <p className="muted mt-3 text-sm">认购单价、NFT 总量、发射倍数和钱包上限都会实时联动，让你更直观看到募资规模、池子深度和单张 NFT 的权益价值。</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Token 固定总量：10 亿
              </div>
            </div>

            <div className="launch-section-grid mt-6">
              <div className="panel-soft p-5">
                <label className="label">认购单价（BNB）</label>
                <input
                  className="field field-lg"
                  inputMode="decimal"
                  value={mintPrice}
                  onChange={(event) => setMintPrice(sanitizeDecimalInput(event.target.value))}
                  placeholder="0.01"
                />
              </div>

              <div className="panel-soft p-5">
                <label className="label">NFT 数量</label>
                <input
                  className="field field-lg"
                  inputMode="numeric"
                  value={supplyInput}
                  onChange={(event) => setSupplyInput(sanitizeIntegerInput(event.target.value))}
                  placeholder="100"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {NFT_SUPPLY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        safeSupply === preset
                          ? "border-blue-400 bg-blue-500/20 text-blue-100"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                      }`}
                      onClick={() => setSupplyInput(String(preset))}
                    >
                      {preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="launch-section-grid mt-5">
              <div className="panel-soft p-5">
                <label className="label">发射倍数</label>
                <div className="flex flex-wrap gap-2">
                  {MULTIPLE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        safeMultiple === preset
                          ? "border-blue-400 bg-blue-500/20 text-blue-100"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                      }`}
                      onClick={() => setMultipleInput(formatInputNumber(preset, 2))}
                    >
                      {preset.toFixed(1)}x
                    </button>
                  ))}
                </div>
                <input
                  className="field field-lg mt-4"
                  inputMode="decimal"
                  value={multipleInput}
                  onChange={(event) => setMultipleInput(sanitizeDecimalInput(event.target.value))}
                  placeholder="2"
                />
                <p className="muted mt-2 text-sm">可选范围：{MIN_MULTIPLE.toFixed(1)}x - {MAX_MULTIPLE.toFixed(1)}x</p>
              </div>

              <div className="panel-soft p-5">
                <label className="label">钱包上限</label>
                <div className="flex flex-wrap gap-2">
                  {WALLET_CAP_PRESETS.map((preset) => {
                    const label = preset === "no-cap" ? "不限" : preset === "custom" ? "自定义" : `${preset}%`
                    const active = walletCapMode === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          active
                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                            : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                        }`}
                        onClick={() => setWalletCapMode(preset)}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <input
                  className="field field-lg mt-4"
                  inputMode="decimal"
                  disabled={walletCapMode !== "custom"}
                  value={walletCapMode === "custom" ? customWalletCapPercentInput : walletCapMode === "no-cap" ? "100" : walletCapMode}
                  onChange={(event) => setCustomWalletCapPercentInput(sanitizeDecimalInput(event.target.value))}
                  placeholder="2"
                />
                <p className="muted mt-2 text-sm">
                  {walletCapPercent >= 100
                    ? "这个项目不限制单钱包持仓比例。"
                    : `每个钱包最多可认购总量的 ${formatInputNumber(walletCapPercent, 2)}%。`}
                </p>
              </div>
            </div>
          </section>

          <section className="glass card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="section-kicker">Step 03</div>
                <h2 className="text-2xl font-bold">释放规则</h2>
                <p className="muted mt-3 text-sm">释放规则编辑器支持更平滑的时间滑块，最长可配置到两年。你也可以直接输入天、小时和分钟，让长线曲线不再难调。</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <div className="muted text-xs uppercase tracking-[0.18em]">规则数量</div>
                  <div className="mt-2 text-lg font-semibold">{releaseCheckpointCount} 条</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <div className="muted text-xs uppercase tracking-[0.18em]">总解锁时长</div>
                  <div className="mt-2 text-lg font-semibold">{formatMinutesReadable(releaseDuration)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <div className="muted text-xs uppercase tracking-[0.18em]">平均间隔</div>
                  <div className="mt-2 text-lg font-semibold">{formatMinutesReadable(avgUnlockGap)}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {(Object.entries(VESTING_PRESETS) as [Exclude<VestingPresetKey, "custom">, (typeof VESTING_PRESETS)[Exclude<VestingPresetKey, "custom">]][]).map(
                ([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      vestingPreset === key
                        ? "border-amber-300 bg-[linear-gradient(180deg,rgba(243,186,47,0.18),rgba(243,186,47,0.08))] text-amber-50 shadow-[0_12px_32px_rgba(243,186,47,0.08)]"
                        : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] text-slate-300 hover:border-white/20"
                    }`}
                    onClick={() => applyVestingPreset(key)}
                  >
                    <div className="font-semibold">{preset.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{preset.description}</div>
                  </button>
                )
              )}
              {vestingPreset === "custom" ? (
                <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">当前为自定义曲线</span>
              ) : null}
            </div>

            <div className="mt-3 text-sm text-slate-300">
              {vestingPreset !== "custom"
                ? VESTING_PRESETS[vestingPreset as Exclude<VestingPresetKey, "custom">].description
                : "你正在编辑自定义释放曲线。建议先用参考时间定一个大致范围，再拖动滑块细调。"}
            </div>

            <div className="mt-6 grid gap-5">
              {releaseRules.map((rule, index) => {
                const isLast = index === releaseRules.length - 1
                const timeSliderValue = sliderValueFromMinutes(rule.minutes)
                const currentDays = Math.floor(rule.minutes / 1440)
                const currentHours = Math.floor((rule.minutes % 1440) / 60)
                const currentMinutes = rule.minutes % 60
                const previousRule = releaseRules[index - 1]
                const gapMinutes = previousRule ? Math.max(0, rule.minutes - previousRule.minutes) : rule.minutes
                const stageLabel = index === 0 ? "首段释放" : isLast ? "最终解锁" : "中段释放"

                return (
                  <div
                    key={`${index}-${rule.minutes}-${rule.pct}`}
                    className="release-rule-card rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,19,28,0.98),rgba(8,12,18,0.98))] p-5 shadow-[0_20px_48px_rgba(0,0,0,0.16)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-5">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 text-sm font-semibold text-amber-100">
                            #{index + 1}
                          </span>
                          <div>
                            <div className="text-lg font-semibold text-white">{stageLabel}</div>
                            <div className="muted mt-1 text-sm">在 {formatMinutesReadable(rule.minutes)} 时累计释放至 {rule.pct}%</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                          与上一段间隔 {formatMinutesReadable(gapMinutes)}
                        </span>
                        {releaseRules.length > 3 ? (
                          <button
                            type="button"
                            className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200"
                            onClick={() => removeReleaseRule(index)}
                          >
                            删除
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">累计释放</div>
                        <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">{rule.pct}%</div>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">解锁时间</div>
                        <div className="mt-2 text-2xl font-bold text-white">{formatMinutesReadable(rule.minutes)}</div>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">与上一段间隔</div>
                        <div className="mt-2 text-2xl font-bold text-white">{formatMinutesReadable(gapMinutes)}</div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
                      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,24,0.95),rgba(7,11,17,0.95))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <EditableSlider
                          label="释放代币百分比"
                          value={rule.pct}
                          min={1}
                          max={100}
                          accent="emerald"
                          display={`${rule.pct}%`}
                          onChange={(nextValue) => updateReleaseRule(index, "pct", nextValue)}
                        />
                        <div className="mt-4 text-xs text-slate-400">拖动滑块或使用下方参考值，快速设置本阶段的累计释放比例。</div>
                        <div className="mt-5 grid gap-3">
                          <div className="grid grid-cols-4 gap-2">
                            {[25, 50, 75, 100].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                className={`rounded-[18px] border px-3 py-3 text-sm font-medium transition ${
                                  rule.pct === preset
                                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                                }`}
                                onClick={() => updateReleaseRule(index, "pct", preset)}
                              >
                                {preset}%
                              </button>
                            ))}
                          </div>
                          <div className="rounded-[22px] border border-white/10 bg-black/20 p-3">
                            <label className="label">精确输入</label>
                            <div className="flex items-center gap-3 rounded-[18px] border border-white/8 bg-black/20 px-4">
                              <input
                                className="field field-compact !border-0 !bg-transparent px-0 text-center text-2xl font-semibold shadow-none"
                                inputMode="numeric"
                                value={String(rule.pct)}
                                onChange={(event) => updateReleaseRule(index, "pct", Number(sanitizeIntegerInput(event.target.value || "0")))}
                              />
                              <span className="text-lg font-semibold text-emerald-200">%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,24,0.96),rgba(7,11,17,0.95))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <EditableSlider
                          label="解锁时间"
                          value={timeSliderValue}
                          min={0}
                          max={RULE_SLIDER_STEPS}
                          accent="blue"
                          display={formatMinutesReadable(rule.minutes)}
                          onChange={(nextValue) => updateReleaseRule(index, "minutes", minutesFromSliderValue(nextValue))}
                        />
                        <div className="mt-4 text-xs text-slate-400">支持按住拖动细调，也可以先用 4 个参考时间快速定档。</div>

                        <div className="mt-5 grid grid-cols-4 gap-2">
                          {RULE_TIME_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className={`rounded-[18px] border px-3 py-3 text-sm font-medium transition ${
                                Math.abs(rule.minutes - preset) < 5
                                  ? "border-blue-400 bg-blue-500/20 text-blue-100"
                                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                              }`}
                              onClick={() => updateReleaseRule(index, "minutes", preset)}
                            >
                              {formatMinutesReadable(preset)}
                            </button>
                          ))}
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-3">
                          <div>
                            <label className="label">天</label>
                            <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                              <input
                                className="field field-compact !border-0 !bg-transparent px-0 text-center text-2xl font-semibold shadow-none"
                                inputMode="numeric"
                                value={String(currentDays)}
                                onChange={(event) => updateReleaseRuleTimePart(index, "days", event.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="label">小时</label>
                            <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                              <input
                                className="field field-compact !border-0 !bg-transparent px-0 text-center text-2xl font-semibold shadow-none"
                                inputMode="numeric"
                                value={String(currentHours)}
                                onChange={(event) => updateReleaseRuleTimePart(index, "hours", event.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="label">分钟</label>
                            <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                              <input
                                className="field field-compact !border-0 !bg-transparent px-0 text-center text-2xl font-semibold shadow-none"
                                inputMode="numeric"
                                value={String(currentMinutes)}
                                onChange={(event) => updateReleaseRuleTimePart(index, "minutes", event.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isLast ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                        最后一条规则通常应该收敛到 100%，这样用户能清楚看到完整释放终点。
                      </div>
                    ) : null}
                  </div>
                )
              })}

              <button
                type="button"
                className="rounded-[26px] border border-dashed border-white/20 bg-white/5 px-4 py-4 text-sm text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                onClick={addReleaseRule}
              >
                + 添加释放规则
              </button>
            </div>
          </section>
        </div>

        <aside className="launch-sticky">
          <div className="glass card">
            <div className="section-kicker">实时预览</div>
            <h2 className="text-2xl font-bold">发射摘要</h2>
            <p className="muted mt-3 text-sm">右侧会把募资、池子、NFT 权益和燃烧参考值集中起来，提交前可以快速确认一遍。</p>

            <div className="mt-5 grid gap-3">
              <div className="stat-tile">
                <div className="muted text-sm">总募资</div>
                <div className="stat-value !text-[28px]">{formatDisplayNumber(economics.totalRaise, 4)} BNB</div>
              </div>
              <div className="stat-tile">
                <div className="muted text-sm">池内 BNB</div>
                <div className="stat-value !text-[28px]">{formatDisplayNumber(economics.poolBnb, 4)} BNB</div>
              </div>
              <div className="stat-tile">
                <div className="muted text-sm">单张 NFT 对应 Token</div>
                <div className="stat-value !text-[28px]">{formatDisplayNumber(economics.tokensPerNft, 2)}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 rounded-[26px] border border-white/10 bg-white/5 p-4 text-sm">
              <div className="kv"><span>池内 Token</span><span>{formatDisplayNumber(economics.poolTokens, 0)}</span></div>
              <div className="kv"><span>NFT 对应 Token 总量</span><span>{formatDisplayNumber(economics.nftTokenAllocation, 0)}</span></div>
              <div className="kv"><span>初始参考价格</span><span>{formatDisplayNumber(economics.launchPrice, 8)} BNB</span></div>
              <div className="kv"><span>NFT 完整价值</span><span>{formatDisplayNumber(economics.nftFullValue, 4)} BNB</span></div>
              <div className="kv"><span>立即燃烧参考值</span><span>{formatDisplayNumber(economics.burnNowValue, 4)} BNB</span></div>
              <div className="kv"><span>单钱包上限</span><span>{economics.walletCap} 张 NFT</span></div>
            </div>
          </div>

          <div className="glass card mt-6">
            <div className="section-kicker">提交</div>
            <h2 className="text-2xl font-bold">准备发射</h2>
            <p className="muted mt-3 text-sm">确认无误后就可以创建项目。提交完成后，新的发射地址会显示在这里。</p>
            <button className="btn-primary mt-6 w-full" disabled={busy} onClick={() => void submit()}>
              {busy ? "发送中..." : "创建项目"}
            </button>
            {createdAddress ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                新项目发射地址：{createdAddress}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
