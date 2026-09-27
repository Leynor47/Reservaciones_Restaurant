"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, Check, Clock3, DoorOpen, LoaderCircle, Users, X } from "lucide-react";
import { confirmBooking, holdSlot, releaseBookingSession, startBookingSession } from "@/app/(private)/salas/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type Room = { id: string; name: string; capacity: number; is_active: boolean };
type Block = { reservation_id: string; room_id: string; starts_at: string; ends_at: string };
type Session = { sessionId: string; expiresAt: string; room: Room };

const durations = [60, 90, 120, 150, 180] as const;
const slots = Array.from({ length: 34 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export function RoomsGrid({ rooms, remaining }: { rooms: Room[]; remaining: number }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingRoom, setLoadingRoom] = useState<string | null>(null);

  async function openBooking(room: Room) {
    setLoadingRoom(room.id); setError(null);
    const result = await startBookingSession(room.id);
    setLoadingRoom(null);
    if ("error" in result) return setError(result.error ?? "No se pudo iniciar la reserva.");
    setSession({ ...result.data, room });
  }

  if (!rooms.length) return <Card className="p-8 text-center"><DoorOpen className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-bold">No hay salas disponibles</h2><p className="mt-1 text-sm text-muted-foreground">Un administrador debe activar al menos una sala.</p></Card>;

  return <>
    <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border bg-card p-4"><div><p className="text-sm font-bold">Reservas disponibles esta semana</p><p className="mt-0.5 text-xs text-muted-foreground">El límite semanal es de tres reservas activas.</p></div><span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold text-white">{remaining}</span></div>
    {error && <div className="mb-4 flex gap-2 rounded-xl border border-destructive/25 bg-destructive/8 p-3 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" />{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => <Card key={room.id} className="p-5"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><DoorOpen className="size-5" /></span><Badge tone="success"><span className="size-1.5 rounded-full bg-current" />Activa</Badge></div><h2 className="mt-5 font-display text-2xl font-semibold">{room.name}</h2><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" />Capacidad para {room.capacity} personas</p><Button className="mt-5 w-full" onClick={() => openBooking(room)} disabled={loadingRoom !== null || remaining === 0}>{loadingRoom === room.id ? <LoaderCircle className="size-4 animate-spin" /> : <Clock3 className="size-4" />}Reservar</Button></Card>)}
    </div>
    {session && <BookingDialog session={session} onClose={() => setSession(null)} />}
  </>;
}

function BookingDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const [date, setDate] = useState(() => costaRicaDate());
  const [duration, setDuration] = useState<(typeof durations)[number]>(60);
  const [time, setTime] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000)));
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [pending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);

  const loadBlocks = useCallback(async () => {
    const from = new Date(`${date}T00:00:00-06:00`);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const { data } = await supabase.rpc("get_room_blocks", { p_from: from.toISOString(), p_to: to.toISOString() });
    setBlocks((data ?? []) as Block[]);
  }, [date, supabase]);

  useEffect(() => { void loadBlocks(); }, [loadBlocks]);
  useEffect(() => {
    const channel = supabase.channel(`availability:${session.room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks", filter: `room_id=eq.${session.room.id}` }, () => { void loadBlocks(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadBlocks, session.room.id, supabase]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
      setSeconds(next);
      if (next === 0) { window.clearInterval(timer); void releaseBookingSession(session.sessionId); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session.expiresAt, session.sessionId]);

  function chooseTime(value: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await holdSlot({ sessionId: session.sessionId, date, time: value, duration });
      if ("error" in result) { setReservationId(null); setTime(null); setMessage(result.error ?? "No se pudo retener el horario."); await loadBlocks(); return; }
      setTime(value); setReservationId(result.data.reservationId); await loadBlocks();
    });
  }

  function confirm() {
    if (!reservationId) return;
    startTransition(async () => {
      const result = await confirmBooking(reservationId);
      if ("error" in result) { setMessage(result.error ?? "No se pudo confirmar la reserva."); return; }
      setComplete(true); await loadBlocks();
    });
  }

  async function close() { await releaseBookingSession(session.sessionId); onClose(); }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#18342d]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="booking-title">
    <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-b-none p-5 shadow-2xl sm:rounded-2xl sm:p-7">
      {complete ? <div className="py-10 text-center"><span className="mx-auto grid size-16 place-items-center rounded-full bg-success/12 text-success"><Check className="size-8" /></span><h2 className="mt-5 font-display text-3xl font-semibold">Reserva confirmada</h2><p className="mt-2 text-sm text-muted-foreground">Tu reserva para {session.room.name} quedó guardada.</p><Button className="mt-6" onClick={onClose}>Cerrar</Button></div> : <>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Nueva reserva</p><h2 id="booking-title" className="mt-1 font-display text-3xl font-semibold">{session.room.name}</h2><p className="mt-1 text-sm text-muted-foreground">Capacidad para {session.room.capacity} personas</p></div><button onClick={() => void close()} className="grid size-9 place-items-center rounded-xl border" aria-label="Cerrar"><X className="size-4" /></button></div>
        <div className="mt-5 flex items-center justify-between rounded-xl bg-accent/10 p-3 text-sm"><span className="font-bold text-accent-foreground">Tiempo para completar</span><span className="font-extrabold tabular-nums text-accent-foreground">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span></div>
        {seconds === 0 && <ErrorMessage text="El tiempo terminó. Cierra y comienza una reserva nueva." />}{message && <ErrorMessage text={message} />}
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-bold">Fecha<input type="date" min={costaRicaDate()} value={date} onChange={(event) => { setDate(event.target.value); setTime(null); setReservationId(null); }} className="h-11 w-full rounded-xl border bg-card px-3" /></label><label className="space-y-2 text-sm font-bold">Duración<select value={duration} onChange={(event) => { setDuration(Number(event.target.value) as (typeof durations)[number]); setTime(null); setReservationId(null); }} className="h-11 w-full rounded-xl border bg-card px-3">{durations.map((value) => <option key={value} value={value}>{formatDuration(value)}</option>)}</select></label></div>
        <div className="mt-5"><div className="flex items-center justify-between"><p className="text-sm font-bold">Hora de inicio</p><Badge tone="success"><span className="size-1.5 rounded-full bg-current" />En tiempo real</Badge></div><div className="mt-3 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">{slots.map((slot) => { const disabled = seconds === 0 || slotUnavailable(slot, date, duration, session.room.id, blocks); return <button key={slot} disabled={disabled || pending} onClick={() => chooseTime(slot)} className={cn("h-10 rounded-lg border text-sm font-bold", disabled && "cursor-not-allowed bg-muted text-muted-foreground/50 line-through", !disabled && time !== slot && "hover:border-primary", time === slot && "border-primary bg-primary text-white")}>{slot}</button>; })}</div></div>
        <Button className="mt-6 w-full" size="lg" disabled={!reservationId || pending || seconds === 0} onClick={confirm}>{pending && <LoaderCircle className="size-4 animate-spin" />}Confirmar reserva</Button>
      </>}
    </Card>
  </div>;
}

function ErrorMessage({ text }: { text: string }) { return <div className="mt-4 flex gap-2 rounded-xl border border-destructive/25 bg-destructive/8 p-3 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" />{text}</div>; }
function costaRicaDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function formatDuration(minutes: number) { return minutes % 60 === 0 ? `${minutes / 60} hora${minutes > 60 ? "s" : ""}` : `${Math.floor(minutes / 60)} h 30 min`; }
function slotUnavailable(slot: string, date: string, duration: number, roomId: string, blocks: Block[]) {
  const start = new Date(`${date}T${slot}:00-06:00`).getTime();
  const end = start + duration * 60_000;
  const midnight = new Date(`${date}T00:00:00-06:00`).getTime() + 24 * 60 * 60_000;
  if (end > midnight) return true;
  return blocks.some((block) => block.room_id === roomId && start < new Date(block.ends_at).getTime() && end > new Date(block.starts_at).getTime());
}
