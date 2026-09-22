/**
 * geo ブロックされたホストを VPN 出口の SOCKS5 プロキシ経由で取得するための薄い層。
 *
 * Bun の fetch は proxy に socks5 を受け付けない (UnsupportedProxyProtocol) ため、
 * プロキシが要るホストだけ curl を起こして取る。それ以外は従来どおり fetch を使う。
 *
 * プロキシの実体は .devcontainer/compose.yaml の proxy サービス
 * (WireGuard コンテナのネットワーク名前空間に同居する SOCKS5、既定で vpn:1080)。
 * ANALYSIS_PROXY / ANALYSIS_PROXY_HOSTS で上書きできる。
 */

/** curl に渡す `host:port`。socks5h:// は付いていても付いていなくてもよい */
const PROXY = (process.env.ANALYSIS_PROXY ?? 'vpn:1080').replace(/^socks5h?:\/\//, '')

/** 日本の IP からは 301 + エラーページになり、実体が取れないホスト */
export const PROXY_HOSTS = new Set((process.env.ANALYSIS_PROXY_HOSTS ?? 'www.crunchyroll.com').split(','))

export const hostOf = (url: string): string => {
  try {
    return new URL(url).host
  } catch {
    return '<invalid>'
  }
}

export const viaProxy = (url: string): boolean => PROXY_HOSTS.has(hostOf(url))

export type Probe = { status: number; contentType: string; bytes: number | null }
export type Downloaded = { status: number; contentType: string; body: Uint8Array | null }

const META = 'NAGISA-META\t'

/**
 * curl を1回起こす。body は stdout、ステータスと content-type は `%{stderr}` で
 * stderr に出させて混ざらないようにする (curl 7.81 には `%{header_json}` が無い)。
 */
async function curlRun(url: string, timeoutMs: number, args: string[]): Promise<{ meta: string[]; body: Uint8Array }> {
  const proc = Bun.spawn(
    [
      'curl',
      '-sS',
      '--socks5-hostname',
      PROXY,
      '--max-time',
      String(Math.ceil(timeoutMs / 1000)),
      '-o',
      '-',
      '-w',
      `%{stderr}${META}%{http_code}\t%{content_type}\t%{size_download}`,
      ...args,
      url
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  const [body, stderr] = await Promise.all([
    new Response(proc.stdout).bytes(),
    new Response(proc.stderr).text()
  ])
  await proc.exited
  const line = stderr.split('\n').find((l) => l.startsWith(META))
  if (line === undefined) throw new Error(stderr.trim().split('\n').at(-1) ?? 'curl failed')
  return { meta: line.slice(META.length).split('\t'), body }
}

/** fetch 応答を Probe に落とす。content-length が無ければ bytes は null */
const fromResponse = (res: Response, len: string | null): Probe => ({
  status: res.status,
  contentType: res.headers.get('content-type') ?? '',
  bytes: len === null ? null : Number.parseInt(len, 10)
})

/**
 * 元画像のバイト数を実測する。安い順に HEAD → Range GET → 全body と諦めていく。
 *
 * Crunchyroll の imgsrv は HEAD に content-length を返さず Range も無視して 200 で
 * 全body を返すため、プロキシ経由のホストは最初から全body を取る。
 */
export async function probeSize(url: string, timeoutMs: number): Promise<Probe> {
  if (viaProxy(url)) {
    const { meta, body } = await curlRun(url, timeoutMs, [])
    const [status, contentType] = meta
    return {
      status: Number.parseInt(status, 10),
      contentType,
      // geo ブロックは 200 + HTML で返る。画像でなければサイズとして数えない
      bytes: contentType.startsWith('image/') ? body.byteLength : null
    }
  }

  let res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(timeoutMs) })
  let len = res.headers.get('content-length')
  if (!res.ok || len === null) {
    // HEAD を拒む / Content-Length を返さないホスト向けに 1 バイトだけ取る
    res = await fetch(url, { headers: { range: 'bytes=0-0' }, signal: AbortSignal.timeout(timeoutMs) })
    const cr = res.headers.get('content-range')
    len = cr ? (cr.split('/')[1] ?? null) : res.headers.get('content-length')
    await res.body?.cancel()
  }
  const probe = fromResponse(res, len)
  return probe.contentType.startsWith('image/') ? probe : { ...probe, bytes: null }
}

/** 変換にかけるため本体を取る。画像でなければ body は null */
export async function download(url: string, timeoutMs: number): Promise<Downloaded> {
  if (viaProxy(url)) {
    const { meta, body } = await curlRun(url, timeoutMs, [])
    const [status, contentType] = meta
    return {
      status: Number.parseInt(status, 10),
      contentType,
      body: contentType.startsWith('image/') ? body : null
    }
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  const contentType = res.headers.get('content-type') ?? ''
  if (!res.ok || !contentType.startsWith('image/')) {
    await res.body?.cancel()
    return { status: res.status, contentType, body: null }
  }
  return { status: res.status, contentType, body: await res.bytes() }
}
