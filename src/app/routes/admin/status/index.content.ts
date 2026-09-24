import { type Dictionary, insert, t } from 'intlayer'

const adminStatusContent = {
  key: 'admin-status',
  content: t({
    ja: {
      title: 'サーバーステータス',
      description: 'Nagisa の稼働状況・キュー・録画台帳と、WebUI 側がどこまで同期できているか',
      loading: '取得中…',
      unknown: '不明',
      uptime: {
        days: insert('{{d}} 日 {{h}} 時間'),
        hours: insert('{{h}} 時間 {{m}} 分'),
        minutes: insert('{{m}} 分'),
        lessThanMinute: '1 分未満'
      },
      nagisaSection: {
        description: 'GET /api/status。落ちていればここだけが取得できなくなる',
        error: 'Nagisa に接続できません (Service Auth / BACKEND_URL を確認)',
        version: 'バージョン',
        uptimeNote: insert('稼働 {{uptime}}'),
        redisLabel: 'Redis',
        redisConnected: '接続',
        redisDisconnected: '切断',
        redisUnknownNote: 'nagisa が情報を返していない',
        redisMemoryNote: insert('メモリ {{memory}}'),
        cpuMemory: 'CPU / メモリ',
        cpuMemoryNote: 'ホストの使用率',
        diskFree: 'ディスク空き',
        diskFreeNote: '録画先の空き容量'
      },
      queueSection: {
        title: 'キュー',
        description: 'GET /api/queue/snapshot。completed / failed は保持期間で落ちるので件数は目安 (完了の根拠は台帳)',
        error: 'キューのスナップショットを取得できません',
        unit: '件',
        active: '実行中',
        activeNote: 'ダウンロード中',
        waiting: '待機',
        waitingNote: insert('うち遅延 {{count}} 件'),
        failed: '失敗',
        failedNote: 'キューに残っている失敗',
        completed: '完了',
        completedNote: '保持期間内のもののみ',
        fetchedAt: insert('取得時刻 {{time}}')
      },
      librarySection: {
        title: '録画台帳 (Nagisa)',
        description: 'GET /api/library/stats。実体のファイルを数えたもの',
        error: '台帳の集計を取得できません',
        unit: '件',
        recordings: '録画ファイル',
        recordingsNote: '台帳が把握している実体',
        unresolved: '未解決',
        unresolvedNote: 'provider / episode_id を当てられていない',
        totalSize: '合計サイズ',
        totalSizeNote: 'ライブラリ全体',
        position: '台帳の位置'
      },
      syncSection: {
        title: 'WebUI 側の同期',
        description: 'ローカル D1 だけを見るので、Nagisa が落ちていてもここは必ず出る',
        error: '同期状態を取得できません',
        staleWarning: '再取得に失敗しています (以下は直前に取得できた内容)',
        unit: '件',
        lastSucceeded: '最終成功',
        neverRun: '未実行',
        neverRunNote: '一度も完走していない',
        cursor: 'カーソル',
        cursorSnapshotting: '初回取り込み中',
        cursorUnfetched: '未取得',
        cursorTracking: '差分を追跡中',
        cursorSnapshotStartedNote: insert('{{time}}に開始'),
        cursorNeverRunNote: '台帳同期をまだ走らせていない',
        cursorTrackingNote: '差分カーソルを保持している',
        lock: '実行ロック',
        lockFree: '空き',
        lockExpired: '期限切れ',
        lockRunning: '実行中',
        lockFreeNote: '同期は走っていない',
        lockExpiredNote: insert('{{owner}} が {{time}}に失効 (異常終了の疑い)'),
        lockRunningNote: insert('{{owner}} / {{time}}まで'),
        tracked: '追跡中',
        trackedNote: 'job id を持つ待機 / 実行中'
      },
      breakdownSection: {
        title: '録画状態の内訳',
        descriptionError: 'エピソード単位。再取得に失敗しているので、以下は直前に取得できた件数',
        descriptionOk: 'エピソード単位。completed を書けるのは台帳同期だけ',
        status: '状態',
        count: '件数',
        meaning: '意味'
      }
    }
  })
} satisfies Dictionary

export default adminStatusContent
