import { AuthPanel } from "@/components/auth-panel";
export const metadata = { title: "Crear cuenta" };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AuthPanel mode="register" error={params.error} />;
}
