import dayjs from 'dayjs'
import { TokenResponseSchema } from '../../../schemas/providers/crunchyroll.dto'

const TOKEN_URL = 'https://beta-api.crunchyroll.com/auth/v1/token'
/** Android TV アプリの公開クライアント資格情報 (base64 の client_id:client_secret) */
const BASIC_AUTH_TOKEN = 'ZXI5bmdnMmtvNW9oaXJsYTUxaTI6VmwxVDBQbjhRWko2d3o0NnhYRGxIekRGUDV0Wlgxb3E='
/** Android TV アプリ相当の User-Agent (www は Cloudflare に弾かれるため beta-api と併用) */
export const CR_USER_AGENT =
  'Crunchyroll/ANDROIDTV/3.76.0_22366 (Android 12; en-US; SHIELD Android TV Build/SR1A.220624.014)'

const tokenCache = { token: null as string | null, expiresAt: dayjs(0) }

/**
 * Anonymous Bearer トークンを取得する。
 * キャッシュ済みで有効期限内ならそのまま返す。
 */
export async function getAccessToken(): Promise<string> {
  if (tokenCache.token && dayjs().isBefore(tokenCache.expiresAt)) return tokenCache.token

  const [clientId, clientSecret] = atob(BASIC_AUTH_TOKEN).split(':')
  const deviceId = crypto.randomUUID()

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'ETP-Anonymous-ID': deviceId,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': CR_USER_AGENT
    },
    body: new URLSearchParams({
      grant_type: 'client_id',
      scope: 'offline_access',
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
      device_id: deviceId,
      device_name: 'emu64xa',
      device_type: 'ANDROIDTV'
    })
  })

  if (!res.ok) {
    // 調査用に本文の先頭のみ付ける (HTML 全文は付けない)
    const body = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(`Crunchyroll auth failed: ${res.status} ${res.statusText} ${body}`.trimEnd())
  }

  const result = TokenResponseSchema.safeParse(await res.json())
  if (!result.success) throw result.error
  const data = result.data
  tokenCache.token = data.access_token
  // 有効期限の 60 秒前にリフレッシュ
  tokenCache.expiresAt = dayjs().add(data.expires_in - 60, 'second')
  return tokenCache.token
}
