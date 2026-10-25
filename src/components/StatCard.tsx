import { TrendingUp, Activity } from "lucide-react";
import React from "react";

interface StatCardProps {
  title: string;
  icon: React.ReactNode;
  data: { current: number | null; peak: number | null };
  theme: "emerald" | "orange" | "indigo";
}

export default function StatCard({ title, icon, data, theme }: StatCardProps) {
  // Overriding themes to be minimal monochromatic glass
  return (
    <div className="rounded-[24px] border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 flex flex-col justify-between transition-all hover:bg-white/[0.04]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/10 bg-white/5 text-white/90 shadow-sm">
          {icon}
        </div>
        <h3 className="font-sans text-[13px] tracking-wide font-medium text-white">{title}</h3>
      </div>

      <div className="mt-6 flex flex-col">
        <div className="flex items-end gap-2">
          <span className="text-4xl font-display font-medium tracking-tight text-white leading-none">
            {data.current !== null ? data.current : "N/A"}
          </span>
          {data.current !== null && (
             <span className="font-mono text-[9px] uppercase font-medium tracking-widest text-neutral-500 mb-1">RTG</span>
          )}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="font-mono uppercase tracking-widest text-[9px]">Peak Record</span>
          </div>
          <span className="font-sans text-[13px] font-medium tracking-wide text-neutral-300">
            {data.peak !== null ? data.peak : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}
