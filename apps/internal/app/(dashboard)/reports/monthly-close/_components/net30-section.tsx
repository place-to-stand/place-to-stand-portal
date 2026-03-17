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
import type { Net30Data } from '@/lib/data/reports/types'

type Net30SectionProps = {
  data: Net30Data
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

export function Net30Section({ data }: Net30SectionProps) {
  const hasData = data.rows.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net 30 Client Billing</CardTitle>
        <CardDescription>
          Hours logged for net 30 clients at ${data.hourlyRate}/hour
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className='text-right'>Hours Logged</TableHead>
                <TableHead className='text-right'>Amount Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map(row => (
                <TableRow key={row.clientId}>
                  <TableCell className='font-medium'>{row.clientName}</TableCell>
                  <TableCell className='text-right'>
                    {formatHours(row.totalHours)}
                  </TableCell>
                  <TableCell className='text-right'>
                    {formatCurrency(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className='font-semibold'>Total</TableCell>
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
            No hours logged for net 30 clients this month.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
