import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getIntlayer } from 'intlayer'
import { useIntlayer } from 'react-intlayer'
import api from '@/app/lib/api'
import { appLocale } from '@/app/lib/locale'
import { queryKeys } from '@/app/lib/query-keys'
import { recordingSettingsQueryOptions } from '@/app/lib/query-options'
import { EXPIRING_LEAD_DAY_OPTIONS, LANGUAGE_LABELS, type LanguagePreference, useSettings } from '../-lib/settings'
import { StNote, StPanel, StRow, StSelect, StSwitch } from './controls'
import { AutoIcon, ClockIcon, LanguageIcon, RecordIcon, WarnIcon } from './icons'
import { PgSec } from './section'

const recordingSectionModuleContent = getIntlayer('settings-recording-section', appLocale)

const LEAD_DAY_SELECT = EXPIRING_LEAD_DAY_OPTIONS.map((days) => ({
  value: String(days),
  label: recordingSectionModuleContent.leadDayOption({ days })
}))

const LANGUAGE_SELECT = (Object.keys(LANGUAGE_LABELS) as LanguagePreference[]).map((value) => ({
  value,
  label: LANGUAGE_LABELS[value]
}))

export const RecordingSection = () => {
  const { settings, update } = useSettings()
  const content = useIntlayer('settings-recording-section')
  const queryClient = useQueryClient()
  // 自動録画の ON/OFF はサーバーが保存する (cron が参照するため)。読み込み中は操作させない
  const { data: server } = useQuery(recordingSettingsQueryOptions())
  const autoSchedule = useMutation({
    mutationFn: (next: boolean) => api.updateRecordingSettings({ autoScheduleNewEpisodes: next }),
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.settings.recording, saved)
  })
  const autoScheduleOn = autoSchedule.isPending ? autoSchedule.variables : server?.autoScheduleNewEpisodes

  return (
    <PgSec id='s-rec' title={content.title.value} count={content.count}>
      <StPanel>
        {/* anime/$id の「録画済み」トグルが、この値のとき録画リクエストも一緒に送る。 */}
        <StRow
          index={0}
          icon={<RecordIcon />}
          label={content.requestOnMark.label.value}
          description={content.requestOnMark.description}
        >
          <StNote>{settings.requestRecordingOnMark ? content.requestOnMark.on : content.requestOnMark.off}</StNote>
          <StSwitch
            label={content.requestOnMark.label.value}
            checked={settings.requestRecordingOnMark}
            onCheckedChange={(next) => update('requestRecordingOnMark', next)}
          />
        </StRow>

        {/* recordings の「選択分を解除」が、この値のとき確認ダイアログを挟む。 */}
        <StRow
          index={1}
          icon={<WarnIcon />}
          label={content.confirmBulkCancel.label.value}
          description={content.confirmBulkCancel.description}
        >
          <StNote>{settings.confirmBulkCancel ? content.confirmBulkCancel.on : content.confirmBulkCancel.off}</StNote>
          <StSwitch
            label={content.confirmBulkCancel.label.value}
            checked={settings.confirmBulkCancel}
            onCheckedChange={(next) => update('confirmBulkCancel', next)}
          />
        </StRow>

        {/* recordings の「配信終了予定」の集計と残日数の強調がこの日数を使う。
            バッジ (badge=EXPIRING) 自体の発行はバックエンド側の判定。 */}
        <StRow
          index={2}
          icon={<ClockIcon />}
          label={content.expiringLeadDays.label.value}
          description={content.expiringLeadDays.description}
        >
          <StSelect
            label={content.expiringLeadDays.label.value}
            value={String(settings.expiringLeadDays)}
            options={LEAD_DAY_SELECT}
            onValueChange={(next) => update('expiringLeadDays', Number(next))}
          />
        </StRow>

        {/* サーバー保存。OFF のとき毎時 cron の掃引も update 後の自動録画も止まる。 */}
        <StRow
          index={3}
          icon={<AutoIcon />}
          label={content.autoSchedule.label.value}
          description={content.autoSchedule.description}
        >
          <StNote>{autoScheduleOn ? content.autoSchedule.on : content.autoSchedule.off}</StNote>
          <StSwitch
            label={content.autoSchedule.label.value}
            checked={autoScheduleOn ?? false}
            disabled={server === undefined}
            onCheckedChange={(next) => autoSchedule.mutate(next)}
          />
        </StRow>

        {/* admin/recorder のジョブ投入フォームが language の初期値にこれを使う。 */}
        <StRow
          index={4}
          icon={<LanguageIcon />}
          label={content.defaultLanguage.label.value}
          description={content.defaultLanguage.description}
        >
          <StSelect
            label={content.defaultLanguage.label.value}
            value={settings.defaultLanguage}
            options={LANGUAGE_SELECT}
            onValueChange={(next) => update('defaultLanguage', next)}
          />
        </StRow>
      </StPanel>
    </PgSec>
  )
}
