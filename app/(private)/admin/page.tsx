import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { AdminRealtimeRefresh } from "@/components/admin-realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cancelAsAdmin, createRoom, updateRoom } from "./actions";

export const metadata = { title: "Administración" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/salas");
  await supabase.rpc("get_weekly_remaining");
  const [{ data: rooms }, { data: reservations }] = await Promise.all([
    supabase.from("rooms").select("id, name, capacity, is_active").order("name"),
    supabase.from("reservations").select("id, starts_at, ends_at, status, profiles!reservations_user_id_fkey(full_name), rooms(name)").in("status", ["active", "cancelled", "completed"]).order("starts_at", { ascending: false }).limit(30),
  ]);
  return <div className="space-y-8"><AdminRealtimeRefresh /><div><p className="text-xs font-bold uppercase tracking-[.2em] text-accent">Administración</p><h1 className="mt-1 font-display text-4xl font-semibold">Salas y reservas</h1></div>
    <section><h2 className="font-display text-2xl font-semibold">Salas</h2><Card className="mt-4 p-4"><form action={createRoom} className="grid gap-3 sm:grid-cols-[1fr_150px_auto]"><input required name="name" placeholder="Nombre de la sala" className="h-10 rounded-xl border bg-card px-3 text-sm" /><select name="capacity" className="h-10 rounded-xl border bg-card px-3 text-sm"><option value="4">4 personas</option><option value="8">8 personas</option><option value="12">12 personas</option></select><Button size="sm"><Plus className="size-4" />Agregar</Button></form></Card><div className="mt-3 space-y-2">{(rooms ?? []).map((room) => <Card key={room.id} className="p-4"><form action={updateRoom} className="grid items-center gap-3 sm:grid-cols-[1fr_140px_110px_auto]"><input type="hidden" name="id" value={room.id} /><input name="name" defaultValue={room.name} className="h-9 rounded-lg border bg-card px-3 text-sm font-bold" /><select name="capacity" defaultValue={room.capacity} className="h-9 rounded-lg border bg-card px-2 text-sm"><option value="4">4 personas</option><option value="8">8 personas</option><option value="12">12 personas</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={room.is_active} />Activa</label><Button size="sm" variant="outline">Guardar</Button></form></Card>)}</div></section>
    <section><h2 className="font-display text-2xl font-semibold">Reservas</h2><div className="mt-4 space-y-2">{(reservations ?? []).map((reservation) => { const member = Array.isArray(reservation.profiles) ? reservation.profiles[0] : reservation.profiles; const room = Array.isArray(reservation.rooms) ? reservation.rooms[0] : reservation.rooms; return <Card key={reservation.id} className="p-4"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><div className="flex items-center gap-2"><p className="font-bold">{room?.name ?? "Sala"}</p><Badge tone={reservation.status === "active" ? "success" : "neutral"}>{reservation.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{member?.full_name ?? "Miembro"} · {formatDateTime(reservation.starts_at)}–{formatTime(reservation.ends_at)}</p></div>{reservation.status === "active" && <form action={cancelAsAdmin} className="flex gap-2"><input type="hidden" name="id" value={reservation.id} /><input required minLength={3} name="reason" placeholder="Motivo" className="h-9 min-w-0 rounded-lg border bg-card px-3 text-sm" /><Button size="sm" variant="outline" className="text-destructive">Cancelar</Button></form>}</div></Card>; })}</div></section>
  </div>;
}

function formatDateTime(value: string) { return new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
