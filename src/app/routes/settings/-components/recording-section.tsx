import { EXPIRING_LEAD_DAY_OPTIONS, LANGUAGE_LABELS, type LanguagePreference, useSettings } from '../-lib/settings'
import { StNote, StPanel, StRow, StSelect, StSwitch } from './controls'
import { AutoIcon, ClockIcon, LanguageIcon, RecordIcon, WarnIcon } from './icons'
import { PgSec } from './section'

const LEAD_DAY_SELECT = EXPIRING_LEAD_DAY_OPTIONS.map((days) => ({ value: String(days), label: `${days} 日前から` }))

const LANGUAGE_SELECT = (Object.keys(LANGUAGE_LABELS) as LanguagePreference[]).map((value) => ({
  value,
  label: LANGUAGE_LABELS[value]
}))

export const RecordingSection = () => {
  const { settings, update } = useSettings()

  return (
    <PgSec id='s-rec' title='録画' count='Nagisa への依頼と予約のふるまい'>
      <StPanel>
        {/* anime/$id の「録画済み」トグルが、この値のとき録画リクエストも一緒に送る。 */}
        <StRow
          index={0}
          icon={<RecordIcon />}
          label='録画済みにしたら録画も依頼する'
          description='詳細画面で「録画済み」を ON にしたとき、Nagisa へ録画リクエストも送る。'
        >
          <StNote>{settings.requestRecordingOnMark ? '依頼する' : '依頼しない'}</StNote>
          <StSwitch
            label='録画済みにしたら録画も依頼する'
            checked={settings.requestRecordingOnMark}
            onCheckedChange={(next) => update('requestRecordingOnMark', next)}
          />
        </StRow>

        {/* recordings の「選択分を解除」が、この値のとき確認ダイアログを挟む。 */}
        <StRow
          index={1}
          icon={<WarnIcon />}
          label='一括解除の前に確認する'
          description='録画一覧で複数まとめて予約解除するとき、確認を挟む。'
        >
          <StNote>{settings.confirmBulkCancel ? '確認する' : '確認しない'}</StNote>
          <StSwitch
            label='一括解除の前に確認する'
            checked={settings.confirmBulkCancel}
            onCheckedChange={(next) => update('confirmBulkCancel', next)}
          />
        </StRow>

        {/* recordings の「配信終了予定」の集計と残日数の強調がこの日数を使う。
            バッジ (badge=EXPIRING) 自体の発行はバックエンド側の判定。 */}
        <StRow
          index={2}
          icon={<ClockIcon />}
          label='配信終了の予告'
          description='この日数を切った予約作品に「配信終了予定」のバッジを出す。'
        >
          <StSelect
            label='配信終了の予告'
            value={String(settings.expiringLeadDays)}
            options={LEAD_DAY_SELECT}
            onValueChange={(next) => update('expiringLeadDays', Number(next))}
          />
        </StRow>

        {/* TODO: 新着エピソードの自動予約はバックエンド側の仕組みが無いため値の保持だけ。 */}
        <StRow
          index={3}
          icon={<AutoIcon />}
          label='新着エピソードを自動で予約する'
          description='予約中の作品に新しい話数が来たら、確認せずに録画を依頼する。'
        >
          <StNote>{settings.autoScheduleNewEpisodes ? '自動' : '手動'}</StNote>
          <StSwitch
            label='新着エピソードを自動で予約する'
            checked={settings.autoScheduleNewEpisodes}
            onCheckedChange={(next) => update('autoScheduleNewEpisodes', next)}
          />
        </StRow>

        {/* admin/nagisa のジョブ投入フォームが language の初期値にこれを使う。 */}
        <StRow
          index={4}
          icon={<LanguageIcon />}
          label='既定の言語'
          description='ジョブ投入フォームの language に初期値として入る。'
        >
          <StSelect
            label='既定の言語'
            value={settings.defaultLanguage}
            options={LANGUAGE_SELECT}
            onValueChange={(next) => update('defaultLanguage', next)}
          />
        </StRow>
      </StPanel>
    </PgSec>
  )
}
