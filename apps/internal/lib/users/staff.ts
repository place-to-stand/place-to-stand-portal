import 'server-only'

import { fetchStaffUsers } from '@/lib/data/users'

export type StaffMember = {
  id: string
  name: string
  email: string
}

/** Active admins: the staff an invoice email can cc. */
export async function fetchActiveStaff(): Promise<StaffMember[]> {
  const rows = await fetchStaffUsers({ roles: ['ADMIN'], activeOnly: true })
  return rows.map(row => ({
    id: row.id,
    name: row.full_name?.trim() || row.email,
    email: row.email.toLowerCase(),
  }))
}
