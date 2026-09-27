"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Escribe un correo válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

const registerSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Escribe tu nombre completo.").max(100),
});

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) fail("/login", parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) fail("/login", "Correo o contraseña incorrectos.");
  redirect("/salas");
}

export async function register(formData: FormData) {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"), email: formData.get("email"), password: formData.get("password"),
  });
  if (!parsed.success) fail("/registro", parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) fail("/registro", "No fue posible crear la cuenta.");
  redirect("/salas");
}
