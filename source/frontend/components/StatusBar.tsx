import { Battery, Signal, Wifi } from "lucide-react";

export function StatusBar() {
  const currentTime = "9:41";

  return (
    <div className="absolute top-0 z-[100] flex h-11 w-full items-center justify-between px-6 pointer-events-none">
      <div className="text-sm font-semibold text-[var(--text-primary)]">
        {currentTime}
      </div>
      <div className="flex items-center gap-1.5">
        <Signal size={16} className="text-[var(--text-primary)]" strokeWidth={2.5} />
        <Wifi size={16} className="text-[var(--text-primary)]" strokeWidth={2.5} />
        <Battery size={20} className="text-[var(--text-primary)]" strokeWidth={2.5} />
      </div>
    </div>
  );
}
