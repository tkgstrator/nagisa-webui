import type { ReactNode } from 'react'

/** 行アイコン。モックの .st-ico svg と同じ 15px・stroke 2。 */
const RowIcon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className='size-[15px]'
    aria-hidden='true'
  >
    {children}
  </svg>
)

export const ThemeIcon = () => (
  <RowIcon>
    <circle cx='12' cy='12' r='4.5' />
    <path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' />
  </RowIcon>
)

export const PageSizeIcon = () => (
  <RowIcon>
    <rect x='3' y='4' width='18' height='16' rx='2' />
    <path d='M3 10h18M9 10v10' />
  </RowIcon>
)

export const SortIcon = () => (
  <RowIcon>
    <path d='M3 6h13M3 12h9M3 18h5M17 10v10M17 20l-3-3M17 20l3-3' />
  </RowIcon>
)

export const DensityIcon = () => (
  <RowIcon>
    <rect x='3' y='3' width='7' height='7' rx='1' />
    <rect x='14' y='3' width='7' height='7' rx='1' />
    <rect x='3' y='14' width='7' height='7' rx='1' />
    <rect x='14' y='14' width='7' height='7' rx='1' />
  </RowIcon>
)

export const BoltIcon = () => (
  <RowIcon>
    <path d='M13 2 4.5 13H11l-1 9 8.5-11H12z' />
  </RowIcon>
)

export const SeasonIcon = () => (
  <RowIcon>
    <rect x='3' y='5' width='18' height='16' rx='2' />
    <path d='M16 3v4M8 3v4M3 11h18' />
  </RowIcon>
)

export const RecordIcon = () => (
  <RowIcon>
    <circle cx='12' cy='12' r='9' />
    <circle cx='12' cy='12' r='3.2' fill='currentColor' stroke='none' />
  </RowIcon>
)

export const WarnIcon = () => (
  <RowIcon>
    <path d='M12 9v4M12 17h.01' />
    <path d='M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z' />
  </RowIcon>
)

export const ClockIcon = () => (
  <RowIcon>
    <circle cx='12' cy='12' r='9' />
    <path d='M12 7v5l3 2' />
  </RowIcon>
)

export const AutoIcon = () => (
  <RowIcon>
    <path d='M21 12a9 9 0 1 1-3.5-7.1' />
    <path d='M21 4v5h-5' />
  </RowIcon>
)

export const LanguageIcon = () => (
  <RowIcon>
    <path d='M4 5h9M9 3v2M11 5c0 4.5-2.7 8.5-7 10M7 9c1.2 2.6 3.4 4.7 6 5.8M13 21l4.5-10 4.5 10M15.2 17.5h4.6' />
  </RowIcon>
)

export const ImageIcon = () => (
  <RowIcon>
    <rect x='3' y='4' width='18' height='14' rx='2' />
    <path d='m6 15 4-4 3 3 2-2 3 3' />
    <circle cx='9' cy='9' r='1.4' />
  </RowIcon>
)

export const TransferIcon = () => (
  <RowIcon>
    <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
    <path d='M7 10l5 5 5-5M12 15V3' />
  </RowIcon>
)

export const ResetIcon = () => (
  <RowIcon>
    <path d='M3 12a9 9 0 1 0 3-6.7' />
    <path d='M3 4v5h5' />
  </RowIcon>
)

export const SyncIcon = () => (
  <RowIcon>
    <path d='M3 12a9 9 0 0 1 15-6.7L21 8' />
    <path d='M21 3v5h-5' />
    <path d='M21 12a9 9 0 0 1-15 6.7L3 16' />
    <path d='M3 21v-5h5' />
  </RowIcon>
)

/** 管理カードのアイコン。モックの .pg-link svg と同じ 20px。 */
const LinkIcon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className='size-5 shrink-0'
    aria-hidden='true'
  >
    {children}
  </svg>
)

export const UnidentifiedIcon = () => (
  <LinkIcon>
    <circle cx='11' cy='11' r='7' />
    <path d='m20 20-3.5-3.5M11 8v3M11 14h.01' />
  </LinkIcon>
)

export const JobIcon = () => (
  <LinkIcon>
    <path d='M12 3v12M12 15l-4-4M12 15l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2' />
  </LinkIcon>
)

export const ChangelogIcon = () => (
  <LinkIcon>
    <path d='M12 8v4l3 2' />
    <path d='M3.1 13a9 9 0 1 0 2-6.4' />
    <path d='M3 4v5h5' />
  </LinkIcon>
)

export const ChevronRightIcon = () => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className='size-3'
    aria-hidden='true'
  >
    <path d='m9 18 6-6-6-6' />
  </svg>
)

export const CheckIcon = () => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2.6'
    strokeLinecap='round'
    strokeLinejoin='round'
    className='size-[13px]'
    aria-hidden='true'
  >
    <path d='m5 13 4 4L19 7' />
  </svg>
)
