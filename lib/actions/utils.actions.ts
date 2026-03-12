// ─────────────────────────────────────────
// HELPER — get authenticated user

import { redirect } from "next/navigation"
import { createClient } from "../supabase/server"

// ─────────────────────────────────────────
export async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }
  return user
}