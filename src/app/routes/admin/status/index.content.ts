import { type Dictionary, insert, t } from 'intlayer'

const adminStatusContent = {
  key: 'admin-status',
  content: t({
    ja: {
      eyebrow: '管理',
      title: 'サーバーステータス',
      description: 'サーバーの稼働状況・キュー・録画ファイル・同期の状態を確認します。',
      loading: '取得中…',
      unknown: '不明',
      uptime: {
        days: insert('{{d}} 日 {{h}} 時間'),
        hours: insert('{{h}} 時間 {{m}} 分'),
        minutes: insert('{{m}} 分'),
        lessThanMinute: '1 分未満'
      },
      nagisaSection: {
        description: 'GET /api/status。このエンドポイントが停止している場合、このセクションのみ取得できません。',
        error: 'Nagisa に接続できません（Service Auth / BACKEND_URL を確認してください）',
        version: 'バージョン',
        uptimeNote: insert('稼働 {{uptime}}'),
        redisLabel: 'Redis',
        redisConnected: '接続中',
        redisDisconnected: '未接続',
        redisUnknownNote: 'Nagisa から情報が返されていません',
        redisMemoryNote: insert('メモリ {{memory}}'),
        cpuMemory: 'CPU / メモリ',
        cpuMemoryNote: 'ホストの使用率',
        diskFree: 'ディスク空き容量',
        diskFreeNote: '録画先の空き容量'
      },
      queueSection: {
        title: 'キュー',
        description:
          'GET /api/queue/snapshot。completed / failed は保持期間を過ぎると削除されるため、件数は目安です。録画完了は台帳で確認します。',
        error: 'キューのスナップショットを取得できません',
        unit: '件',
        active: '実行中',
        activeNote: 'ダウンロード中',
        waiting: '待機中',
        waitingNote: insert('うち遅延 {{count}} 件'),
        failed: '失敗',
        failedNote: 'キューに残っている失敗ジョブ',
        completed: '完了',
        completedNote: '保持期間内のもののみ',
        fetchedAt: insert('取得時刻 {{time}}')
      },
      librarySection: {
        title: '録画サーバー',
        description: 'GET /api/library/stats。録画ファイルの集計です。',
        error: '台帳の集計を取得できません',
        unit: '件',
        recordings: '録画ファイル',
        recordingsNote: '台帳に登録されているファイル',
        unresolved: '未解決',
        unresolvedNote: 'provider / episode_id と照合できていません',
        totalSize: '合計サイズ',
        totalSizeNote: 'ライブラリ全体',
        position: '台帳の位置'
      },
      syncSection: {
        title: 'データベース',
        description: 'ローカルの D1 のみを参照するため、Nagisa が停止していても表示されます。',
        error: '同期状態を取得できません',
        staleWarning: '再取得に失敗しました。以下は直前に取得できた内容です。',
        unit: '件',
        lastSucceeded: '最終成功',
        neverRun: '未実行',
        neverRunNote: '同期が正常に完了したことはありません',
        cursor: 'カーソル',
        cursorSnapshotting: '初回取り込み中',
        cursorUnfetched: '未取得',
        cursorTracking: '差分を追跡中',
        cursorSnapshotStartedNote: insert('{{time}} に開始'),
        cursorNeverRunNote: '台帳同期はまだ実行されていません',
        cursorTrackingNote: '差分カーソルを保持しています',
        lock: '実行ロック',
        lockFree: '空き',
        lockExpired: '期限切れ',
        lockRunning: '実行中',
        lockFreeNote: '同期は実行されていません',
        lockExpiredNote: insert('{{owner}} のロックが {{time}} に失効しました（異常終了の可能性があります）'),
        lockRunningNote: insert('{{owner}} / {{time}} まで'),
        tracked: '追跡中',
        trackedNote: 'ジョブ ID がある待機中・実行中のジョブ'
      },
      breakdownSection: {
        title: '録画状態',
        descriptionError: 'エピソード単位の集計です。再取得に失敗したため、直前に取得できた件数を表示しています。',
        descriptionOk: 'エピソード単位の集計です。completed に更新できるのは台帳同期のみです。',
        status: '状態',
        count: '件数',
        meaning: '意味'
      }
    },
    en: {
      eyebrow: 'Admin',
      title: 'Server status',
      description: 'Check server health, queues, recording files, and sync status.',
      loading: 'Loading…',
      unknown: 'Unknown',
      uptime: {
        days: insert('{{d}} d {{h}} hr'),
        hours: insert('{{h}} hr {{m}} min'),
        minutes: insert('{{m}} min'),
        lessThanMinute: 'Less than a minute'
      },
      nagisaSection: {
        description: 'GET /api/status. Only this section becomes unavailable if this endpoint is down.',
        error: 'Cannot connect to Nagisa (check Service Auth / BACKEND_URL)',
        version: 'Version',
        uptimeNote: insert('Uptime: {{uptime}}'),
        redisLabel: 'Redis',
        redisConnected: 'Connected',
        redisDisconnected: 'Disconnected',
        redisUnknownNote: 'Nagisa has not returned this information',
        redisMemoryNote: insert('Memory: {{memory}}'),
        cpuMemory: 'CPU / Memory',
        cpuMemoryNote: 'Host resource usage',
        diskFree: 'Free disk space',
        diskFreeNote: 'Free space on the recording destination'
      },
      queueSection: {
        title: 'Queue',
        description:
          'GET /api/queue/snapshot. Completed and failed jobs expire, so counts are approximate. The library confirms completed recordings.',
        error: 'Failed to load the queue snapshot',
        unit: 'items',
        active: 'Running',
        activeNote: 'Downloading',
        waiting: 'Waiting',
        waitingNote: insert('Delayed: {{count}}'),
        failed: 'Failed',
        failedNote: 'Failed jobs still in the queue',
        completed: 'Completed',
        completedNote: 'Within the retention period only',
        fetchedAt: insert('Fetched at {{time}}')
      },
      librarySection: {
        title: 'Recording server',
        description: 'GET /api/library/stats. Counts of recording files.',
        error: 'Failed to load library statistics',
        unit: 'items',
        recordings: 'Recording files',
        recordingsNote: 'Files listed in the library',
        unresolved: 'Unresolved',
        unresolvedNote: 'Not yet matched to a provider / episode_id',
        totalSize: 'Total size',
        totalSizeNote: 'Entire library',
        position: 'Library position'
      },
      syncSection: {
        title: 'Database',
        description: 'Reads only local D1 data, so this section remains available when Nagisa is down.',
        error: 'Failed to load sync status',
        staleWarning: 'Refresh failed. Showing the last successfully loaded data.',
        unit: 'items',
        lastSucceeded: 'Last successful sync',
        neverRun: 'Never run',
        neverRunNote: 'No sync has completed successfully',
        cursor: 'Cursor',
        cursorSnapshotting: 'Initial import in progress',
        cursorUnfetched: 'Not fetched',
        cursorTracking: 'Tracking changes',
        cursorSnapshotStartedNote: insert('Started at {{time}}'),
        cursorNeverRunNote: 'Library sync has not run yet',
        cursorTrackingNote: 'Delta cursor saved',
        lock: 'Execution lock',
        lockFree: 'Available',
        lockExpired: 'Expired',
        lockRunning: 'Running',
        lockFreeNote: 'No sync is running',
        lockExpiredNote: insert('{{owner}} expired at {{time}} (may have terminated unexpectedly)'),
        lockRunningNote: insert('{{owner}} / until {{time}}'),
        tracked: 'Tracked',
        trackedNote: 'Waiting or running jobs with a job ID'
      },
      breakdownSection: {
        title: 'Recording status',
        descriptionError: 'Counts by episode. Refresh failed, so the last successfully loaded counts are shown.',
        descriptionOk: 'Counts by episode. Only library sync can set the status to completed.',
        status: 'Status',
        count: 'Count',
        meaning: 'Meaning'
      }
    }
  })
} satisfies Dictionary

export default adminStatusContent
