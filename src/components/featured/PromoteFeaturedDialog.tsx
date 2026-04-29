import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Star, Sparkles, Crown, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "tournament" | "product" | "company" | "arena" | "sponsored_post";
  entityId: string;
  entityLabel?: string;
}

const TIER_ICON: Record<string, any> = { basic: Star, premium: Sparkles, spotlight: Crown };
const TIER_COLOR: Record<string, string> = { basic: "#2BFF88", premium: "#F5C842", spotlight: "#FF8A2B" };

const PromoteFeaturedDialog = ({ open, onOpenChange, entityType, entityId, entityLabel }: Props) => {
  const [pricing, setPricing] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (supabase as any)
      .from("featured_pricing")
      .select("*")
      .eq("active", true)
      .order("price_brl", { ascending: true })
      .then(({ data }: any) => {
        setPricing(data || []);
        setLoading(false);
      });
  }, [open]);

  const handlePurchase = async (tier: string) => {
    setSubmitting(tier);
    try {
      const { data, error } = await (supabase as any).rpc("purchase_featured", {
        _entity_type: entityType,
        _entity_id: entityId,
        _tier: tier,
      });
      if (error) throw error;
      toast({
        title: "Destaque solicitado",
        description: "Conclua o pagamento para ativar automaticamente.",
      });
      onOpenChange(false);
      // Future: redirect to checkout with source_type=featured, source_id=data.featured_id
      console.log("[promote-featured] created:", data);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">PROMOVER DESTAQUE</DialogTitle>
          <DialogDescription>
            {entityLabel ? `Aumente a visibilidade de "${entityLabel}".` : "Escolha um plano de destaque."}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {pricing.map((p: any) => {
              const Icon = TIER_ICON[p.tier] || Star;
              const color = TIER_COLOR[p.tier] || "#2BFF88";
              return (
                <div
                  key={p.tier}
                  className="rounded-lg p-4 flex items-center gap-3"
                  style={{ background: "#0B0F12", border: `1px solid ${color}33` }}
                >
                  <Icon className="h-6 w-6 shrink-0" style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{p.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {Number(p.price_brl).toFixed(2)} · {p.duration_days} dias
                    </p>
                    {p.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePurchase(p.tier)}
                    disabled={!!submitting}
                    style={{ background: color, color: "#050708" }}
                  >
                    {submitting === p.tier ? <Loader2 className="h-4 w-4 animate-spin" /> : "Promover"}
                  </Button>
                </div>
              );
            })}
            {pricing.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano disponível.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PromoteFeaturedDialog;
