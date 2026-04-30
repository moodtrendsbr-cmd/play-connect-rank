import { useEffect, useState } from "react";
import { MessageCircle, QrCode, X, Sparkles } from "lucide-react";

interface Props {
  profile: "arena" | "tenant" | "organizer" | "athlete" | "company" | "admin";
}

export const OperationModeBanner = ({ profile }: Props) => {
  const storageKey = `mp_op_banner_${profile}_dismissed`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVisible(window.localStorage.getItem(storageKey) !== "1");
  }, [storageKey]);

  if (!visible) return null;

  const dismiss = () => {
    try { window.localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    setVisible(false);
  };

  return (
    <div className="relative rounded-xl border border-border bg-gradient-to-r from-emerald-500/5 via-card to-primary/5 p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar aviso"
        className="absolute top-2 right-2 h-6 w-6 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors flex items-center justify-center"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3 flex-wrap md:flex-nowrap">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              Bem-vindo ao seu painel.
            </p>
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">
              Acompanhe sua operação, receita e clientes em um só lugar.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0 pl-6 md:pl-0">
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3 w-3 text-emerald-600" />
            Atendimento via WhatsApp
          </span>
          <span className="inline-flex items-center gap-1">
            <QrCode className="h-3 w-3 text-primary" />
            Check-in por QR
          </span>
        </div>
      </div>
    </div>
  );
};
