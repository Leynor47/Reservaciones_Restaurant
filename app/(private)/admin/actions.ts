"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const roomSchema = z.object({ name: z.string().trim().min(1).max(80), capacity: z.coerce.number().refine((value) => [4, 8, 12].includes(value)) });

export async function createRoom(formData: FormData) {
  const parsed = roomSchema.safeParse({ name: formData.get("name"), capacity: formData.get("capacity") });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("rooms").insert(parsed.data);
  revalidatePath("/admin"); revalidatePath("/salas");
}

export async function updateRoom(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = roomSchema.safeParse({ name: formData.get("name"), capacity: formData.get("capacity") });
  if (!id.success || !parsed.success) return;
  const supabase = await createClient();
  await supabase.from("rooms").update({ ...parsed.data, is_active: formData.get("isActive") === "on" }).eq("id", id.data);
  revalidatePath("/admin"); revalidatePath("/salas");
}

export async function cancelAsAdmin(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const reason = z.string().trim().min(3).safeParse(formData.get("reason"));
  if (!id.success || !reason.success) return;
  const supabase = await createClient();
  await supabase.rpc("cancel_reservation_as_admin", { p_reservation_id: id.data, p_reason: reason.data });
  revalidatePath("/admin"); revalidatePath("/reservas"); revalidatePath("/salas");
}
