export const navItems = [
  { href: '/', label: '首页' },
  { href: '/launch', label: '发布项目' },
  { href: '/market', label: 'NFT 市场' },
  { href: '/dashboard', label: '控制台' },
  { href: '/whitepaper', label: '白皮书' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: '联系' },
]

export const site = {
  name: 'BondForge',
  title: 'BondForge | BSC 测试网 NFT 发射平台',
  description:
    'BondForge 是面向 BSC 测试网的 NFT 驱动发射平台：固定价格认购、满额后分发 NFT、渐进释放、燃烧池与单项目交易入口。',
}

export type SocialLink = {
  label: string
  href: string
}

export type ProjectRecord = {
  address: string
  slug: string
  category: string
  name: string
  symbol: string
  summary: string
  description: string
  logo: string
  banner: string
  mintPrice: string
  progress: number
  receiptSupply: number
  walletCap: string
  launchMultiple: string
  saleWindow: string
  nftMode: '使用项目方自己的 NFT 元数据' | '上传 Meme 图片并批量铸造成同款 NFT'
  ca: string
  socials: SocialLink[]
  website: string
  twitter: string
  telegram: string
  discord?: string
  burnPool: {
    total: number
    floorPrice: string
    entries: Array<{
      tokenId: number
      source: string
      value: string
      status: string
    }>
  }
}

export const whitepaperSections = [
  {
    title: 'BondForge 是什么',
    body:
      'BondForge 是一个面向 BSC 测试网的 NFT 发射平台。它不是抢跑型发射页，而是先通过固定价格认购收集参与份额，在募集完成并正式发射后，再把认购凭证转换为 NFT，并按设定的释放节奏解锁后续代币权益。',
  },
  {
    title: '发射流程',
    body:
      '创建项目时需要填写项目名称、图片、描述、社媒、发行参数、NFT 类型与初始释放计划。募资阶段用户拿到的是可退款的认购凭证，不立即分发 NFT；只有打满并完成发射后，系统才会统一铸造并分发 NFT。',
  },
  {
    title: 'NFT 模式',
    body:
      'BondForge 当前测试站提供两种 NFT 模式：一是调用项目方现有 NFT 元数据；二是直接使用上传的 Meme 图像生成整批同款 NFT。这样既能兼容已有 NFT 体系，也能服务更常见的 meme 发射场景。',
  },
  {
    title: '退款与 1% 固定手续费',
    body:
      '募集未完成前，认购凭证可发起退款。退款手续费固定为 1%，不提供自定义选项。这个固定 friction 用来阻止伪进度刷量，也让参与者对退订行为有明确预期。',
  },
  {
    title: '初始释放与后续解锁',
    body:
      '项目方可以设置初始释放时点、起始日期、加速日期与阶段性释放比例。站内采用滑块与输入框双重方式配置，兼顾快速调节和精确录入。项目发射后，NFT 会按照设定节奏承接后续释放。',
  },
  {
    title: '燃烧池',
    body:
      'NFT 持有者在发射后可以将 NFT 提前退出并送入燃烧池。进入燃烧池的 NFT 会暂停后续释放，等待以折价方式重新流转。测试站页面会直接展示燃烧池中的 NFT 状态、标价与处理进度。',
  },
  {
    title: '项目详情页与交易入口',
    body:
      '每个项目页都会展示图片、名称、社媒、合约地址、认购参数、当前状态、单项目 swap 区块与 NFT 市场入口。用户可以复制 CA、跳转社媒、查看燃烧池和二级市场状态。',
  },
]

export const faqs = [
  {
    q: 'BondForge 现在是演示站还是测试站？',
    a: '当前站点定位为公开测试站，页面结构、项目资料、NFT 市场、燃烧池和项目详情页都按测试使用准备，不再使用演示站口径。',
  },
  {
    q: '募集阶段会立刻拿到 NFT 吗？',
    a: '不会。募集阶段先得到可退款的认购凭证，只有项目打满并完成发射后，系统才会统一铸造并分发 NFT。',
  },
  {
    q: '退款手续费可以自定义吗？',
    a: '不可以。退款 fee 固定为 1%，用于降低伪进度和无成本反复进出。',
  },
  {
    q: 'NFT 有哪些创建方式？',
    a: '可以选择调用项目方已有的 NFT 元数据，或者直接上传 Meme 图片，让整批 NFT 都使用同一张图像。',
  },
  {
    q: '燃烧池里是什么？',
    a: '已经提前退出并被送入燃烧池的 NFT 会显示在这里。它们暂停后续释放，等待被重新购买或处理。',
  },
  {
    q: '项目详情页会展示什么？',
    a: '项目详情页会展示项目图片、名称、简介、社媒、CA、进度、募集参数、认购区、NFT 市场入口、swap 区块和燃烧池数据。',
  },
]

export const metrics = [
  { label: '固定退款费', value: '1%' },
  { label: '默认钱包上限', value: '2%' },
  { label: '资金路由基线', value: '90 / 8 / 2' },
  { label: 'NFT 分发时机', value: '发射后统一分发' },
]

export const featuredProjects: ProjectRecord[] = [
  {
    address: '0xB0nd000000000000000000000000000000000001',
    slug: 'cult-cat',
    category: 'Meme',
    name: 'Cult Cat',
    symbol: 'CCAT',
    summary: '固定价格认购，满额后统一分发 NFT，并把提前退出的 NFT 导入燃烧池。',
    description:
      'Cult Cat 是一个偏社区向的 meme 发射项目。募集阶段使用认购凭证承接退款逻辑，发射完成后再统一铸造 NFT，并通过后续释放绑定代币权益与社区热度。',
    logo: '/demo/cult-cat-logo.svg',
    banner: '/demo/cult-cat-banner.svg',
    mintPrice: '0.02 tBNB',
    progress: 68,
    receiptSupply: 1000,
    walletCap: '2%',
    launchMultiple: '2x',
    saleWindow: '24 小时',
    nftMode: '上传 Meme 图片并批量铸造成同款 NFT',
    ca: '0xA11c0F6D5A4f5a7a0C0D0E1F2a3b4c5d6e7f8012',
    website: 'https://www.bondforge.fun',
    twitter: 'https://x.com/bondforgefun',
    telegram: 'https://t.me/bondforgefun',
    socials: [
      { label: '官网', href: 'https://www.bondforge.fun' },
      { label: 'X', href: 'https://x.com/bondforgefun' },
      { label: 'Telegram', href: 'https://t.me/bondforgefun' },
    ],
    burnPool: {
      total: 3,
      floorPrice: '0.016 tBNB',
      entries: [
        { tokenId: 12, source: '提前退出', value: '0.017 tBNB', status: '待重新购买' },
        { tokenId: 34, source: '提前退出', value: '0.016 tBNB', status: '待重新购买' },
        { tokenId: 71, source: '处罚销毁后回收', value: '0.018 tBNB', status: '报价中' },
      ],
    },
  },
  {
    address: '0xB0nd000000000000000000000000000000000002',
    slug: 'forge-monkey',
    category: 'Collection',
    name: 'Forge Monkey',
    symbol: 'FMK',
    summary: '调用自有 NFT 元数据，募资完成后分发 NFT，并在详情页集成单项目 swap。',
    description:
      'Forge Monkey 用于测试项目方自有 NFT 元数据模式。创建项目时直接填写已有 NFT 元数据入口，发射后由站点按时间计划分发 NFT 并展示市场与 CA 信息。',
    logo: '/demo/forge-monkey-logo.svg',
    banner: '/demo/forge-monkey-banner.svg',
    mintPrice: '0.05 tBNB',
    progress: 92,
    receiptSupply: 500,
    walletCap: '2%',
    launchMultiple: '3x',
    saleWindow: '12 小时',
    nftMode: '使用项目方自己的 NFT 元数据',
    ca: '0xB22c0F6D5A4f5a7a0C0D0E1F2a3b4c5d6e7f8023',
    website: 'https://www.bondforge.fun',
    twitter: 'https://x.com/bondforgefun',
    telegram: 'https://t.me/bondforgefun',
    socials: [
      { label: '官网', href: 'https://www.bondforge.fun' },
      { label: 'X', href: 'https://x.com/bondforgefun' },
      { label: 'Telegram', href: 'https://t.me/bondforgefun' },
    ],
    burnPool: {
      total: 2,
      floorPrice: '0.041 tBNB',
      entries: [
        { tokenId: 4, source: '提前退出', value: '0.042 tBNB', status: '待重新购买' },
        { tokenId: 19, source: '提前退出', value: '0.041 tBNB', status: '待重新购买' },
      ],
    },
  },
  {
    address: '0xB0nd000000000000000000000000000000000003',
    slug: 'meme-rice',
    category: 'Meme',
    name: 'Meme Rice',
    symbol: 'RICE',
    summary: '适合最常见的 meme 发射流程：上传头像、填写资料、统一图像 NFT、固定 1% 退款费。',
    description:
      'Meme Rice 主要用来测试最常见的 meme 发射站流程：上传代币头像、项目横幅、填写社媒与资料、设置时间滑块、募资成功后统一铸造同款 NFT，并在项目页提供 swap 和燃烧池状态。',
    logo: '/demo/meme-rice-logo.svg',
    banner: '/demo/meme-rice-banner.svg',
    mintPrice: '0.015 tBNB',
    progress: 39,
    receiptSupply: 1500,
    walletCap: '2%',
    launchMultiple: '1.5x',
    saleWindow: '36 小时',
    nftMode: '上传 Meme 图片并批量铸造成同款 NFT',
    ca: '0xC33c0F6D5A4f5a7a0C0D0E1F2a3b4c5d6e7f8034',
    website: 'https://www.bondforge.fun',
    twitter: 'https://x.com/bondforgefun',
    telegram: 'https://t.me/bondforgefun',
    socials: [
      { label: '官网', href: 'https://www.bondforge.fun' },
      { label: 'X', href: 'https://x.com/bondforgefun' },
      { label: 'Telegram', href: 'https://t.me/bondforgefun' },
    ],
    burnPool: {
      total: 1,
      floorPrice: '0.012 tBNB',
      entries: [{ tokenId: 7, source: '提前退出', value: '0.012 tBNB', status: '报价中' }],
    },
  },
]

export const marketItems = [
  {
    id: 101,
    projectAddress: featuredProjects[0].address,
    projectName: featuredProjects[0].name,
    projectLogo: featuredProjects[0].logo,
    tokenId: 12,
    seller: '0x7aB1...9c2E',
    price: '0.18 tBNB',
    status: '正常挂单',
  },
  {
    id: 102,
    projectAddress: featuredProjects[1].address,
    projectName: featuredProjects[1].name,
    projectLogo: featuredProjects[1].logo,
    tokenId: 4,
    seller: '0x1bF0...A47D',
    price: '0.32 tBNB',
    status: '正常挂单',
  },
  {
    id: 103,
    projectAddress: featuredProjects[2].address,
    projectName: featuredProjects[2].name,
    projectLogo: featuredProjects[2].logo,
    tokenId: 7,
    seller: '0x88C0...4D51',
    price: '0.11 tBNB',
    status: '燃烧池来源 NFT',
  },
]

export function getProjectByAddress(address: string) {
  return featuredProjects.find((item) => item.address.toLowerCase() === address.toLowerCase())
}
