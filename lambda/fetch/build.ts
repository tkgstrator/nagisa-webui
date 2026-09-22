/**
 * anime-tracker/fetch Lambda を Docker image としてビルドし、東京 + US 両方の ECR に push する。
 *
 * 使い方: `bun run deploy:lambda` (package.json 参照)
 * 前提:
 *   - docker (buildx 有効化済) が利用可能
 *   - aws CLI がインストール済み、default profile で ECR: PutImage 権限あり
 *   - 事前に qtmleap/infra 側で両リージョンの ECR リポジトリ (anime-tracker/fetch) を apply 済み
 *
 * Lambda container image は関数と同一リージョンの ECR にしか置けない (AWS の hard limit) ため、
 * 東京 (ap-northeast-1) と US (us-east-1) の両方に同一 image を push する。
 *
 * このスクリプトは Lambda 関数本体の tag 差し替えまではやらない。
 * push 後に qtmleap/infra 側で `TF_VAR_anime_tracker_image_tag=<sha> terraform apply` を叩くこと。
 */
import { resolve } from 'node:path'

const REGIONS = ['ap-northeast-1', 'us-east-1'] as const
const REPOSITORY = 'anime-tracker/fetch'
const PLATFORM = 'linux/arm64'
const DOCKERFILE = 'lambda/fetch/Dockerfile'

const repoRoot = resolve(import.meta.dir, '..', '..')

/**
 * aws CLI に渡す env。
 *
 * ~/.aws/config の [default] には R2 の endpoint_url が入っている (ホストからマウントされた
 * ファイルで、R2 操作用に意図的にそうなっている)。そのままだと sts / ecr のリクエストまで
 * R2 に飛んで `InvalidRequest: Missing x-amz-content-sha256` で落ちるので、config ファイル
 * 自体を読ませない。資格情報はシェルの AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 * (IAM user Terraform) を使う。
 *
 * config を捨てる副作用で region も消えるため、aws を叩く箇所では必ず --region を明示する。
 */
const AWS_ENV: Record<string, string> = { AWS_CONFIG_FILE: '/dev/null' }

async function run(cmd: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): Promise<{ stdout: string }> {
  const proc = Bun.spawn(cmd, {
    cwd: opts.cwd ?? repoRoot,
    env: { ...process.env, ...opts.env },
    stdout: 'pipe',
    stderr: 'inherit',
    stdin: 'inherit'
  })
  const stdout = await new Response(proc.stdout).text()
  const code = await proc.exited
  if (code !== 0) throw new Error(`${cmd[0]} exited with code ${code}: ${cmd.join(' ')}`)
  return { stdout }
}

async function getAccountId(): Promise<string> {
  const { stdout } = await run(
    ['aws', 'sts', 'get-caller-identity', '--region', REGIONS[0], '--query', 'Account', '--output', 'text'],
    { env: AWS_ENV }
  )
  return stdout.trim()
}

async function getGitSha(): Promise<string> {
  const { stdout } = await run(['git', 'rev-parse', '--short', 'HEAD'])
  return stdout.trim()
}

/**
 * GitHub Packages (@qtmleap/*) 用の .npmrc を組み立てる。
 *
 * repo root の .npmrc は個人のトークンで失効しがちなので、gh CLI の生きたトークンを使う。
 * 中身は image layer に残さず BuildKit の secret mount で渡すので、ファイルには書かない。
 */
async function getNpmrc(): Promise<string> {
  const { stdout } = await run(['gh', 'auth', 'token'])
  const token = stdout.trim()
  if (token.length === 0) {
    throw new Error('gh auth token が空。read:packages を持つトークンで gh auth login すること')
  }
  return `@qtmleap:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${token}\n`
}

async function ensureBuildx(): Promise<void> {
  const proc = Bun.spawn(['docker', 'buildx', 'inspect', 'anime-tracker-builder'], {
    stdout: 'ignore',
    stderr: 'ignore'
  })
  if ((await proc.exited) !== 0) {
    console.log('Creating docker buildx builder "anime-tracker-builder"...')
    await run(['docker', 'buildx', 'create', '--name', 'anime-tracker-builder', '--use'])
  } else {
    await run(['docker', 'buildx', 'use', 'anime-tracker-builder'])
  }
}

async function ecrLogin(region: string, registry: string): Promise<void> {
  console.log(`Logging in to ECR ${registry}...`)
  const pw = Bun.spawn(['aws', 'ecr', 'get-login-password', '--region', region], {
    env: { ...process.env, ...AWS_ENV },
    stdout: 'pipe',
    stderr: 'inherit'
  })
  const password = await new Response(pw.stdout).text()
  if ((await pw.exited) !== 0) throw new Error(`aws ecr get-login-password failed (region=${region})`)

  const login = Bun.spawn(['docker', 'login', '--username', 'AWS', '--password-stdin', registry], {
    stdin: 'pipe',
    stdout: 'inherit',
    stderr: 'inherit'
  })
  login.stdin.write(password)
  await login.stdin.end()
  if ((await login.exited) !== 0) throw new Error(`docker login failed (registry=${registry})`)
}

/**
 * 全リージョンの tag を並べて 1 回の buildx build で push する。
 * buildx は arm64 image を一度ビルドしてから複数タグに push できるので、
 * リージョンごとに build し直す必要はない。
 */
async function buildAndPush(tags: string[], npmrc: string): Promise<void> {
  console.log(`Building & pushing image with tags:`)
  for (const t of tags) console.log(`  ${t}`)

  // Lambda が pull できる形式で push するために BuildKit のデフォルト挙動を 2 段で抑える:
  //   1. --provenance=false --sbom=false: attestation manifest を作らせない
  //      (attestation 付きだと Lambda が manifest を認識できず InvalidImage で pull 拒絶)
  //   2. --output type=image,push=true,oci-mediatypes=false: manifest / config を
  //      Docker media type で書く (OCI media type だと同じく Lambda が拒絶)
  // 詳細: aws/containers-roadmap#2172, #1985。片方だけでは動かない。
  const tagArgs = tags.flatMap((t) => ['--tag', t])
  await run(
    [
      'docker', 'buildx', 'build',
      '--platform', PLATFORM,
      '--file', DOCKERFILE,
      '--provenance=false',
      '--sbom=false',
      // bun install が @qtmleap/* を GitHub Packages から引くのに要る。env 経由なので
      // ディスクにもイメージにもトークンは残らない。
      '--secret', 'id=npmrc,env=NPMRC',
      '--output', 'type=image,push=true,oci-mediatypes=false',
      ...tagArgs,
      '.'
    ],
    { env: { NPMRC: npmrc } }
  )
}

async function main(): Promise<void> {
  const [accountId, sha, npmrc] = await Promise.all([getAccountId(), getGitSha(), getNpmrc()])

  const registries = REGIONS.map((region) => ({
    region,
    registry: `${accountId}.dkr.ecr.${region}.amazonaws.com`
  }))

  await ensureBuildx()
  for (const { region, registry } of registries) {
    await ecrLogin(region, registry)
  }

  const tags = registries.flatMap(({ registry }) => [
    `${registry}/${REPOSITORY}:${sha}`,
    `${registry}/${REPOSITORY}:latest`
  ])

  await buildAndPush(tags, npmrc)

  console.log('')
  console.log('✔ push complete.')
  console.log('')
  console.log('Next: update Lambda image_uri via terraform in qtmleap/infra:')
  console.log('')
  console.log('  cd ~/infra/services/aws/lambda')
  console.log(`  export TF_VAR_anime_tracker_image_tag=${sha}`)
  console.log('  terraform apply')
  console.log('')
}

await main()
