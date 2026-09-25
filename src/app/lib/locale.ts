import { defaultLocale, getLocaleFromStorageClient, type LocalesValues } from 'intlayer'

/**
 * 起動時に確定する表示言語。モジュールスコープの getIntlayer() や toLocaleString() はこれを渡す。
 * getIntlayer() はロケール未指定だと既定言語に固定されるため、言語の切替はリロードで反映させる
 * (設定画面の言語切替が setLocale 後に location.reload() する)。
 */
export const appLocale: LocalesValues = getLocaleFromStorageClient() ?? defaultLocale
