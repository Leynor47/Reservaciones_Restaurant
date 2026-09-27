import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", inverse ? "text-white" : "text-primary")}>
      <span className={cn("grid size-10 place-items-center rounded-2xl", inverse ? "bg-white/12" : "bg-primary text-white")}>
        <Leaf className="size-5" strokeWidth={1.8} />
      </span>
      {!compact && (
        <div>
          <div className="font-display text-2xl font-semibold leading-none tracking-tight">Nexo Salas</div>
          <div className={cn("mt-1 text-[9px] font-bold uppercase tracking-[0.24em]", inverse ? "text-white/60" : "text-muted-foreground")}>
            Espacios que conectan
          </div>
        </div>
      )}
    </div>
  );
}
