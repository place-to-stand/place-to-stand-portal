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
import type { PayrollData } from '@/lib/data/reports/types'

type PayrollSectionProps = {
  data: PayrollData
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

export function PayrollSection({ data }: PayrollSectionProps) {
  const hasData = data.rows.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Payroll</CardTitle>
        <CardDescription>
          Hours logged by team members at ${data.hourlyRate}/hour
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className='text-right'>Hours</TableHead>
                <TableHead className='text-right'>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map(row => (
                <TableRow key={row.userId}>
                  <TableCell className='font-medium'>
                    {row.fullName ?? 'Unknown'}
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {row.email}
                  </TableCell>
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
            No time logged by employees this month.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
