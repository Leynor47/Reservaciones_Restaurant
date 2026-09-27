"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, DoorOpen, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { cancelReservation } from "@/app/(private)/reservas/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ReservationItem = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "active" | "cancelled" | "completed";
  cancellation_reason: string | null;
  rooms: { name: string; capacity: number } | null;
};

export function ReservationsList({ reservations }: { reservations: ReservationItem[] }) {
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    const channel = supabase.channel("my-reservations").on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => router.refresh()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [router, supabase]);

  const upcoming = reservations.filter((item) => item.status === "active" && new Date(item.ends_at).getTime() > Date.now());
  const history = reservations.filter((item) => !upcoming.includes(item));
  const visible = tab === "upcoming" ? upcoming : history;

  function cancel(id: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await cancelReservation(id);
      if (result.error) setMessage(result.error); else router.refresh();
    });
  }

  return <><div className="mb-5 flex w-fit rounded-xl bg-muted p-1"><Tab active={tab === "upcoming"} onClick={() => setTab("upcoming")} label="Próximas" count={upcoming.length} /><Tab active={tab === "history"} onClick={() => setTab("history")} label="Historial" count={history.length} /></div>{message && <p className="mb-4 rounded-xl border border-destructive/25 bg-destructive/8 p-3 text-sm text-destructive">{message}</p>}{visible.length === 0 ? <Card className="p-10 text-center"><CalendarDays className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-bold">No hay reservas aquí</h2><p className="mt-1 text-sm text-muted-foreground">Las reservas aparecerán en esta sección.</p></Card> : <div className="space-y-3">{visible.map((item) => <Card key={item.id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><DoorOpen className="size-4" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.rooms?.name ?? "Sala"}</h2><Status status={item.status} /></div><p className="mt-1 text-sm text-muted-foreground">{formatDate(item.starts_at)} · {formatTime(item.starts_at)}–{formatTime(item.ends_at)}</p>{item.cancellation_reason && <p className="mt-1 text-xs text-muted-foreground">{item.cancellation_reason}</p>}</div></div>{item.status === "active" && <Button variant="outline" size="sm" disabled={pending || new Date(item.starts_at).getTime() < Date.now() + 2 * 60 * 60_000} onClick={() => cancel(item.id)}>{pending && <LoaderCircle className="size-3.5 animate-spin" />}Cancelar</Button>}</Card>)}</div>}</>;
}

function Tab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) { return <button onClick={onClick} className={cn("rounded-lg px-4 py-2 text-sm font-bold", active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{label} <span className="ml-1 text-xs">{count}</span></button>; }
function Status({ status }: { status: ReservationItem["status"] }) { if (status === "active") return <Badge tone="success">Activa</Badge>; if (status === "cancelled") return <Badge tone="warning">Cancelada</Badge>; return <Badge>Completada</Badge>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
