// Types for Monthly Close Report

export type MonthCursor = {
  year: number
  month: number // 1-indexed (1 = January, 12 = December)
}

export type PayrollRow = {
  userId: string
  fullName: string | null
  email: string
  totalHours: number
  amount: number
}

export type PayrollData = {
  rows: PayrollRow[]
  totalHours: number
  totalAmount: number
  hourlyRate: number
}

// Client detail within a referrer group
export type ReferralClientDetail = {
  clientId: string
  clientName: string
  hoursPurchased: number
  commission: number
}

// Referrals grouped by referrer
export type ReferralGroupRow = {
  referrerId: string
  referrerName: string
  clients: ReferralClientDetail[]
  totalHoursPurchased: number
  totalCommission: number
}

export type ReferralsData = {
  rows: ReferralGroupRow[]
  totalHours: number
  totalAmount: number
  commissionPerHour: number
}

export type PrepaidBillingRow = {
  clientId: string
  clientName: string
  totalHours: number
  amount: number
}

export type PrepaidBillingData = {
  rows: PrepaidBillingRow[]
  totalHours: number
  totalAmount: number
  hourlyRate: number
}

export type Net30Row = {
  clientId: string
  clientName: string
  totalHours: number
  amount: number
}

export type Net30Data = {
  rows: Net30Row[]
  totalHours: number
  totalAmount: number
  hourlyRate: number
}

export type MonthlyCloseReport = {
  payroll: PayrollData
  referrals: ReferralsData
  prepaidBilling: PrepaidBillingData
  net30Billing: Net30Data
  minCursor: MonthCursor
  maxCursor: MonthCursor
}
