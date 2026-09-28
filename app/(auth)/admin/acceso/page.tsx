import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, KeyRound, LockKeyhole, Mail } from "lucide-react";
import { loginAsAdmin } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen bg-card lg:grid-cols-[.9fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col">
        <BrandMark inverse />
        <div className="relative z-10 my-auto max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#dca087]">Acceso restringido</p>
          <h1 className="mt-5 font-display text-6xl font-semibold leading-[1.03]">Administración de salas.</h1>
          <p className="mt-6 text-base leading-relaxed text-white/65">Gestiona salas, reservas y disponibilidad desde un solo lugar.</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><BrandMark /></div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Administración</p>
          <h2 className="mt-2 font-display text-4xl font-semibold">Ingresar como admin</h2>
          <p className="mt-2 text-sm text-muted-foreground">Usa tu cuenta y la clave administrativa de Nexo Salas.</p>
          {error && <div className="mt-5 flex gap-2 rounded-xl border border-destructive/25 bg-destructive/8 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
          <form action={loginAsAdmin} className="mt-7 space-y-4">
            <AdminField name="email" label="Correo electrónico" type="email" autoComplete="email" icon={Mail} />
            <AdminField name="password" label="Contraseña de tu cuenta" type="password" autoComplete="current-password" icon={LockKeyhole} />
            <AdminField name="adminPassword" label="Clave administrativa" type="password" autoComplete="off" icon={KeyRound} />
            <Button className="w-full" size="lg">Ingresar como admin<ArrowRight className="size-4" /></Button>
          </form>
          <Link className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-primary" href="/login"><ArrowLeft className="size-4" />Volver al inicio de sesión</Link>
        </div>
      </section>
    </main>
  );
}

function AdminField({ name, label, type, autoComplete, icon: Icon }: {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  icon: typeof Mail;
}) {
  return <label className="block space-y-2 text-sm font-bold"><span>{label}</span><span className="flex h-12 items-center gap-3 rounded-xl border bg-card px-3 focus-within:ring-2 focus-within:ring-ring"><Icon className="size-4 text-muted-foreground" /><input required name={name} type={type} autoComplete={autoComplete} className="min-w-0 flex-1 bg-transparent font-medium outline-none" /></span></label>;
}
