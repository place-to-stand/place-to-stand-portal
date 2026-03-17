import { config } from 'dotenv'
import type { Config } from 'drizzle-kit'

// Load env from the internal app's .env files (shared DATABASE_URL)
config({ path: '../../apps/internal/.env.local', override: false })
config({ path: '../../apps/internal/.env', override: false })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

export default {
  schema: './src/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config
