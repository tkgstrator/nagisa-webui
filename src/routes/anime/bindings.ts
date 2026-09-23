import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Message } from '../../schemas/message.dto'

export type Bindings = {
  DB: D1Database
  TMDB_API_KEY: string
  BACKEND_URL: string
  CF_ACCESS_CLIENT_ID: string
  CF_ACCESS_CLIENT_SECRET: string
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
  LAMBDA_FUNCTION_URL: string
  LAMBDA_FUNCTION_URL_US: string
  KV: KVNamespace
  IMAGES: R2Bucket
  WARM_QUEUE: Queue<Message>
}

export type AnimeApp = OpenAPIHono<{ Bindings: Bindings }>
