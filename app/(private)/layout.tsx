import { AppShell } from "@/components/app-shell";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
  return <AppShell fullName={profile?.full_name ?? "Miembro"} isAdmin={profile?.role === "admin"}>{children}</AppShell>;
}
