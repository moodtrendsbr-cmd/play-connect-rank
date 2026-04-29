import { useNavigate } from "react-router-dom";
import { useWhatsAppConnectionStatus, type WaConnectionScope } from "@/hooks/useWhatsAppConnection";
import { MessageCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  scope: WaConnectionScope;
  connectPath: string;
}

export function WhatsAppStatusBadge({ scope, connectPath }: Props) {
  const { loading, connected, status } = useWhatsAppConnectionStatus(scope);
  const navigate = useNavigate();

  if (loading) return null;

  if (connected) {
    return (
      <button
        type="button"
        onClick={() => navigate(connectPath)}
        className="flex items-center gap-1.5 rounded-full border border-[#2BFF88]/40 bg-[#2BFF88]/10 px-2 py-0.5 text-xs text-[#2BFF88] hover:bg-[#2BFF88]/20 transition-colors"
        title="WhatsApp conectado"
      >
        <CheckCircle2 className="h-3 w-3" />
        <span className="hidden sm:inline">WhatsApp conectado</span>
      </button>
    );
  }

  const isDisconnected = status === "paused" || status === "revoked";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => navigate(connectPath)}
      className={
        isDisconnected
          ? "h-7 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          : "h-7 gap-1.5 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10"
      }
    >
      {isDisconnected ? <AlertCircle className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
      <span>{isDisconnected ? "Reconectar WhatsApp" : "Conectar WhatsApp"}</span>
    </Button>
  );
}
