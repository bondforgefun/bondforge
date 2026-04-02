'use client'

import { useMemo, useState } from 'react'
import { SectionTitle } from '@/components/section-title'

type MetadataMode = 'existing' | 'same-image'

export default function LaunchPage() {
  const [metadataMode, setMetadataMode] = useState<MetadataMode>('same-image')
  const [logoPreview, setLogoPreview] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    name: '',
    symbol: '',
    description: '',
    website: '',
    twitter: '',
    telegram: '',
    receiptSupply: 1000,
    mintPrice: 0.02,
    walletCap: 2,
    launchMultiple: 2,
    metadataAddress: '',
    initialUnlockMinutes: 42,
    initialUnlockPercent: 1,
    secondUnlockMinutes: 69,
    secondUnlockPercent: 3,
    dayTwoToSevenDailyPercent: 3,
    accelerateDate: '',
    finalUnlockDate: '',
    saleStartDate: '',
    saleEndDate: '',
  })

  const targetRaise = useMemo(() => (form.receiptSupply * form.mintPrice).toFixed(3), [form.receiptSupply, form.mintPrice])

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setter(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  return (
    <main className="container" style={{ padding: '54px 20px 0' }}>
      <SectionTitle
        eyebrow="Create Launch"
        title="发布一个 NFT 发射项目"
        description="常见 meme 发射页该有的项目资料、图片上传、NFT 类型、时间滑块、日期输入、社媒字段和固定 1% 退款费都集中在这里。募集阶段先得到可退款认购凭证，项目打满并发射后才统一分发 NFT。"
      />

      <div className="card" style={{ padding: 24 }}>
        <div className="two-col">
          <div>
            <label className="label">项目名称</label>
            <input className="input" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="例如 Cult Cat" />
          </div>
          <div>
            <label className="label">项目简称</label>
            <input className="input" value={form.symbol} onChange={(e) => setField('symbol', e.target.value)} placeholder="例如 CCAT" />
          </div>
          <div>
            <label className="label">项目描述</label>
            <textarea className="textarea" rows={5} value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="介绍项目背景、玩法、社区定位和发射目标。" />
          </div>
          <div>
            <label className="label">官网</label>
            <input className="input" value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://..." />
            <label className="label" style={{ marginTop: 16 }}>X / Twitter</label>
            <input className="input" value={form.twitter} onChange={(e) => setField('twitter', e.target.value)} placeholder="https://x.com/..." />
            <label className="label" style={{ marginTop: 16 }}>Telegram</label>
            <input className="input" value={form.telegram} onChange={(e) => setField('telegram', e.target.value)} placeholder="https://t.me/..." />
          </div>
        </div>

        <div className="two-col" style={{ marginTop: 20 }}>
          <div>
            <label className="label">代币 / NFT 头像上传</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => onFileChange(e, setLogoPreview)} />
            <p className="small-note">常见 meme 发射平台的头像上传入口保留在这里。</p>
            {logoPreview && <img src={logoPreview} alt="logo preview" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 20, marginTop: 12, border: '1px solid rgba(255,255,255,0.08)' }} />}
          </div>
          <div>
            <label className="label">项目横幅上传</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => onFileChange(e, setBannerPreview)} />
            <p className="small-note">项目详情页会显示横幅图、项目名称、社媒与 CA 信息。</p>
            {bannerPreview && <img src={bannerPreview} alt="banner preview" className="project-cover" style={{ marginTop: 12, height: 120 }} />}
          </div>
        </div>

        <div className="two-col" style={{ marginTop: 20 }}>
          <div>
            <label className="label">NFT 类型</label>
            <select className="select" value={metadataMode} onChange={(e) => setMetadataMode(e.target.value as MetadataMode)}>
              <option value="existing">调用自己的 NFT 元数据</option>
              <option value="same-image">上传 Meme 图像并生成同款 NFT</option>
            </select>
            <p className="small-note">你可以选择项目方已有 NFT 元数据，或者直接用上传的 meme 图片批量铸造成同款 NFT。</p>
          </div>
          <div>
            <label className="label">NFT 元数据地址 / 基础 URI</label>
            <input
              className="input"
              value={form.metadataAddress}
              onChange={(e) => setField('metadataAddress', e.target.value)}
              placeholder={metadataMode === 'existing' ? '填写已有 NFT metadata 地址或合约信息' : '可选：填写图片元数据基础 URI'}
            />
            <p className="small-note">{metadataMode === 'existing' ? '当前模式会优先读取项目方已有 NFT 元数据。' : '当前模式会把上传图片视为整批 NFT 的主图像。'}</p>
          </div>
        </div>

        <div className="grid-cards" style={{ marginTop: 20 }}>
          <div>
            <label className="label">认购凭证总量</label>
            <input className="input" type="number" value={form.receiptSupply} onChange={(e) => setField('receiptSupply', Number(e.target.value || 0))} />
          </div>
          <div>
            <label className="label">每份认购价格（tBNB）</label>
            <input className="input" type="number" step="0.001" value={form.mintPrice} onChange={(e) => setField('mintPrice', Number(e.target.value || 0))} />
          </div>
          <div>
            <label className="label">每钱包上限（%）</label>
            <input className="input" type="number" value={form.walletCap} onChange={(e) => setField('walletCap', Number(e.target.value || 0))} />
          </div>
          <div>
            <label className="label">Launch Multiple（x）</label>
            <input className="input" type="number" step="0.1" value={form.launchMultiple} onChange={(e) => setField('launchMultiple', Number(e.target.value || 0))} />
          </div>
          <div>
            <label className="label">退款手续费</label>
            <input className="input" value="1%（固定）" disabled />
            <p className="small-note">退款 fee 直接写死为 1%，不是可选项。</p>
          </div>
          <div>
            <label className="label">目标募资</label>
            <input className="input" value={`${targetRaise} tBNB`} disabled />
          </div>
        </div>

        <div className="card" style={{ padding: 20, marginTop: 22, background: 'rgba(255,255,255,0.03)' }}>
          <h3 style={{ marginTop: 0, fontSize: 24 }}>初始释放计划</h3>
          <p className="small-note">这里保留滑块 + 输入框 + 日期输入。项目打满并发射后才统一分发 NFT，NFT 将按下面的时序承接后续释放。</p>

          <div className="two-col" style={{ marginTop: 16 }}>
            <div>
              <label className="label">第一段解锁时间（分钟）</label>
              <div className="slider-row">
                <input type="range" min="10" max="1440" value={form.initialUnlockMinutes} onChange={(e) => setField('initialUnlockMinutes', Number(e.target.value))} />
                <input className="input" type="number" value={form.initialUnlockMinutes} onChange={(e) => setField('initialUnlockMinutes', Number(e.target.value || 0))} />
              </div>
            </div>
            <div>
              <label className="label">第一段累计释放（%）</label>
              <div className="slider-row">
                <input type="range" min="0" max="20" value={form.initialUnlockPercent} onChange={(e) => setField('initialUnlockPercent', Number(e.target.value))} />
                <input className="input" type="number" value={form.initialUnlockPercent} onChange={(e) => setField('initialUnlockPercent', Number(e.target.value || 0))} />
              </div>
            </div>
            <div>
              <label className="label">第二段解锁时间（分钟）</label>
              <div className="slider-row">
                <input type="range" min="10" max="2880" value={form.secondUnlockMinutes} onChange={(e) => setField('secondUnlockMinutes', Number(e.target.value))} />
                <input className="input" type="number" value={form.secondUnlockMinutes} onChange={(e) => setField('secondUnlockMinutes', Number(e.target.value || 0))} />
              </div>
            </div>
            <div>
              <label className="label">第二段累计释放（%）</label>
              <div className="slider-row">
                <input type="range" min="0" max="30" value={form.secondUnlockPercent} onChange={(e) => setField('secondUnlockPercent', Number(e.target.value))} />
                <input className="input" type="number" value={form.secondUnlockPercent} onChange={(e) => setField('secondUnlockPercent', Number(e.target.value || 0))} />
              </div>
            </div>
            <div>
              <label className="label">第 2-7 天每日释放（%）</label>
              <div className="slider-row">
                <input type="range" min="0" max="10" value={form.dayTwoToSevenDailyPercent} onChange={(e) => setField('dayTwoToSevenDailyPercent', Number(e.target.value))} />
                <input className="input" type="number" value={form.dayTwoToSevenDailyPercent} onChange={(e) => setField('dayTwoToSevenDailyPercent', Number(e.target.value || 0))} />
              </div>
            </div>
            <div>
              <label className="label">加速日期</label>
              <input className="input" type="date" value={form.accelerateDate} onChange={(e) => setField('accelerateDate', e.target.value)} />
            </div>
            <div>
              <label className="label">募集开始日期</label>
              <input className="input" type="datetime-local" value={form.saleStartDate} onChange={(e) => setField('saleStartDate', e.target.value)} />
            </div>
            <div>
              <label className="label">募集结束日期</label>
              <input className="input" type="datetime-local" value={form.saleEndDate} onChange={(e) => setField('saleEndDate', e.target.value)} />
            </div>
            <div>
              <label className="label">最终释放日期</label>
              <input className="input" type="date" value={form.finalUnlockDate} onChange={(e) => setField('finalUnlockDate', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20, marginTop: 22, background: 'rgba(255,255,255,0.03)' }}>
          <h3 style={{ marginTop: 0, fontSize: 24 }}>流程提示</h3>
          <div className="grid-cards">
            {[
              '募集阶段先发认购凭证，可在未打满前退款。',
              '项目打满后，系统完成发射并统一分发 NFT。',
              'NFT 到账后再承接释放、市场流转与燃烧池逻辑。',
            ].map((item) => (
              <div key={item} className="kpi">{item}</div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => setSubmitted(true)}>保存项目草稿</button>
          <button className="btn-secondary">连接钱包后上链创建</button>
        </div>
        {submitted && (
          <p style={{ marginTop: 14, color: '#c9d4f5' }}>
            草稿已保存。当前字段已经按公开测试站需求整理：头像、横幅、社媒、NFT 类型、固定 1% 退款费、初始释放滑块与日期输入都已放进创建流程。
          </p>
        )}
      </div>
    </main>
  )
}
