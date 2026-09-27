"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, DoorOpen, LogOut, Settings2 } from "lucide-react";
import { logout } from "@/app/(private)/actions";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const memberItems = [
  { href: "/salas", label: "Salas", icon: DoorOpen },
  { href: "/reservas", label: "Mis reservas", icon: CalendarDays },
];

export function AppShell({ children, fullName, isAdmin }: { children: React.ReactNode; fullName: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...memberItems, { href: "/admin", label: "Administración", icon: Settings2 }] : memberItems;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 md:px-6">
          <BrandMark />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            {items.map((item) => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-bold">{fullName}</p><p className="text-[11px] capitalize text-muted-foreground">{isAdmin ? "Administrador" : "Miembro"}</p></div>
            <form action={logout}><button className="grid size-10 place-items-center rounded-xl border bg-card hover:bg-muted" aria-label="Cerrar sesión"><LogOut className="size-4" /></button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-7 md:px-6 md:pb-12">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card/96 px-3 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} aria-label="Navegación móvil">
        {items.map((item) => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} mobile />)}
      </nav>
    </div>
  );
}

function NavLink({ item, active, mobile = false }: { item: (typeof memberItems)[number]; active: boolean; mobile?: boolean }) {
  const Icon = item.icon;
  return <Link href={item.href} className={cn(mobile ? "flex flex-col items-center gap-1 py-1 text-[10px] font-bold" : "flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold", active ? "text-primary" : "text-muted-foreground", !mobile && active && "bg-primary/10", !mobile && !active && "hover:bg-muted")}><Icon className="size-4" />{item.label}</Link>;
}
