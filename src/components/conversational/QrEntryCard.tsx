import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, ArrowRight, Loader2, ExternalLink } from "lucide-react";
import { createQrToken, buildWaUrl, isWaConfigured, getWaNumber } from "@/lib/wa";
import { toast } from "sonner";

interface Props {
  title?: string;
  subtitle?: string;
  ctaTo?: string;
  ctaLabel?: string;
  /**
   * Phase 12: when intent is provided, "Gerar QR" creates a single-use
   * wa_qr_token and renders a QR pointing to wa.me with command pre-filled.
   */
  intent?: string;
  payload?: Record<string, unknown>;
  arenaId?: string | null;
  tenantId?: string | null;
  command?: string;
}

const QR_API = (text: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(text)}`;

export const QrEntryCard = ({
  title = "Entrada por QR",
  subtitle = "Check-in físico, acesso e ativação rápida",
  ctaTo,
  ctaLabel = "Abrir QR",
  intent,
  payload,
  arenaId,
  tenantId,
  command = "Ativar QR",
}: Props) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!isWaConfigured()) {
      toast.message("WhatsApp da ORKYM ainda não configurado", {
        description: "Configure VITE_ORKYM_WHATSAPP para gerar QRs reais.",
      });
      return;
    }
    if (!intent) return;
    setBusy(true);
    const tok = await createQrToken({
      intent,
      payload,
      arena_id: arenaId,
      tenant_id: tenantId,
      ttl_minutes: 30,
    });
    setBusy(false);
    if (!tok) {
      toast.error("Não foi possível gerar o QR.");
      return;
    }
    const url = buildWaUrl(command, `#QR-${tok.short_token}`);
    setWaUrl(url);
    setQrUrl(QR_API(url));
    setExpiresAt(tok.expires_at);
    setOpen(true);
  };

  const useIntent = Boolean(intent);

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card h-full">
        <CardContent className="p-5 flex flex-col gap-4 h-full">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <QrCode className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground leading-tight">{title}</h3>
              <p className="text-xs text-muted-foreground leading-snug mt-1">{subtitle}</p>
            </div>
          </div>

          <ul className="text-xs text-muted-foreground space-y-1 pl-1">
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary" /> Atletas confirmam presença
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary" /> Alunos acessam aulas
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary" /> Operação registra entrada
            </li>
          </ul>

          {useIntent ? (
            <Button onClick={handleGenerate} disabled={busy} size="sm" className="mt-auto w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-3.5 w-3.5 mr-2" />}
              Gerar QR
            </Button>
          ) : ctaTo ? (
            <Button asChild size="sm" className="mt-auto w-full">
              <Link to={ctaTo}>
                {ctaLabel}
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" /> QR pronto
            </DialogTitle>
          </DialogHeader>
          {qrUrl && (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-center">
                <img src={qrUrl} alt="QR code" className="w-64 h-64" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Escaneie para abrir o WhatsApp da ORKYM (+{getWaNumber()}) com o comando pré-preenchido.
                {expiresAt && <> Válido até {new Date(expiresAt).toLocaleTimeString("pt-BR")}.</>}
              </p>
              {waUrl && (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <a href={waUrl} target="_blank" rel="noopener noreferrer">
                    Abrir no WhatsApp <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
