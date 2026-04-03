import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

function sanitizeExtension(filename: string) {
  const ext = path.extname(filename || "").toLowerCase()
  if (!ext) return ".png"
  if (/^\.[a-z0-9]{1,8}$/.test(ext)) return ext
  return ".png"
}

function resolvePinataGateway() {
  const raw =
    process.env.PINATA_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL ||
    "https://gateway.pinata.cloud/ipfs"
  return raw.replace(/\/+$/, "")
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file upload" }, { status: 400 })
    }

    const pinataJwt = process.env.PINATA_JWT
    if (pinataJwt) {
      const pinataFormData = new FormData()
      pinataFormData.append("file", file, `${randomUUID()}${sanitizeExtension(file.name)}`)

      const pinataMetadata = {
        name: file.name || "bondforge-asset",
      }
      pinataFormData.append("pinataMetadata", JSON.stringify(pinataMetadata))

      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
        },
        body: pinataFormData,
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.IpfsHash) {
        return NextResponse.json(
          { error: payload?.error?.reason || payload?.message || "Pinata 上传失败" },
          { status: 500 },
        )
      }

      const hash = String(payload.IpfsHash)
      return NextResponse.json({
        url: `${resolvePinataGateway()}/${hash}`,
        ipfsUri: `ipfs://${hash}`,
        filename: file.name || hash,
      })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const uploadsDir = path.join(process.cwd(), "public", "dev-uploads")
    await mkdir(uploadsDir, { recursive: true })

    const filename = `${randomUUID()}${sanitizeExtension(file.name)}`
    const destination = path.join(uploadsDir, filename)
    await writeFile(destination, bytes)

    return NextResponse.json({
      url: `/dev-uploads/${filename}`,
      ipfsUri: "",
      filename,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upload error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
