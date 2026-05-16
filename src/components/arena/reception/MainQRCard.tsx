import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRGenerator } from "@/components/arena/QRGenerator";
import { Maximize2, QrCode } from "lucide-react";
import { FullscreenQRDialog } from "./FullscreenQRDialog";

interface Props { arena: any; }

export const MainQRCard = ({ arena }: Props) => {
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!arena?.id) return;
    (async () => {
      const { data } = await supabase
        .from("wa_qr_tokens")
        .select("token")
        .eq("arena_id", arena.id)
        .in("kind", ["checkin"])
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setToken((data as any)?.token || null);
    })();
  }, [arena?.id]);

  if (!token) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-6 text-center space-y-3">
          <QrCode className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Crie o QR de check-in para começar a receber entradas.</p>
          <Button asChild size="sm" variant="outline"><a href="/arena/dashboard/qr">Criar QR de check-in</a></Button>
        </CardContent>
      </Card>
    );
  }

  const url = `${window.location.origin}/c/QR-${token}?kind=qr`;

  return (
    <>
      <Card className="bg-card border-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="bg-white p-2 rounded-md shrink-0">
            <QRGenerator value={url} size={96} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-xl tracking-wide text-foreground">QR DE CHECK-IN</p>
            <p className="text-xs text-muted-foreground">Cole na recepção. Cada scan registra uma entrada.</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Maximize2 className="h-4 w-4" /> Tela cheia
          </Button>
        </CardContent>
      </Card>
      <FullscreenQRDialog
        open={open}
        onClose={() => setOpen(false)}
        value={url}
        title="CHECK-IN"
        subtitle="Entre em segundos pelo seu celular"
        arenaName={arena?.name}
      />
    </>
  );
};
