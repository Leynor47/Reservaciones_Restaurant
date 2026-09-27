"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function cancelReservation(reservationId: string) {
  const parsed = z.string().uuid().safeParse(reservationId);
  if (!parsed.success) return { error: "Reserva inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_reservation", { p_reservation_id: parsed.data });
  if (error) return { error: error.message };
  revalidatePath("/reservas"); revalidatePath("/salas");
  return { success: true };
}
