import { describe, expect, test } from 'bun:test'
import { imageBaseKey, imageKey, originalKey, webpKey } from '../../src/lib/image-key'

const URL_A = 'https://image.tmdb.org/t/p/original/abc123.jpg'
const URL_B = 'https://image.tmdb.org/t/p/original/def456.jpg'

describe('image-key', () => {
  test('同じ URL からは常に同じ基底キーが導出される', () => {
    expect(imageBaseKey(URL_A)).toBe(imageBaseKey(URL_A))
    expect(imageBaseKey(URL_A)).not.toBe(imageBaseKey(URL_B))
  })

  test('幅なしの webpKey はバッチ投入済みの imageKey と一致する', () => {
    expect(webpKey(URL_A)).toBe(imageKey(URL_A))
    expect(webpKey(URL_A)).toBe(`${imageBaseKey(URL_A)}.webp`)
  })

  test('幅ありの webpKey は基底キー配下に幅ごとのオブジェクトを作る', () => {
    expect(webpKey(URL_A, 400)).toBe(`${imageBaseKey(URL_A)}/w400.webp`)
    expect(webpKey(URL_A, 400)).not.toBe(webpKey(URL_A, 800))
    expect(webpKey(URL_A, 400)).not.toBe(webpKey(URL_A))
  })

  test('originalKey は基底キー配下の original で、WebP のキーとは衝突しない', () => {
    expect(originalKey(URL_A)).toBe(`${imageBaseKey(URL_A)}/original`)
    expect(originalKey(URL_A)).not.toBe(webpKey(URL_A))
    expect(originalKey(URL_A)).not.toBe(originalKey(URL_B))
  })
})
