import { createFileRoute } from '@tanstack/react-router'
import { getIntlayer } from 'intlayer'

const content = getIntlayer('errors-status-code')

export const Route = createFileRoute('/_errors/$statusCode/')({
  loader: ({ params }) => {
    const code = Number(params.statusCode)
    const error = new Error(content.testError({ code }))
    Object.assign(error, { status: code })
    throw error
  }
})
