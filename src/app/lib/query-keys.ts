export const queryKeys = {
  anime: {
    all: ['anime'] as const,
    list: (filters: Record<string, unknown>) => ['anime', 'list', filters] as const,
    badged: ['anime', 'badged'] as const,
    detail: (id: string) => ['anime', 'detail', id] as const
  },
  recorder: {
    status: ['recorder', 'status'] as const,
    queueSnapshot: ['recorder', 'queue-snapshot'] as const
  },
  recordingLibrary: {
    stats: ['recording-library', 'stats'] as const,
    syncState: ['recording-library', 'sync-state'] as const
  },
  changelog: ['changelog'] as const,
  admin: {
    archiveStats: (provider: string) => ['admin', 'key-archives', 'stats', provider] as const,
    unidentified: (filters: Record<string, unknown>) => ['admin', 'unidentified', filters] as const,
    syncRuns: (filters: Record<string, unknown>) => ['admin', 'sync-runs', filters] as const,
    syncRun: (id: string) => ['admin', 'sync-run', id] as const,
    logEntries: (filters: Record<string, unknown>) => ['admin', 'log-entries', filters] as const,
    recordingEvents: (filters: Record<string, unknown>) => ['admin', 'recording-events', filters] as const,
    syncRunStats: ['admin', 'sync-runs', 'stats'] as const
  }
}
