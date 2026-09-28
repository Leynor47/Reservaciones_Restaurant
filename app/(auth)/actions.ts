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

const adminLoginSchema = loginSchema.extend({
  adminPassword: z.string().min(1, "Escribe la clave administrativa."),
});

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) fail("/login", parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.code === "email_not_confirmed") {
    fail("/login", "Debes confirmar tu correo antes de iniciar sesión.");
  }
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

export async function loginAsAdmin(formData: FormData) {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    fail("/admin/acceso", parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const supabase = await createClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (loginError) fail("/admin/acceso", "Correo o contraseña incorrectos.");

  const { data: result, error: adminError } = await supabase.rpc("claim_admin", {
    p_secret: parsed.data.adminPassword,
  });

  if (adminError || result !== "granted") {
    await supabase.auth.signOut();
    const message = result === "locked"
      ? "Demasiados intentos. Espera 15 minutos."
      : "Clave administrativa incorrecta.";
    fail("/admin/acceso", message);
  }

  redirect("/admin");
}
