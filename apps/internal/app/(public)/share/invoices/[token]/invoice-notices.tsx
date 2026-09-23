import { Info, XCircle } from 'lucide-react'

import { authErrorClass, authNoticeClass } from '@pts/ui/auth-shell'

import { cn } from '@/lib/utils'

type Props = {
  paymentCancelled: boolean
  isDraft: boolean
  isVoid: boolean
}

const NOTICE = 'flex items-center gap-3 border px-4 py-3 text-sm leading-normal'

/** The auth screens' notice and error styles, laid out as an icon row. */
const INFO_NOTICE = cn(authNoticeClass, NOTICE)
const ERROR_NOTICE = cn(authErrorClass, NOTICE)

/** One-line notices above the document, in the auth screens' notice styles. */
export function InvoiceNotices({ paymentCancelled, isDraft, isVoid }: Props) {
  if (!paymentCancelled && !isDraft && !isVoid) return null

  return (
    <div className='mb-5 flex flex-col gap-3 sm:mb-6'>
      {paymentCancelled ? (
        <div className={INFO_NOTICE}>
          <Info
            className='text-brand-text size-[18px] shrink-0'
            strokeWidth={1.5}
          />
          <p>Payment was cancelled. You can try again below.</p>
        </div>
      ) : null}

      {isDraft ? (
        <div
          className={`${NOTICE} border-brand-lime/30 bg-brand-lime/[0.06] text-brand-text`}
        >
          <span className='border-brand-lime/50 text-brand-lime shrink-0 border px-2 py-0.5 font-mono text-[10px] tracking-[0.2em] uppercase'>
            Draft
          </span>
          <p>
            This invoice has not been finalized. Payment is not available until
            it is issued.
          </p>
        </div>
      ) : null}

      {isVoid ? (
        <div className={ERROR_NOTICE}>
          <XCircle className='size-[18px] shrink-0' strokeWidth={1.5} />
          <p>This invoice has been voided and is no longer payable.</p>
        </div>
      ) : null}
    </div>
  )
}
