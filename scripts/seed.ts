import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const password = required("SEED_USER_PASSWORD");
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const accounts = [
  { email: "miembro1@nexosalas.test", name: "Miembro Uno", role: "miembro" },
  { email: "miembro2@nexosalas.test", name: "Miembro Dos", role: "miembro" },
  { email: "admin@nexosalas.test", name: "Administración Nexo", role: "admin" },
] as const;

async function findOrCreateUser(client: SupabaseClient, email: string, fullName: string): Promise<User> {
  const { data: listed, error: listError } = await client.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = listed.users.find((user) => user.email === email);
  if (existing) return existing;
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) throw error;
  return data.user;
}

async function main() {
  const users = [] as User[];
  for (const account of accounts) {
    const user = await findOrCreateUser(supabase, account.email, account.name);
    users.push(user);
    const { error } = await supabase.from("profiles").update({ role: account.role, full_name: account.name }).eq("id", user.id);
    if (error) throw error;
  }

  const memberIds = users.slice(0, 2).map((user) => user.id);
  const { error: clearError } = await supabase.from("reservations").delete().in("user_id", memberIds);
  if (clearError) throw clearError;

  const rooms = Array.from({ length: 8 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
  const futureBase = costaRicaDayOffset(2);
  const pastBase = costaRicaDayOffset(-5);
  const reservations = Array.from({ length: 10 }, (_, index) => {
    const active = index < 6;
    const date = active ? shiftDate(futureBase, Math.floor(index / 2)) : shiftDate(pastBase, index - 6);
    const hour = 8 + (index % 3) * 2;
    const startsAt = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00-06:00`);
    return {
      room_id: rooms[index % rooms.length],
      user_id: memberIds[index % memberIds.length],
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 60 * 60_000).toISOString(),
      status: active ? "active" : "completed",
    };
  });
  const { error } = await supabase.from("reservations").insert(reservations);
  if (error) throw error;
  console.log("Seed completado: 8 salas, 2 miembros, 1 admin y 10 reservas.");
}

function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`Falta ${name}.`); return value; }
function costaRicaDayOffset(offset: number) { const now = new Date(Date.now() + offset * 86_400_000); return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
function shiftDate(date: string, days: number) { const value = new Date(`${date}T12:00:00-06:00`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
