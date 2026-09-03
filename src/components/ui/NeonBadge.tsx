import React from "react";
import { clsx } from "clsx";

export type NeonStatusVariant = "green" | "yellow" | "red" | "blue" | "gray" | "purple";

interface NeonBadgeProps {
  variant: NeonStatusVariant;
  children: React.ReactNode;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const NeonBadge: React.FC<NeonBadgeProps> = ({
  variant,
  children,
  pulse = false,
  size = "md",
  className,
}) => {
  const variantStyles = {
    green: {
      bg: "bg-emerald-950/40 text-emerald-300 border-emerald-500/40",
      dot: "bg-emerald-400 shadow-[0_0_8px_#34d399,0_0_12px_#059669]",
    },
    yellow: {
      bg: "bg-amber-950/40 text-amber-300 border-amber-500/40",
      dot: "bg-amber-400 shadow-[0_0_8px_#fbbf24,0_0_12px_#d97706]",
    },
    red: {
      bg: "bg-rose-950/40 text-rose-300 border-rose-500/40",
      dot: "bg-rose-500 shadow-[0_0_8px_#f43f5e,0_0_12px_#be123c]",
    },
    blue: {
      bg: "bg-sky-950/40 text-sky-300 border-sky-500/40",
      dot: "bg-sky-400 shadow-[0_0_8px_#38bdf8,0_0_12px_#0284c7]",
    },
    purple: {
      bg: "bg-purple-950/40 text-purple-300 border-purple-500/40",
      dot: "bg-purple-400 shadow-[0_0_8px_#c084fc,0_0_12px_#7e22ce]",
    },
    gray: {
      bg: "bg-slate-900/60 text-slate-300 border-slate-700/50",
      dot: "bg-slate-400 shadow-[0_0_6px_#94a3b8]",
    },
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs gap-1.5",
    md: "px-2.5 py-1 text-xs font-medium gap-2",
    lg: "px-3 py-1.5 text-sm font-semibold gap-2.5",
  };

  const currentVariant = variantStyles[variant] || variantStyles.gray;

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border backdrop-blur-md transition-all duration-200",
        sizeStyles[size],
        currentVariant.bg,
        className
      )}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        {pulse && (
          <span
            className={clsx(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              currentVariant.dot
            )}
          />
        )}
        <span className={clsx("relative inline-flex h-2 w-2 rounded-full", currentVariant.dot)} />
      </span>
      <span>{children}</span>
    </span>
  );
};
