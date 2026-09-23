export const queryKeys = {
  anime: {
    all: ['anime'] as const,
    list: (filters: Record<string, unknown>) => ['anime', 'list', filters] as const,
    badged: ['anime', 'badged'] as const,
    detail: (id: string) => ['anime', 'detail', id] as const
  },
  nagisa: {
    status: ['nagisa', 'status'] as const,
    queueSnapshot: ['nagisa', 'queue-snapshot'] as const,
    libraryStats: ['nagisa', 'library-stats'] as const,
    syncState: ['nagisa', 'sync-state'] as const
  },
  changelog: ['changelog'] as const,
  admin: {
    archiveStats: ['admin', 'archive-stats'] as const,
    unidentified: (filters: Record<string, unknown>) => ['admin', 'unidentified', filters] as const,
    syncRuns: (filters: Record<string, unknown>) => ['admin', 'sync-runs', filters] as const,
    syncRun: (id: string) => ['admin', 'sync-run', id] as const,
    logEntries: (filters: Record<string, unknown>) => ['admin', 'log-entries', filters] as const,
    logStats: ['admin', 'log-stats'] as const
  }
}
