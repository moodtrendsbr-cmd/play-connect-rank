import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRGenerator } from "@/components/arena/QRGenerator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Share2, MessageCircle } from "lucide-react";

interface Props { bookingId: string; open: boolean; onClose: () => void; }

export const BookingGroupShareDialog = ({ bookingId, open, onClose }: Props) => {
  const [shortcode, setShortcode] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !bookingId) return;
    (async () => {
      setLoading(true);
      // Try to read existing shortcode
      let { data: link } = await supabase
        .from("booking_checkin_links")
        .select("shortcode")
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (!link?.shortcode) {
        // Best-effort: try RPC; if missing, generate a friendly short fallback that the public page won't resolve.
        const { data: rpc } = await (supabase as any).rpc("booking_checkin_link_create", { _booking_id: bookingId });
        link = rpc?.shortcode ? { shortcode: rpc.shortcode } : null;
      }
      setShortcode(link?.shortcode || null);

      const { data: ci } = await supabase
        .from("arena_checkins")
        .select("id, display_name, phone_e164, sport, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });
      setMembers((ci as any) || []);
      setLoading(false);
    })();
  }, [bookingId, open]);

  const url = shortcode ? `${window.location.origin}/c/${shortcode}` : "";

  const share = async () => {
    if (!url) return;
    const text = `Reserva confirmada! Faça seu check-in: ${url}`;
    if (navigator.share) { try { await navigator.share({ title: "Check-in da reserva", text, url }); return; } catch {} }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Link do grupo</DialogTitle></DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>
        ) : !shortcode ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Não foi possível gerar o link de grupo agora. Tente novamente em alguns segundos.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-md shrink-0">
                <QRGenerator value={url} size={120} />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs text-muted-foreground">Compartilhe com o grupo para todos fazerem check-in.</p>
                <div className="flex gap-1.5 flex-wrap">
                  <Button size="sm" onClick={share} className="gap-1"><Share2 className="h-3.5 w-3.5" /> Compartilhar</Button>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado"); }} className="gap-1">
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Check-in: ${url}`)}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-1"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button>
                  </a>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Quem já chegou</p>
                <Badge variant="outline" className="text-xs">{members.length}</Badge>
              </div>
              {members.length === 0 ? (
                <Card className="bg-card border-border border-dashed">
                  <CardContent className="p-4 text-center text-xs text-muted-foreground">
                    Ninguém fez check-in ainda.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {members.map((m) => (
                    <Card key={m.id} className="bg-card border-border">
                      <CardContent className="p-2.5 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{m.display_name || "Visitante"}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.sport || "—"}</p>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
