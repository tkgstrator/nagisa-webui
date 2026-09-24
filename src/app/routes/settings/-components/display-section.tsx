import { getIntlayer } from 'intlayer'
import { useIntlayer } from 'react-intlayer'
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

const displaySectionModuleContent = getIntlayer('settings-display-section')

const THEME_OPTIONS = [
  { value: 'light', label: displaySectionModuleContent.themeOptions.light },
  { value: 'dark', label: displaySectionModuleContent.themeOptions.dark },
  { value: 'system', label: displaySectionModuleContent.themeOptions.system }
] as const satisfies readonly { value: ThemePreference; label: string }[]

const DENSITY_OPTIONS = [
  { value: 'comfortable', label: displaySectionModuleContent.densityOptions.comfortable },
  { value: 'default', label: displaySectionModuleContent.densityOptions.default },
  { value: 'compact', label: displaySectionModuleContent.densityOptions.compact }
] as const satisfies readonly { value: CardDensity; label: string }[]

const PAGE_SIZE_SELECT = PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: displaySectionModuleContent.pageSizeOption({ size })
}))

const SORT_SELECT = (Object.keys(SORT_LABELS) as SortPreference[]).map((value) => ({
  value,
  label: SORT_LABELS[value]
}))

export const DisplaySection = () => {
  const { settings, update } = useSettings()
  const content = useIntlayer('settings-display-section')

  return (
    <PgSec id='s-view' title={content.title.value} count={content.count}>
      <StPanel>
        <StRow index={0} icon={<ThemeIcon />} label={content.theme.label.value} description={content.theme.description}>
          <StSegment
            label={content.theme.label.value}
            value={settings.theme}
            options={THEME_OPTIONS}
            onValueChange={(next) => update('theme', next)}
          />
        </StRow>

        {/* browse / recordings / admin/unidentified の一覧がこの件数で取得する。 */}
        <StRow
          index={1}
          icon={<PageSizeIcon />}
          label={content.pageSize.label.value}
          description={content.pageSize.description}
        >
          <StSelect
            label={content.pageSize.label.value}
            value={String(settings.pageSize)}
            options={PAGE_SIZE_SELECT}
            onValueChange={(next) => update('pageSize', Number(next))}
          />
        </StRow>

        {/* browse の絞り込み初期値と「すべて解除」後の並び順になる。 */}
        <StRow
          index={2}
          icon={<SortIcon />}
          label={content.defaultSort.label.value}
          description={content.defaultSort.description}
        >
          <StSelect
            label={content.defaultSort.label.value}
            value={settings.defaultSort}
            options={SORT_SELECT}
            onValueChange={(next) => update('defaultSort', next)}
          />
        </StRow>

        {/* browse のカードグリッドの列数と余白がこの値で変わる。 */}
        <StRow
          index={3}
          icon={<DensityIcon />}
          label={content.density.label.value}
          description={content.density.description}
        >
          <StSegment
            label={content.density.label.value}
            value={settings.density}
            options={DENSITY_OPTIONS}
            onValueChange={(next) => update('density', next)}
          />
        </StRow>

        <StRow
          index={4}
          icon={<BoltIcon />}
          label={content.animations.label.value}
          description={content.animations.description}
        >
          <StNote>{settings.animations ? content.animations.on : content.animations.off}</StNote>
          <StSwitch
            label={content.animations.label.value}
            checked={settings.animations}
            onCheckedChange={(next) => update('animations', next)}
          />
        </StRow>
      </StPanel>
    </PgSec>
  )
}
