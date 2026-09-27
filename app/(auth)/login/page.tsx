import { AuthPanel } from "@/components/auth-panel";
export const metadata = { title: "Iniciar sesión" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AuthPanel mode="login" error={params.error} />;
}
