import Link from "next/link";
import { AlertCircle, ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { login, register } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export function AuthPanel({ mode, error }: { mode: "login" | "register"; error?: string }) {
  const isRegister = mode === "register";
  return (
    <main className="grid min-h-screen bg-card lg:grid-cols-[.9fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col">
        <BrandMark inverse />
        <div className="relative z-10 my-auto max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#dca087]">Coworking en San José</p>
          <h1 className="mt-5 font-display text-6xl font-semibold leading-[1.03]">Reserva el espacio que necesitas.</h1>
          <p className="mt-6 text-base leading-relaxed text-white/65">Ocho salas, disponibilidad actualizada y reservas seguras en un solo lugar.</p>
        </div>
        <div className="absolute -bottom-56 -right-40 size-[35rem] rounded-full border border-white/10" />
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><BrandMark /></div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{isRegister ? "Crear cuenta" : "Bienvenido"}</p>
          <h2 className="mt-2 font-display text-4xl font-semibold">{isRegister ? "Regístrate" : "Inicia sesión"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{isRegister ? "Ingresa tus datos para comenzar." : "Accede para reservar una sala."}</p>
          {error && <div className="mt-5 flex gap-2 rounded-xl border border-destructive/25 bg-destructive/8 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
          <form action={isRegister ? register : login} className="mt-7 space-y-4">
            {isRegister && <Field name="fullName" label="Nombre completo" type="text" placeholder="Tu nombre completo" icon={UserRound} autoComplete="name" />}
            <Field name="email" label="Correo electrónico" type="email" placeholder="nombre@correo.com" icon={Mail} autoComplete="email" />
            <Field name="password" label="Contraseña" type="password" placeholder="Mínimo 8 caracteres" icon={LockKeyhole} autoComplete={isRegister ? "new-password" : "current-password"} />
            <Button className="w-full" size="lg">{isRegister ? "Crear cuenta" : "Ingresar"}<ArrowRight className="size-4" /></Button>
          </form>
          <p className="mt-7 text-center text-sm text-muted-foreground">{isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"} <Link className="font-bold text-primary" href={isRegister ? "/login" : "/registro"}>{isRegister ? "Inicia sesión" : "Regístrate"}</Link></p>
        </div>
      </section>
    </main>
  );
}

function Field({ name, label, type, placeholder, icon: Icon, autoComplete }: { name: string; label: string; type: string; placeholder: string; icon: typeof Mail; autoComplete: string }) {
  return <label className="block space-y-2 text-sm font-bold"><span>{label}</span><span className="flex h-12 items-center gap-3 rounded-xl border bg-card px-3 focus-within:ring-2 focus-within:ring-ring"><Icon className="size-4 text-muted-foreground" /><input required name={name} type={type} placeholder={placeholder} autoComplete={autoComplete} className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground/60" /></span></label>;
}
