"use client"

import { LaunchLocalMeta } from './types'

function key(address: string) {
  return `bondforge:meta:${address.toLowerCase()}`
}

function allMetaKeys() {
  if (typeof window === 'undefined') return []
  const keys: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const current = window.localStorage.key(index)
    if (current?.startsWith('bondforge:meta:')) {
      keys.push(current)
    }
  }
  return keys
}

function compactMeta(value: LaunchLocalMeta): LaunchLocalMeta {
  return {
    imageDataUrl: value.imageDataUrl && value.imageDataUrl.length < 2048 ? value.imageDataUrl : undefined,
    bannerDataUrl: value.bannerDataUrl && value.bannerDataUrl.length < 2048 ? value.bannerDataUrl : undefined,
    nftMode: value.nftMode,
  }
}

export function saveLocalMeta(address: string, value: LaunchLocalMeta) {
  if (typeof window === 'undefined') return
  const storageKey = key(address)
  const payload = JSON.stringify(compactMeta(value))

  try {
    window.localStorage.setItem(storageKey, payload)
    return
  } catch {}

  for (const staleKey of allMetaKeys()) {
    if (staleKey !== storageKey) {
      window.localStorage.removeItem(staleKey)
    }
  }

  try {
    window.localStorage.setItem(storageKey, payload)
  } catch {
    window.localStorage.removeItem(storageKey)
  }
}

export function getLocalMeta(address: string): LaunchLocalMeta | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(key(address))
  if (!raw) return null
  try { return JSON.parse(raw) as LaunchLocalMeta } catch { return null }
}
