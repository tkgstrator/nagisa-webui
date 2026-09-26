/**
 * `docs/mock-diff/src/comp/tone-palette-astra.css` の 6 ロール。
 * `.tone-{name}` を要素に当てると `--tone-bg/fg/border/dot/soft/ink` が揃う (定義は src/index.css)。
 */
export type Tone = "primary" | "success" | "info" | "warning" | "destructive" | "muted"

export const toneClassName: Record<Tone, string> = {
  primary: "tone-primary",
  success: "tone-success",
  info: "tone-info",
  warning: "tone-warning",
  destructive: "tone-destructive",
  muted: "tone-muted",
}
