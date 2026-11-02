'use server';
// permission: public — signing out

import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = getSupabaseServerClient();

  await supabase.auth.signOut({ scope: "global" });

  redirect("/sign-in");
}
