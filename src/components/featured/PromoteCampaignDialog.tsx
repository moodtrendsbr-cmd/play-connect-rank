import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Rocket, Star, Crown, Copy, CheckCircle2 } from "lucide-react";

interface BoostTier {
  boost_level: number;
  duration_days: number;
  price_brl: number;
  display_name: string;
  description: string | null;
}

interface Props {
  kind: "tournament_boost" | "company_boost" | "product_boost";
  targetType: "tournament" | "company" | "product";
  targetId: string;
  companyId?: string | null;
  trigger?: React.ReactNode;
  onPurchased?: (campaignId: string) => void;
}

const ICON: Record<number, JSX.Element> = {
  1: <Rocket className="h-5 w-5" />,
  2: <Star className="h-5 w-5" />,
  3: <Crown className="h-5 w-5" />,
};

type Step = "tiers" | "payer" | "pix" | "done";

export default function PromoteCampaignDialog({
  kind, targetType, targetId, companyId, trigger, onPurchased,
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tiers, setTiers] = useState<BoostTier[]>([]);
  const [step, setStep] = useState<Step>("tiers");
  const [selected, setSelected] = useState<BoostTier | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<{ qr: string; b64: string } | null>(null);

  const [payer, setPayer] = useState({
    email: user?.email ?? "",
    first_name: "",
    last_name: "",
    doc: "",
  });

  useEffect(() => {
    if (!open) {
      setStep("tiers"); setSelected(null); setCampaignId(null); setPix(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("boost_pricing")
        .select("*")
        .eq("active", true)
        .order("boost_level");
      setTiers((data ?? []) as BoostTier[]);
    })();
  }, [open]);

  const pickTier = async (t: BoostTier) => {
    setSelected(t);
    setLoading(true);
    const { data, error } = await supabase.rpc("purchase_boost", {
      _kind: kind,
      _target_type: targetType,
      _target_id: targetId,
      _boost_level: t.boost_level,
      _company_id: companyId ?? null,
    } as any);
    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as any;
    if (!result?.success) {
      toast({ title: "Não foi possível", description: result?.reason ?? "Erro", variant: "destructive" });
      return;
    }
    setCampaignId(result.campaign_id);
    onPurchased?.(result.campaign_id);
    setStep("payer");
  };

  const generatePix = async () => {
    if (!campaignId) return;
    if (!payer.email || !payer.doc) {
      toast({ title: "Preencha email e CPF", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("create-boost-payment", {
      body: {
        campaign_id: campaignId,
        payer_email: payer.email,
        payer_first_name: payer.first_name,
        payer_last_name: payer.last_name,
        payer_doc_type: "CPF",
        payer_doc_number: payer.doc.replace(/\D/g, ""),
      },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast({ title: "Erro no checkout", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    const r = data as any;
    if (r.status === "approved") {
      setStep("done");
      toast({ title: "Pagamento aprovado!", description: "Boost ativado." });
      return;
    }
    if (r.pix_qr_code) {
      setPix({ qr: r.pix_qr_code, b64: r.pix_qr_code_base64 });
      setStep("pix");
    } else {
      toast({ title: "Aguardando confirmação...", description: "Verifique o status em instantes." });
    }
  };

  const copyPix = async () => {
    if (!pix?.qr) return;
    await navigator.clipboard.writeText(pix.qr);
    toast({ title: "Código PIX copiado!" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Rocket className="mr-2 h-3 w-3" />
            Impulsionar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "tiers" && "Impulsionar no feed"}
            {step === "payer" && "Dados do pagador"}
            {step === "pix" && "Pague via PIX"}
            {step === "done" && "Boost ativo!"}
          </DialogTitle>
        </DialogHeader>

        {step === "tiers" && (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              Apareça com prioridade no feed. Pagamento via PIX ativa automaticamente.
            </p>
            <div className="space-y-2">
              {tiers.map((t) => (
                <Card key={t.boost_level} className="p-3 flex items-center gap-3">
                  <div style={{ color: "#2BFF88" }}>{ICON[t.boost_level]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{t.display_name}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg">R$ {Number(t.price_brl).toFixed(0)}</div>
                    <div className="text-[10px] text-muted-foreground">{t.duration_days} dias</div>
                  </div>
                  <Button size="sm" disabled={loading} onClick={() => pickTier(t)}>
                    {loading && selected?.boost_level === t.boost_level ? "..." : "Comprar"}
                  </Button>
                </Card>
              ))}
              {tiers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando planos...</p>
              )}
            </div>
          </>
        )}

        {step === "payer" && selected && (
          <div className="space-y-3">
            <div className="rounded-md p-2 text-xs" style={{ background: "rgba(43,255,136,0.08)", color: "#2BFF88" }}>
              {selected.display_name} · R$ {Number(selected.price_brl).toFixed(0)} · {selected.duration_days} dias
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={payer.email} onChange={(e) => setPayer({ ...payer, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={payer.first_name} onChange={(e) => setPayer({ ...payer, first_name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Sobrenome</Label>
                <Input value={payer.last_name} onChange={(e) => setPayer({ ...payer, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={payer.doc} onChange={(e) => setPayer({ ...payer, doc: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <Button className="w-full" onClick={generatePix} disabled={loading}>
              {loading ? "Gerando PIX..." : "Gerar PIX"}
            </Button>
          </div>
        )}

        {step === "pix" && pix && (
          <div className="space-y-3 text-center">
            {pix.b64 && (
              <img
                src={`data:image/png;base64,${pix.b64}`}
                alt="QR Code PIX"
                className="mx-auto rounded-lg border border-border"
                style={{ maxWidth: 240 }}
              />
            )}
            <div className="text-xs text-muted-foreground break-all px-2 py-2 rounded bg-muted">
              {pix.qr.slice(0, 80)}...
            </div>
            <Button variant="outline" className="w-full" onClick={copyPix}>
              <Copy className="mr-2 h-4 w-4" /> Copiar código PIX
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Após pagar, o boost ativa automaticamente em segundos.
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2" style={{ color: "#2BFF88" }} />
            <p className="text-sm">Seu boost está ativo no feed!</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
