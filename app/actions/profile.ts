'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { profile } from '@/lib/db/schema'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function saveProfile(input: {
  location: string
  language: string
  role: string
  occupation?: string
  experience?: string
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const values = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    location: input.location.trim().slice(0, 120),
    language: input.language.trim().slice(0, 80),
    role: input.role.trim().slice(0, 20),
    occupation: input.occupation?.trim().slice(0, 100) || null,
    experience: input.experience?.trim().slice(0, 40) || null,
    updatedAt: new Date(),
  }

  if (!values.location || !values.language || !values.role) throw new Error('Invalid profile')
  await db.insert(profile).values(values).onConflictDoUpdate({ target: profile.userId, set: values })
  revalidatePath('/')
  return { ok: true }
}

export async function getProfile() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const rows = await db.select().from(profile).where(eq(profile.userId, session.user.id)).limit(1)
  return rows[0] ?? null
}
