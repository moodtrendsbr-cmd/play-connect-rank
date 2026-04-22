import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import * as Icons from "lucide-react";
import { WhatsAppCTA } from "./WhatsAppCTA";
import type { CommandExample } from "@/lib/conversationalCommands";

interface Props {
  title?: string;
  subtitle?: string;
  examples: readonly CommandExample[];
}

const renderIcon = (name: string) => {
  const Icon = (Icons as any)[name];
  if (!Icon) return <MessageCircle className="h-4 w-4 text-emerald-600" />;
  return <Icon className="h-4 w-4 text-emerald-600" />;
};

export const CommandExamplesCard = ({
  title = "Operar pelo WhatsApp",
  subtitle = "Toque em um comando para falar com a ORKYM",
  examples,
}: Props) => {
  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold leading-tight">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground leading-tight mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {examples.map((ex, i) => (
          <button
            key={`${ex.command}-${i}`}
            type="button"
            onClick={() => {
              const url = `https://wa.me/${(import.meta.env.VITE_ORKYM_WHATSAPP || "5511999999999").replace(/\D/g, "")}?text=${encodeURIComponent(ex.command)}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }}
            className="w-full text-left flex items-start gap-3 rounded-lg border border-border bg-card/60 p-3 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors"
          >
            <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
              {renderIcon(ex.icon)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground line-clamp-1">"{ex.command}"</p>
              {ex.hint && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{ex.hint}</p>}
            </div>
          </button>
        ))}
        <WhatsAppCTA
          variant="inline"
          command="Olá, quero falar com a ORKYM"
          label="Falar diretamente com a ORKYM"
          className="mt-2"
        />
      </CardContent>
    </Card>
  );
};
