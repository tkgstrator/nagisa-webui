import { describe, expect, test } from 'bun:test'
import { NagisaQueueSnapshotSchema } from '../../src/schemas/nagisa.dto'

const job = (over: Record<string, unknown>) => ({
  job_id: 'j1',
  state: 'wait',
  provider: 'amazon',
  content_id: 'B0TEST',
  title: null,
  seasons: null,
  progress: null,
  attempts: 0,
  failed_reason: null,
  timestamp: 0,
  processed_on: null,
  finished_on: null,
  ...over
})

const snapshot = (jobs: unknown[]) => ({
  jobs,
  counts: { active: 0, wait: jobs.length, completed: 0, failed: 0, delayed: 0 },
  generated_at: 0
})

describe('NagisaQueueSnapshotSchema', () => {
  test('台帳の reindex ジョブ (provider / content_id が null) が居ても読める', () => {
    const parsed = NagisaQueueSnapshotSchema.parse(
      snapshot([job({ provider: null, content_id: null }), job({ job_id: 'j2' })])
    )
    expect(parsed.jobs.map((j) => j.job_id)).toEqual(['j1', 'j2'])
  })

  test('全話指定のシーズン (episodes: null) が居ても読める', () => {
    const parsed = NagisaQueueSnapshotSchema.parse(snapshot([job({ seasons: [{ season_number: 1, episodes: null }] })]))
    expect(parsed.jobs[0].seasons).toEqual([{ season_number: 1, episodes: null }])
  })
})
