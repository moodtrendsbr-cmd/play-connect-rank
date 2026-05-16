import { Dialog, DialogContent } from "@/components/ui/dialog";
import { QRGenerator } from "@/components/arena/QRGenerator";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  value: string;
  title: string;
  subtitle?: string;
  arenaName?: string;
}

export const FullscreenQRDialog = ({ open, onClose, value, title, subtitle, arenaName }: Props) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-w-none w-screen h-screen rounded-none p-0 bg-black text-white border-0 flex flex-col">
      <Button variant="ghost" size="icon" onClick={onClose}
        className="absolute top-4 right-4 text-white hover:bg-white/10 z-10">
        <X className="h-6 w-6" />
      </Button>
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {arenaName && (
          <p className="text-xs uppercase tracking-[0.3em] opacity-60">{arenaName}</p>
        )}
        <h2 className="font-display text-4xl md:text-6xl tracking-wider text-center">{title}</h2>
        {subtitle && <p className="text-sm opacity-70 text-center">{subtitle}</p>}
        <div className="bg-white p-6 rounded-2xl">
          <QRGenerator value={value} size={Math.min(window.innerWidth - 80, 480)} />
        </div>
        <p className="text-sm opacity-60">Escaneie com a câmera do celular</p>
      </div>
    </DialogContent>
  </Dialog>
);
