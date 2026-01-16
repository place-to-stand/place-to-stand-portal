/**
 * Seed local Supabase with exported production data
 *
 * This script imports the exported JSON data into your local Supabase
 * for testing dual-write functionality.
 *
 * Usage:
 *   npx tsx scripts/migrate/seed-local-supabase.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as fs from 'fs'
import * as path from 'path'
import * as schema from '../../lib/db/schema'

const DATA_DIR = path.join(__dirname, 'data')

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set')
  }

  console.log('🌱 Seeding local Supabase...\n')
  console.log(`📍 Target: ${databaseUrl}\n`)

  const client = postgres(databaseUrl)
  const db = drizzle(client, { schema })

  // Import users
  console.log('📥 Importing users...')
  const usersData = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'users.json'), 'utf-8')
  )

  for (const user of usersData) {
    try {
      await db.insert(schema.users).values({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        deletedAt: user.deletedAt,
      }).onConflictDoNothing()
      console.log(`   ✅ ${user.email}`)
    } catch (error) {
      console.log(`   ⚠️ ${user.email}: ${(error as Error).message}`)
    }
  }

  // Import clients
  console.log('\n📥 Importing clients...')
  const clientsData = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'clients.json'), 'utf-8')
  )

  for (const client of clientsData) {
    try {
      await db.insert(schema.clients).values({
        id: client.id,
        name: client.name,
        slug: client.slug,
        billingType: client.billingType,
        notes: client.notes,
        createdBy: client.createdBy,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        deletedAt: client.deletedAt,
      }).onConflictDoNothing()
      console.log(`   ✅ ${client.name}`)
    } catch (error) {
      console.log(`   ⚠️ ${client.name}: ${(error as Error).message}`)
    }
  }

  // Import client_members
  console.log('\n📥 Importing client_members...')
  const clientMembersPath = path.join(DATA_DIR, 'clientMembers.json')
  if (fs.existsSync(clientMembersPath)) {
    const clientMembersData = JSON.parse(
      fs.readFileSync(clientMembersPath, 'utf-8')
    )

    for (const member of clientMembersData) {
      try {
        await db.insert(schema.clientMembers).values({
          clientId: member.clientId,
          userId: member.userId,
          createdAt: member.createdAt,
          deletedAt: member.deletedAt,
        }).onConflictDoNothing()
        console.log(`   ✅ client=${member.clientId} user=${member.userId}`)
      } catch (error) {
        console.log(`   ⚠️ Skipped: ${(error as Error).message}`)
      }
    }
  } else {
    console.log('   ℹ️ No client_members data found')
  }

  // Import projects (needed for downstream features)
  console.log('\n📥 Importing projects...')
  const projectsData = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'projects.json'), 'utf-8')
  )

  for (const project of projectsData) {
    try {
      await db.insert(schema.projects).values({
        id: project.id,
        name: project.name,
        slug: project.slug,
        type: project.type,
        status: project.status,
        startsOn: project.startsOn,
        endsOn: project.endsOn,
        clientId: project.clientId,
        createdBy: project.createdBy,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        deletedAt: project.deletedAt,
      }).onConflictDoNothing()
      console.log(`   ✅ ${project.name}`)
    } catch (error) {
      console.log(`   ⚠️ ${project.name}: ${(error as Error).message}`)
    }
  }

  // Import contacts
  console.log('\n📥 Importing contacts...')
  const contactsPath = path.join(DATA_DIR, 'contacts.json')
  if (fs.existsSync(contactsPath)) {
    const contactsData = JSON.parse(
      fs.readFileSync(contactsPath, 'utf-8')
    )

    for (const contact of contactsData) {
      try {
        await db.insert(schema.contacts).values({
          id: contact.id,
          email: contact.email,
          name: contact.name,
          phone: contact.phone,
          createdBy: contact.createdBy,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
          deletedAt: contact.deletedAt,
        }).onConflictDoNothing()
        console.log(`   ✅ ${contact.email}`)
      } catch (error) {
        console.log(`   ⚠️ ${contact.email}: ${(error as Error).message}`)
      }
    }
  } else {
    console.log('   ℹ️ No contacts data found')
  }

  // Import contact_clients (junction table)
  console.log('\n📥 Importing contact_clients...')
  const contactClientsPath = path.join(DATA_DIR, 'contactClients.json')
  if (fs.existsSync(contactClientsPath)) {
    const contactClientsData = JSON.parse(
      fs.readFileSync(contactClientsPath, 'utf-8')
    )

    for (const cc of contactClientsData) {
      try {
        await db.insert(schema.contactClients).values({
          id: cc.id,
          contactId: cc.contactId,
          clientId: cc.clientId,
          isPrimary: cc.isPrimary,
          createdAt: cc.createdAt,
        }).onConflictDoNothing()
        console.log(`   ✅ contact=${cc.contactId} client=${cc.clientId}`)
      } catch (error) {
        console.log(`   ⚠️ Skipped: ${(error as Error).message}`)
      }
    }
  } else {
    console.log('   ℹ️ No contact_clients data found')
  }

  // Import hour_blocks
  console.log('\n📥 Importing hour_blocks...')
  const hourBlocksPath = path.join(DATA_DIR, 'hourBlocks.json')
  if (fs.existsSync(hourBlocksPath)) {
    const hourBlocksData = JSON.parse(
      fs.readFileSync(hourBlocksPath, 'utf-8')
    )

    for (const hb of hourBlocksData) {
      try {
        await db.insert(schema.hourBlocks).values({
          id: hb.id,
          hoursPurchased: hb.hoursPurchased,
          createdBy: hb.createdBy,
          createdAt: hb.createdAt,
          updatedAt: hb.updatedAt,
          deletedAt: hb.deletedAt,
          invoiceNumber: hb.invoiceNumber,
          clientId: hb.clientId,
        }).onConflictDoNothing()
        console.log(`   ✅ ${hb.hoursPurchased}hrs for client ${hb.clientId} (Invoice: ${hb.invoiceNumber ?? 'N/A'})`)
      } catch (error) {
        console.log(`   ⚠️ Skipped: ${(error as Error).message}`)
      }
    }
  } else {
    console.log('   ℹ️ No hour_blocks data found')
  }

  await client.end()
  console.log('\n✅ Seeding complete!')
}

main().catch((error) => {
  console.error('❌ Seeding failed:', error)
  process.exit(1)
})
