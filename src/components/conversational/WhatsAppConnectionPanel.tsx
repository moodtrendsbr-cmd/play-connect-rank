import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, RefreshCw, CheckCircle2, AlertTriangle, Copy, Power, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  callOrkymWaConnection,
  useWhatsAppConnectionStatus,
  type WaConnectionScope,
} from "@/hooks/useWhatsAppConnection";

interface Props extends WaConnectionScope {
  title?: string;
  description?: string;
  valueBlocks?: { title: string; items: string[] }[];
  redirectOnSuccess?: string;
  onConnected?: () => void;
}

export function WhatsAppConnectionPanel(props: Props) {
  const navigate = useNavigate();
  const scope: WaConnectionScope = {
    scope_type: props.scope_type,
    tenant_id: props.tenant_id ?? null,
    arena_id: props.arena_id ?? null,
    organizer_user_id: props.organizer_user_id ?? null,
    company_id: props.company_id ?? null,
  };

  const { loading, status, instance, refresh, connected } = useWhatsAppConnectionStatus(scope);

  const [busy, setBusy] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [degraded, setDegraded] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const pollStartRef = useRef<number>(0);

  // Stop polling when connected
  useEffect(() => {
    if (connected && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setQrCode(null);
      setPairingCode(null);
      props.onConnected?.();
    }
  }, [connected, props]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollStartRef.current = Date.now();
    pollRef.current = window.setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > 90_000) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        return;
      }
      const res = await callOrkymWaConnection("get_status", scope);
      if (res.ok) {
        if (res.qr_code) setQrCode(res.qr_code);
        if (res.pairing_code) setPairingCode(res.pairing_code);
      }
      await refresh();
    }, 3000);
  };

  const handleStart = async () => {
    setBusy(true);
    setDegraded(null);
    const res = await callOrkymWaConnection("start_connection", scope);
    setBusy(false);
    if (!res.ok) {
      setDegraded(res.message || res.error || "Não foi possível iniciar a conexão.");
      return;
    }
    setQrCode(res.qr_code ?? null);
    setPairingCode(res.pairing_code ?? null);
    await refresh();
    startPolling();
  };

  const handleReconnect = async () => {
    setBusy(true);
    setDegraded(null);
    const res = await callOrkymWaConnection("reconnect", scope);
    setBusy(false);
    if (!res.ok) {
      setDegraded(res.message || res.error || "Falha ao reconectar.");
      return;
    }
    setQrCode(res.qr_code ?? null);
    setPairingCode(res.pairing_code ?? null);
    await refresh();
    startPolling();
  };

  const handleSync = async () => {
    setBusy(true);
    const res = await callOrkymWaConnection("get_status", scope);
    setBusy(false);
    if (!res.ok) toast.error(res.message || "Falha ao atualizar status.");
    else toast.success("Status atualizado.");
    await refresh();
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar o WhatsApp deste escopo? A operação parará de funcionar até reconectar.")) return;
    setBusy(true);
    const res = await callOrkymWaConnection("disconnect", scope);
    setBusy(false);
    if (!res.ok) toast.error(res.message || "Falha ao desconectar.");
    else toast.success("WhatsApp desconectado.");
    await refresh();
    setQrCode(null);
    setPairingCode(null);
  };

  if (loading) {
    return (
      <Card className="border-border/40 bg-card/40">
        <CardContent className="p-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Connected state
  if (connected && instance) {
    return (
      <Card className="border-[#2BFF88]/40 bg-[#2BFF88]/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[#2BFF88]/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-[#2BFF88]" />
            </div>
            <div>
              <CardTitle className="text-2xl">Conectado</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Sua operação já pode acontecer pelo WhatsApp.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-border/40 bg-background/40 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Número</span>
              <span className="font-mono font-medium">+{instance.phone_number}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Instância</span>
              <span className="font-medium">{instance.display_name || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Provedor</span>
              <Badge variant="outline" className="capitalize">{instance.provider}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {props.redirectOnSuccess && (
              <Button onClick={() => navigate(props.redirectOnSuccess!)} className="bg-[#2BFF88] text-black hover:bg-[#2BFF88]/90">
                Ir para o dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" onClick={handleSync} disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar status
            </Button>
            <Button variant="outline" onClick={handleReconnect} disabled={busy}>
              Reconectar
            </Button>
            <Button variant="ghost" onClick={handleDisconnect} disabled={busy} className="text-destructive">
              <Power className="mr-2 h-4 w-4" /> Desconectar
            </Button>
          </div>

          {props.valueBlocks && (
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              {props.valueBlocks.map((b) => (
                <div key={b.title} className="rounded-lg border border-border/40 p-3">
                  <p className="text-sm font-medium mb-2">{b.title}</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {b.items.map((i) => <li key={i}>• {i}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Disconnected / pending state
  return (
    <Card className="border-border/40 bg-card/40">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-[#2BFF88]/10 flex items-center justify-center">
            <MessageCircle className="h-6 w-6 text-[#2BFF88]" />
          </div>
          <div>
            <CardTitle className="text-2xl">{props.title || "Conecte seu WhatsApp"}</CardTitle>
            {props.description && (
              <p className="text-sm text-muted-foreground mt-1">{props.description}</p>
            )}
          </div>
          <div className="ml-auto">
            {status === "paused" && <Badge variant="outline" className="border-yellow-500 text-yellow-500">Pausado</Badge>}
            {status === "pending" && <Badge variant="outline" className="border-yellow-500 text-yellow-500">Aguardando</Badge>}
            {status === "not_connected" && <Badge variant="outline">Não conectado</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {degraded && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-yellow-500">Conexão indisponível</p>
              <p className="text-muted-foreground">{degraded}</p>
            </div>
          </div>
        )}

        {qrCode ? (
          <div className="rounded-lg border border-border/40 bg-background/60 p-6 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">Abra o WhatsApp · Aparelhos conectados · Conectar aparelho</p>
            <div className="rounded-lg bg-white p-3">
              <img
                src={qrCode.startsWith("data:") || qrCode.startsWith("http") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp"
                className="h-56 w-56 object-contain"
              />
            </div>
            {pairingCode && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Ou use o código de pareamento</p>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-2xl tracking-widest bg-muted px-3 py-1 rounded">{pairingCode}</code>
                  <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(pairingCode); toast.success("Código copiado"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Aguardando pareamento…
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleStart} disabled={busy} size="lg" className="bg-[#2BFF88] text-black hover:bg-[#2BFF88]/90">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
              Conectar WhatsApp
            </Button>
            {(status === "paused" || status === "revoked" || instance) && (
              <Button variant="outline" onClick={handleReconnect} disabled={busy}>
                Reconectar
              </Button>
            )}
            <Button variant="ghost" onClick={handleSync} disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
          </div>
        )}

        {props.valueBlocks && (
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            {props.valueBlocks.map((b) => (
              <div key={b.title} className="rounded-lg border border-border/40 p-3">
                <p className="text-sm font-medium mb-2">{b.title}</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {b.items.map((i) => <li key={i}>• {i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
