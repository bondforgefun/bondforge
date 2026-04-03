# BondForge

BondForge 是一套运行在 **BSC Testnet** 的 NFT 发射、Token 交易与 NFT 市场一体化站点。

## 当前机制

- 固定价格认购，项目打满后自动发射并立即加池
- 用户发射后自行领取 NFT 仓位，不再由系统一次性批量分发
- 多段释放机制，围绕 NFT 仓位逐步解锁 Token
- 提前退出时，可立即拿回剩余未领取代币的 50%，NFT 进入燃烧池
- 双回购模型：
  - LP Fee 中的项目 Token 直接发送到 `dead`
  - LP Fee 中的 WBNB 有 90% 进入 `buybackNftVault`
  - NFT 市场与燃烧池版税有 90% 进入 `buybackTokenVault`
  - `buybackNftVault` 达到地板价 110% 后买入地板 NFT 并送入燃烧池
  - `buybackTokenVault` 达到 `0.11 BNB` 后，保留 `0.01 BNB`，其余买入 Token 并发送到 `dead`

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run build
npm run dev
```

## 合约部署

```bash
npm run compile:hardhat
npm run deploy:bscTestnet
```

部署完成后，把新地址写回 `.env.local` 和线上环境变量：

```bash
NEXT_PUBLIC_FACTORY_ADDRESS=...
NEXT_PUBLIC_MARKETPLACE_ADDRESS=...
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
NEXT_PUBLIC_CHAIN_ID=97
```

## Vercel / v0 环境变量

前端可见：

```bash
NEXT_PUBLIC_FACTORY_ADDRESS=
NEXT_PUBLIC_MARKETPLACE_ADDRESS=
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_PANCAKE_V3_SWAP_ROUTER=0x1b81D678ffb9C0263b24A97847620C99d213eB14
NEXT_PUBLIC_PANCAKE_V3_QUOTER_V2=0xbC203d7f83677c7ed3F7acEc959963E7F4ECC5C2
NEXT_PUBLIC_PINATA_GATEWAY_URL=
```

仅服务端可见：

```bash
PRIVATE_KEY=
KEEPER_PRIVATE_KEY=
RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
BONDFORGE_SERVER_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
CRON_SECRET=
PINATA_JWT=
PINATA_GATEWAY_URL=
PANCAKE_V3_POSITION_MANAGER=0x427bF5b37357632377eCbEC9de3626C71A5396c1
PANCAKE_V3_SWAP_ROUTER=0x1b81D678ffb9C0263b24A97847620C99d213eB14
BSCSCAN_API_KEY=
```

## Pinata 怎么填

- `PINATA_JWT`：填 Pinata 后台生成的 JWT
- `PINATA_GATEWAY_URL`：填你自己的 Pinata Gateway，例如 `https://your-gateway.mypinata.cloud/ipfs`
- `NEXT_PUBLIC_PINATA_GATEWAY_URL`：通常和上面保持一致，给前端展示图片时用

设置好以后，发布页上传的头像、Banner、Meme 图会自动走 Pinata；没设置时会退回到本地 `public/dev-uploads`。

## NFT 元数据地址怎么填

如果你走“自己的 NFT 元数据”模式，发布页里的 `NFT Base URI` 建议填你的 Pinata 元数据目录：

```bash
ipfs://<metadata-folder-cid>/
```

或者：

```bash
https://your-gateway.mypinata.cloud/ipfs/<metadata-folder-cid>/
```

目录内需要按 `1.json`、`2.json`、`3.json` 这样编号，合约会自动拼接 `tokenId + ".json"`。
