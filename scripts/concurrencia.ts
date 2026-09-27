import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const password = required("SEED_USER_PASSWORD");
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function createRaceUser(index: number): Promise<User> {
  const email = `concurrencia${index}@nexosalas.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Prueba ${index}` } });
  if (error) throw error;
  return data.user;
}

async function authenticatedClient(email: string): Promise<SupabaseClient> {
  const client = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function main() {
  const users: User[] = [];
  try {
    for (let index = 1; index <= 10; index += 1) users.push(await createRaceUser(index));
    const clients = await Promise.all(users.map((user) => authenticatedClient(user.email!)));
    const roomId = "00000000-0000-4000-8000-000000000001";
    const date = costaRicaDayOffset(3);
    const startsAt = new Date(`${date}T15:00:00-06:00`).toISOString();
    const sessions = await Promise.all(clients.map((client) => client.rpc("start_booking_session", { p_room_id: roomId })));
    const attempts = await Promise.all(clients.map((client, index) => {
      const row = Array.isArray(sessions[index].data) ? sessions[index].data[0] : sessions[index].data;
      return client.rpc("hold_reservation", { p_session_id: row.session_id, p_starts_at: startsAt, p_duration_minutes: 60 });
    }));
    const successes = attempts.filter((attempt) => !attempt.error).length;
    console.log(`Solicitudes: 10 | Éxitos: ${successes} | Esperado: 1`);
    if (successes !== 1) throw new Error(`Falló la garantía de concurrencia: se obtuvieron ${successes} éxitos.`);
  } finally {
    await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)));
  }
}

function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`Falta ${name}.`); return value; }
function costaRicaDayOffset(offset: number) { const now = new Date(Date.now() + offset * 86_400_000); return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
