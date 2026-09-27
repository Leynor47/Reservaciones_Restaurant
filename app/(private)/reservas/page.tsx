import { ReservationsList, type ReservationItem } from "@/components/reservations-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mis reservas" };
export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const supabase = await createClient();
  await supabase.rpc("get_weekly_remaining");
  const { data, error } = await supabase.from("reservations")
    .select("id, starts_at, ends_at, status, cancellation_reason, rooms(name, capacity)")
    .in("status", ["active", "cancelled", "completed"])
    .order("starts_at", { ascending: false });
  return <div><div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-accent">Tu agenda</p><h1 className="mt-1 font-display text-4xl font-semibold">Mis reservas</h1><p className="mt-2 text-sm text-muted-foreground">Consulta tus próximas reservas y tu historial.</p></div>{error ? <p className="rounded-xl border p-4 text-sm text-destructive">No fue posible cargar las reservas.</p> : <ReservationsList reservations={(data ?? []) as unknown as ReservationItem[]} />}</div>;
}
