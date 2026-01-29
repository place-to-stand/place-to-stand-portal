import { CreditCard, Building2, Users, Handshake } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ReportSummaryProps = {
  prepaidTotal: number
  net30Total: number
  payrollTotal: number
  referralsTotal: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function ReportSummary({
  prepaidTotal,
  net30Total,
  payrollTotal,
  referralsTotal,
}: ReportSummaryProps) {
  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Prepaid Billing</CardTitle>
          <CreditCard className='text-muted-foreground h-4 w-4' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>
            {formatCurrency(prepaidTotal)}
          </div>
          <p className='text-muted-foreground text-xs'>
            Hours purchased this month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Net 30 Billing</CardTitle>
          <Building2 className='text-muted-foreground h-4 w-4' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{formatCurrency(net30Total)}</div>
          <p className='text-muted-foreground text-xs'>Client invoices due</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Payroll</CardTitle>
          <Users className='text-muted-foreground h-4 w-4' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>
            {formatCurrency(payrollTotal)}
          </div>
          <p className='text-muted-foreground text-xs'>Employee compensation</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Referrals</CardTitle>
          <Handshake className='text-muted-foreground h-4 w-4' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>
            {formatCurrency(referralsTotal)}
          </div>
          <p className='text-muted-foreground text-xs'>Referral commissions</p>
        </CardContent>
      </Card>
    </div>
  )
}
