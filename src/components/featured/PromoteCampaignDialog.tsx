import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Rocket, Star, Crown } from "lucide-react";

interface BoostTier {
  boost_level: number;
  duration_days: number;
  price_brl: number;
  display_name: string;
  description: string | null;
}

interface Props {
  /** 'tournament_boost' | 'company_boost' | 'product_boost' */
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

export default function PromoteCampaignDialog({
  kind, targetType, targetId, companyId, trigger, onPurchased,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tiers, setTiers] = useState<BoostTier[]>([]);
  const [loading, setLoading] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("boost_pricing")
        .select("*")
        .eq("active", true)
        .order("boost_level");
      setTiers((data ?? []) as BoostTier[]);
    })();
  }, [open]);

  const handlePurchase = async (level: number) => {
    setLoading(level);
    const { data, error } = await supabase.rpc("purchase_boost", {
      _kind: kind,
      _target_type: targetType,
      _target_id: targetId,
      _boost_level: level,
      _company_id: companyId ?? null,
    } as any);
    setLoading(null);

    if (error) {
      toast({ title: "Erro ao iniciar boost", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as any;
    if (!result?.success) {
      toast({ title: "Não foi possível", description: result?.reason ?? "Erro", variant: "destructive" });
      return;
    }
    toast({
      title: "Boost criado!",
      description: `R$ ${result.price_brl} · ${result.duration_days} dias. Conclua o pagamento para ativar.`,
    });
    onPurchased?.(result.campaign_id);
    setOpen(false);
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
          <DialogTitle>Impulsionar no feed</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mb-2">
          Apareça com prioridade no feed dos atletas. Pagamento gera ativação automática.
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
              <Button
                size="sm"
                disabled={loading !== null}
                onClick={() => handlePurchase(t.boost_level)}
              >
                {loading === t.boost_level ? "..." : "Comprar"}
              </Button>
            </Card>
          ))}
          {tiers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando planos...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
