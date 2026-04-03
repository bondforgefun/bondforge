export const navItems = [
  { href: '/', label: '首页' },
  { href: '/launch', label: '发布项目' },
  { href: '/market', label: 'NFT 市场' },
  { href: '/dashboard', label: '我的仓位' },
  { href: '/burn-pool', label: '燃烧池' },
  { href: '/creator-fees', label: '创作者收益' },
  { href: '/whitepaper', label: '平台说明' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: '联系' },
]

export const heroStats = [
  { label: '释放机制', value: '多段释放 · 可配置曲线' },
  { label: '回购路径', value: 'LP Fee 买 NFT · 版税买币销毁' },
  { label: '提前退出', value: '可立即拿回剩余未领取代币的 50%' },
  { label: '资产模型', value: '10 亿 Token · NFT 锁仓释放' },
]

export const whitepaperSections = [
  {
    title: '01｜平台在做什么',
    content:
      'BondForge 是一个围绕 NFT 仓位构建的发射与交易平台。项目方可以创建固定价格认购项目，用户在募集完成后领取 NFT 仓位，随后围绕这些仓位继续解锁、交易、燃烧和接手剩余权益。平台希望把认购、发射、仓位管理和二级流转放进同一条清晰路径里。',
  },
  {
    title: '02｜项目如何上线',
    content:
      '项目方在发布页填写基础资料、认购参数和释放规则后，项目会进入固定价格认购阶段。募集完成前，用户持有的是可退款的认购凭证；募集打满后，系统会完成发射、加池和锁仓，项目正式进入可交易状态。',
  },
  {
    title: '03｜用户拿到的是什么',
    content:
      '发射完成后，用户不会直接拿到一串零散 Token，而是按认购份额领取 NFT 仓位。每张 NFT 都对应一份独立的链上权益和未完成释放的 Token 配额，这样用户更容易理解自己到底持有什么，也更方便后续交易和接手。',
  },
  {
    title: '04｜为什么采用多段释放',
    content:
      '平台支持项目方配置多段释放曲线。首段释放负责给到最初的可用流动性，后续可以按小时或按天继续递进，让仓位释放更平滑。这样既方便项目方控制初期节奏，也方便用户理解不同阶段大概能解锁多少权益。',
  },
  {
    title: '05｜平台里的交易路径',
    content:
      '项目详情页会展示项目池子、钱包持仓和即时 Swap，方便用户围绕项目池子直接完成买卖。NFT 也可以在二级市场继续挂牌流转。平台希望把“买 Token”“卖 NFT”“接手剩余仓位”这几条路径都放到同一套界面里。',
  },
  {
    title: '06｜双回购从哪里来',
    content:
      '平台的双回购来源于两条现金流。第一条是 Token 在 Pancake 池中的 LP Fee：其中项目 Token 手续费会直接发送到 dead，WBNB 手续费的 90% 会进入 NFT 回购金库；当金库余额达到市场地板价的 110% 时，会自动买入地板 NFT 并送入燃烧池。第二条是 NFT 在平台内流转时产生的版税与相关手续费：其中 90% 会进入 Token 回购金库；当余额达到 0.11 BNB 时，会保留 0.01 BNB 作为底仓，并把剩余部分一次性买入项目 Token 后发送到 dead。',
  },
  {
    title: '07｜提前退出与燃烧池',
    content:
      '如果持有者不想继续等待全部释放，可以选择提前退出，把 NFT 送入燃烧池。提前退出时，可以立刻拿回这张 NFT 剩余未领取代币的 50%；对应 NFT 会进入燃烧池，等待新的买家按平台规则接手剩余权益。',
  },
  {
    title: '08｜当前可以体验什么',
    content:
      '当前版本运行在 BSC Testnet，已经可以体验连接钱包、发布项目、固定价格认购、退款、自动发射、NFT 领取、项目页即时 Swap、NFT 市场和燃烧池等主要路径。平台说明页的目标，是帮助用户快速理解这些功能是如何连在一起运作的。',
  },
]

export const faqs = [
  {
    q: 'BondForge 目前在哪条链上测试？',
    a: '目前版本运行在 BSC Testnet。连接钱包后，页面会优先尝试切换到 BSC 测试网。',
  },
  {
    q: '募集阶段会直接发 NFT 吗？',
    a: '不会。募集阶段是认购与退款阶段。只有项目打满并完成发射后，用户才可以按自己的认购份额领取 NFT。',
  },
  {
    q: '退款规则可以调吗？',
    a: '当前版本退款规则是固定配置，不作为可选参数开放。',
  },
  {
    q: 'NFT 类型支持什么？',
    a: '创建项目时支持两类测试模式：调用自己的 NFT 元数据，或上传 Meme 图像并生成全同款 NFT。',
  },
  {
    q: '为什么项目页里要显示 CA 和社媒？',
    a: '项目页会把头像、简介、社媒入口和 Token / NFT 合约地址放在一起，方便快速判断项目背景与链上信息。',
  },
]

export const defaultVesting = {
  firstDelayMinutes: 42,
  firstUnlockBps: 100,
  secondDelayMinutes: 69,
  secondUnlockBps: 200,
  hourlyUnlockBps: 100,
  day2To7DailyBps: 300,
  postDay7DailyBps: 500,
}
