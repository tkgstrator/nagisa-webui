import { type Dictionary, t } from 'intlayer'

const sortControlContent = {
  key: 'sort-control',
  content: t({
    ja: {
      ascending: '昇順',
      descending: '降順',
      directionLabel: '並び順の向き'
    },
    en: {
      ascending: 'Ascending',
      descending: 'Descending',
      directionLabel: 'Sort direction'
    }
  })
} satisfies Dictionary

export default sortControlContent
