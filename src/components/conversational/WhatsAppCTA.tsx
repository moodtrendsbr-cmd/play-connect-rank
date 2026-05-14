import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { buildWaUrl, isWaConfigured, prepareCommand, type PrepareCommandInput } from "@/lib/wa";

type Variant = "primary" | "inline" | "card";

interface Props {
  command: string;
  label?: string;
  variant?: Variant;
  className?: string;
  hint?: string;
  /**
   * Optional rich payload. When provided, the CTA pre-creates a
   * conversational_commands row server-side and appends a #SHORTCODE
   * to the message so wa-bridge can amarrar a execução ao registro.
   */
  payload?: PrepareCommandInput;
}

export const WhatsAppCTA = ({
  command,
  label = "Pedir pelo WhatsApp",
  variant = "primary",
  className,
  hint,
  payload,
}: Props) => {
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isWaConfigured()) {
      toast.message("WhatsApp da plataforma ainda não configurado", {
        description: "Configure VITE_ORKYM_WHATSAPP nas integrações.",
      });
      return;
    }
    let suffix: string | undefined;
    if (payload) {
      const prep = await prepareCommand(payload);
      if (prep?.shortcode) suffix = `#${prep.shortcode}`;
    }
    const url = buildWaUrl(command, suffix);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 transition-colors",
          className,
        )}
      >
        <MessageCircle className="h-3 w-3" />
        {label}
      </button>
    );
  }

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "w-full text-left rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-colors",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-md bg-emerald-500/20 flex items-center justify-center shrink-0">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{label}</p>
            {hint && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{hint}</p>}
          </div>
        </div>
      </button>
    );
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      className={cn("bg-emerald-600 hover:bg-emerald-700 text-white", className)}
    >
      <MessageCircle className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
};
