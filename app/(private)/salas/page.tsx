import { RoomsGrid, type Room } from "@/components/rooms-grid";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Salas" };
export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const supabase = await createClient();
  const [{ data: rooms, error }, { data: remaining }] = await Promise.all([
    supabase.from("rooms").select("id, name, capacity, is_active").eq("is_active", true).order("capacity").order("name"),
    supabase.rpc("get_weekly_remaining"),
  ]);
  return (
    <div>
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Nexo Salas</p>
        <h1 className="mt-1 font-display text-4xl font-semibold">Elige una sala</h1>
        <p className="mt-2 text-sm text-muted-foreground">Reserva entre las 07:00 y las 00:00, en bloques de 30 minutos.</p>
      </div>
      {error ? <div className="rounded-xl border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive">No fue posible cargar las salas.</div> : <RoomsGrid rooms={(rooms ?? []) as Room[]} remaining={typeof remaining === "number" ? remaining : 0} />}
    </div>
  );
}
