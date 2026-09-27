"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminRealtimeRefresh() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    const channel = supabase.channel("admin-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [router, supabase]);
  return null;
}
