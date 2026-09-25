import { createFileRoute } from '@tanstack/react-router'
import { getIntlayer } from 'intlayer'
import { appLocale } from '@/app/lib/locale'

const content = getIntlayer('errors-status-code', appLocale)

export const Route = createFileRoute('/_errors/$statusCode/')({
  loader: ({ params }) => {
    const code = Number(params.statusCode)
    const error = new Error(content.testError({ code }))
    Object.assign(error, { status: code })
    throw error
  }
})
