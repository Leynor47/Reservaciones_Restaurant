"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string };

const uuid = z.string().uuid();
const holdSchema = z.object({
  sessionId: uuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.union([z.literal(60), z.literal(90), z.literal(120), z.literal(150), z.literal(180)]),
});

export async function startBookingSession(roomId: string): Promise<ActionResult<{ sessionId: string; expiresAt: string }>> {
  const parsed = uuid.safeParse(roomId);
  if (!parsed.success) return { error: "Sala inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_booking_session", { p_room_id: parsed.data });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { error: error?.message ?? "No se pudo iniciar la reserva." };
  return { data: { sessionId: row.session_id as string, expiresAt: row.expires_at as string } };
}

export async function holdSlot(input: z.infer<typeof holdSchema>): Promise<ActionResult<{ reservationId: string; expiresAt: string }>> {
  const parsed = holdSchema.safeParse(input);
  if (!parsed.success) return { error: "La fecha, hora o duración no es válida." };
  const startsAt = new Date(`${parsed.data.date}T${parsed.data.time}:00-06:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: "Fecha inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hold_reservation", {
    p_session_id: parsed.data.sessionId,
    p_starts_at: startsAt.toISOString(),
    p_duration_minutes: parsed.data.duration,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { error: error?.message ?? "No se pudo retener el horario." };
  return { data: { reservationId: row.reservation_id as string, expiresAt: row.expires_at as string } };
}

export async function confirmBooking(reservationId: string): Promise<ActionResult<{ reservationId: string }>> {
  const parsed = uuid.safeParse(reservationId);
  if (!parsed.success) return { error: "Reserva inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_reservation", { p_reservation_id: parsed.data });
  if (error || !data) return { error: error?.message ?? "No se pudo confirmar la reserva." };
  return { data: { reservationId: data as string } };
}

export async function releaseBookingSession(sessionId: string): Promise<void> {
  const parsed = uuid.safeParse(sessionId);
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.rpc("release_booking_session", { p_session_id: parsed.data });
}
