/**
 * ABEMA HLS プレイリストのパースと、それに使う hex / base58 の純関数。
 * 副作用も WebCrypto も持たないので、鍵派生 (`hls.ts`) から切り離している。
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const EXT_X_KEY_RE = /#EXT-X-KEY:METHOD=(?<method>[A-Z0-9-]+)(?:,URI="(?<uri>[^"]+)")?(?:,IV=0x(?<iv>[0-9a-fA-F]+))?/
const LICENSE_URI_RE = /^abematv-license:\/\/(?<lt>[^/?#]+)$/

// =====================================================================
// 型
// =====================================================================

export interface HlsKeyEntry {
  method: string
  uri: string
  iv: Uint8Array
  licenseTicket: string
}

export interface HlsVariant {
  baseUrl: string
  keys: HlsKeyEntry[]
  segmentUrls: string[]
  segmentDurations: number[]
  targetDuration: number
}

export interface MasterVariant {
  bandwidth: number
  resolution: string
  url: string
}

// =====================================================================
// 純関数: hex / base58 / playlist パース
// =====================================================================

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new Error(`hex length must be even, got ${hex.length}`)
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return out
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

/**
 * ABEMA で使われる base58 文字列 (16 バイト固定) を Uint8Array に decode。
 * encrypted content key の取り出し用。
 */
export function base58Decode16(s: string): Uint8Array<ArrayBuffer> {
  // BigInt で累積乗算 (16 bytes → 128 bit、JS の Number だと精度不足)
  let n = 0n
  for (const c of s) {
    const idx = BASE58_ALPHABET.indexOf(c)
    if (idx < 0) throw new Error(`Invalid base58 character: ${JSON.stringify(c)}`)
    n = n * 58n + BigInt(idx)
  }
  const out = new Uint8Array(16)
  for (let i = 15; i >= 0; i--) {
    out[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return out
}

export function parseLicenseUri(uri: string): string {
  const m = LICENSE_URI_RE.exec(uri.trim())
  if (!m?.groups) throw new Error(`Not an Abema license URI: ${JSON.stringify(uri)}`)
  return m.groups.lt
}

function resolveUrl(base: string, relative: string): string {
  return new URL(relative, base).toString()
}

export function parseMasterPlaylist(text: string, baseUrl: string): MasterVariant[] {
  const lines = text.split(/\r?\n/)
  const out: MasterVariant[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('#EXT-X-STREAM-INF:')) continue
    const attrs = line.substring('#EXT-X-STREAM-INF:'.length)
    let bandwidth = 0
    let resolution = ''
    for (const kv of attrs.split(',')) {
      const eq = kv.indexOf('=')
      if (eq < 0) continue
      const key = kv.substring(0, eq).trim()
      const val = kv.substring(eq + 1).trim()
      if (key === 'BANDWIDTH') bandwidth = Number.parseInt(val, 10)
      else if (key === 'RESOLUTION') resolution = val
    }
    if (i + 1 < lines.length) {
      const url = resolveUrl(baseUrl, lines[i + 1].trim())
      out.push({ bandwidth, resolution, url })
      i++
    }
  }
  return out
}

export function parseVariantPlaylist(text: string, baseUrl: string): HlsVariant {
  const out: HlsVariant = { baseUrl, keys: [], segmentUrls: [], segmentDurations: [], targetDuration: 0 }
  let nextDuration = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#EXT-X-KEY:')) {
      const m = EXT_X_KEY_RE.exec(line)
      if (!m?.groups) continue
      const method = m.groups.method
      const uri = m.groups.uri ?? ''
      const ivHex = m.groups.iv ?? ''
      let lt = ''
      try {
        lt = uri ? parseLicenseUri(uri) : ''
      } catch {
        // 無効な URI は ticket 空文字で残す
      }
      const iv = ivHex ? hexToBytes(ivHex) : new Uint8Array(0)
      out.keys.push({ method, uri, iv, licenseTicket: lt })
    } else if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      const v = Number.parseInt(line.split(':', 2)[1] ?? '0', 10)
      if (!Number.isNaN(v)) out.targetDuration = v
    } else if (line.startsWith('#EXTINF:')) {
      const v = Number.parseFloat((line.split(':', 2)[1] ?? '0').replace(/,$/, ''))
      nextDuration = Number.isNaN(v) ? 0 : v
    } else if (!line.startsWith('#')) {
      out.segmentUrls.push(resolveUrl(baseUrl, line))
      out.segmentDurations.push(nextDuration)
      nextDuration = 0
    }
  }
  return out
}
