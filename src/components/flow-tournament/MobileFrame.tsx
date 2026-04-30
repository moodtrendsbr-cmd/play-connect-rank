import { ReactNode } from "react";
import { Signal, Wifi, BatteryFull } from "lucide-react";

export default function MobileFrame({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="relative mx-auto" style={{ width: 390 }}>
      <div className="relative rounded-[44px] border-[10px] border-neutral-900 bg-background shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] overflow-hidden" style={{ width: 390, height: 800 }}>
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-6 w-32 bg-neutral-900 rounded-b-2xl z-30" />
        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-7 text-[11px] text-foreground/80 z-20">
          <span className="font-semibold">9:41</span>
          <div className="flex items-center gap-1">
            <Signal className="w-3 h-3" />
            <Wifi className="w-3 h-3" />
            <BatteryFull className="w-3.5 h-3.5" />
          </div>
        </div>
        {/* Screen content */}
        <div className="absolute inset-0 pt-10 overflow-y-auto scrollbar-none">
          {title && (
            <div className="px-4 pt-2 pb-3 sticky top-10 bg-background/90 backdrop-blur z-10 border-b border-border/40">
              <h2 className="text-[22px] tracking-wider" style={{ fontFamily: "Bebas Neue" }}>{title}</h2>
            </div>
          )}
          <div className="pb-24">{children}</div>
        </div>
        {/* Home indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-28 bg-foreground/40 rounded-full z-30" />
      </div>
    </div>
  );
}
