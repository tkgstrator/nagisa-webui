import {
  type CardDensity,
  PAGE_SIZE_OPTIONS,
  SORT_LABELS,
  type SortPreference,
  type ThemePreference,
  useSettings
} from '../-lib/settings'
import { StNote, StPanel, StRow, StSegment, StSelect, StSwitch } from './controls'
import { BoltIcon, DensityIcon, PageSizeIcon, SortIcon, ThemeIcon } from './icons'
import { PgSec } from './section'

const THEME_OPTIONS = [
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
  { value: 'system', label: 'システム' }
] as const satisfies readonly { value: ThemePreference; label: string }[]

const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'ゆったり' },
  { value: 'default', label: '標準' },
  { value: 'compact', label: '詰める' }
] as const satisfies readonly { value: CardDensity; label: string }[]

const PAGE_SIZE_SELECT = PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: `${size} 件` }))

const SORT_SELECT = (Object.keys(SORT_LABELS) as SortPreference[]).map((value) => ({
  value,
  label: SORT_LABELS[value]
}))

export const DisplaySection = () => {
  const { settings, update } = useSettings()

  return (
    <PgSec id='s-view' title='表示' count='一覧とカードの見え方'>
      <StPanel>
        <StRow index={0} icon={<ThemeIcon />} label='テーマ' description='「システム」は OS の外観設定に追従する。'>
          <StSegment
            label='テーマ'
            value={settings.theme}
            options={THEME_OPTIONS}
            onValueChange={(next) => update('theme', next)}
          />
        </StRow>

        {/* browse / recordings / admin/unidentified の一覧がこの件数で取得する。 */}
        <StRow
          index={1}
          icon={<PageSizeIcon />}
          label='1 ページの表示件数'
          description='アニメ一覧・録画一覧・未識別タイトルに適用される。'
        >
          <StSelect
            label='1 ページの表示件数'
            value={String(settings.pageSize)}
            options={PAGE_SIZE_SELECT}
            onValueChange={(next) => update('pageSize', Number(next))}
          />
        </StRow>

        {/* browse の絞り込み初期値と「すべて解除」後の並び順になる。 */}
        <StRow index={2} icon={<SortIcon />} label='既定の並び順' description='URL に指定があればそちらが優先される。'>
          <StSelect
            label='既定の並び順'
            value={settings.defaultSort}
            options={SORT_SELECT}
            onValueChange={(next) => update('defaultSort', next)}
          />
        </StRow>

        {/* browse のカードグリッドの列数と余白がこの値で変わる。 */}
        <StRow
          index={3}
          icon={<DensityIcon />}
          label='カードの密度'
          description='1 行あたりの枚数とサムネイルの大きさが変わる。'
        >
          <StSegment
            label='カードの密度'
            value={settings.density}
            options={DENSITY_OPTIONS}
            onValueChange={(next) => update('density', next)}
          />
        </StRow>

        <StRow
          index={4}
          icon={<BoltIcon />}
          label='アニメーション'
          description='OS で「視差を減らす」が有効なときは、この設定によらず抑制される。'
        >
          <StNote>{settings.animations ? '有効' : '無効'}</StNote>
          <StSwitch
            label='アニメーション'
            checked={settings.animations}
            onCheckedChange={(next) => update('animations', next)}
          />
        </StRow>
      </StPanel>
    </PgSec>
  )
}
