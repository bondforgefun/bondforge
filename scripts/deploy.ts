import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers"
import type { InterfaceAbi } from "ethers"

type Artifact = {
  abi: InterfaceAbi
  bytecode: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function loadArtifact(relativePath: string): Artifact {
  const artifactPath = path.join(projectRoot, "artifacts", "contracts", relativePath)
  const parsed = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as Artifact
  return parsed
}

async function main() {
  loadEnvFile(path.join(projectRoot, ".env.local"))

  const privateKey = process.env.PRIVATE_KEY
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || "https://bsc-testnet-rpc.publicnode.com"
  const pancakePositionManager =
    process.env.PANCAKE_V3_POSITION_MANAGER || "0x427bF5b37357632377eCbEC9de3626C71A5396c1"
  const pancakeSwapRouter =
    process.env.NEXT_PUBLIC_PANCAKE_V3_SWAP_ROUTER || process.env.PANCAKE_V3_SWAP_ROUTER || "0x1b81D678ffb9C0263b24A97847620C99d213eB14"

  if (!privateKey) {
    throw new Error("Missing PRIVATE_KEY in environment or .env.local")
  }

  const provider = new JsonRpcProvider(rpcUrl)
  const deployer = new Wallet(privateKey, provider)
  const deployerAddress = await deployer.getAddress()
  console.log("Deployer:", deployerAddress)
  console.log("RPC:", rpcUrl)

  const marketplaceArtifact = loadArtifact("BondForgeMarketplace.sol/BondForgeMarketplace.json")
  const create2Artifact = loadArtifact("BondForgeCreate2Deployer.sol/BondForgeCreate2Deployer.json")
  const factoryArtifact = loadArtifact("BondForgeFactory.sol/BondForgeFactory.json")

  const Marketplace = new ContractFactory(marketplaceArtifact.abi, marketplaceArtifact.bytecode, deployer)
  const marketplace = await Marketplace.deploy(deployerAddress)
  await marketplace.waitForDeployment()
  console.log("Marketplace deployed:", await marketplace.getAddress())

  const Create2Deployer = new ContractFactory(create2Artifact.abi, create2Artifact.bytecode, deployer)
  const create2Deployer = await Create2Deployer.deploy(deployerAddress)
  await create2Deployer.waitForDeployment()
  console.log("Create2Deployer deployed:", await create2Deployer.getAddress())

  const Factory = new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, deployer)
  const factory = await Factory.deploy(
    deployerAddress,
    await create2Deployer.getAddress(),
    pancakePositionManager,
    await marketplace.getAddress(),
    pancakeSwapRouter,
  )
  await factory.waitForDeployment()
  console.log("Factory deployed:", await factory.getAddress())

  const setFactoryTx = await (create2Deployer as any).setFactory(await factory.getAddress())
  await setFactoryTx.wait()
  console.log("Create2Deployer factory set")

  console.log("FACTORY=", await factory.getAddress())
  console.log("CREATE2_DEPLOYER=", await create2Deployer.getAddress())
  console.log("MARKETPLACE=", await marketplace.getAddress())
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
