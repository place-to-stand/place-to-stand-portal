import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import type { ReferralsData } from '@/lib/data/reports/types'

type ReferralsSectionProps = {
  data: ReferralsData
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatHours(hours: number): string {
  return hours.toFixed(2)
}

export function ReferralsSection({ data }: ReferralsSectionProps) {
  const hasData = data.rows.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referral Commissions</CardTitle>
        <CardDescription>
          Commissions owed to referrers for prepaid hour block purchases at $
          {data.commissionPerHour}/hour
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Clients</TableHead>
                <TableHead className='text-right'>Hours Purchased</TableHead>
                <TableHead className='text-right'>Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map(row => (
                <TableRow key={row.referrerId}>
                  <TableCell className='font-medium'>
                    {row.referrerName}
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {row.clients.map(c => c.clientName).join(', ')}
                  </TableCell>
                  <TableCell className='text-right'>
                    {formatHours(row.totalHoursPurchased)}
                  </TableCell>
                  <TableCell className='text-right'>
                    {formatCurrency(row.totalCommission)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className='font-semibold'>
                  Total
                </TableCell>
                <TableCell className='text-right font-semibold'>
                  {formatHours(data.totalHours)}
                </TableCell>
                <TableCell className='text-right font-semibold'>
                  {formatCurrency(data.totalAmount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            No hour blocks purchased by referred clients this month.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
