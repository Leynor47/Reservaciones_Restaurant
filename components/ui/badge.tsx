import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "success" | "warning" | "neutral" | "coral";
};

const tones = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  neutral: "bg-muted text-muted-foreground",
  coral: "bg-accent/12 text-accent-foreground",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}
