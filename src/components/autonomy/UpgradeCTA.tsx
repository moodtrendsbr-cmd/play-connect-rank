import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { type AutonomyTier, TIER_LABELS, TIER_FEATURES, nextTier } from "@/lib/autonomyTier";

interface Props {
  currentTier: AutonomyTier;
  reason?: string;
  compact?: boolean;
}

export const UpgradeCTA = ({ currentTier, reason, compact }: Props) => {
  const next = nextTier(currentTier);
  if (!next) {
    return (
      <Card className="bg-emerald-500/10 border-emerald-500/30">
        <CardContent className="p-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Plano Enterprise ativo</p>
            <p className="text-xs text-muted-foreground">Você tem o nível máximo de autonomia disponível.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const nextFeats = TIER_FEATURES[next];

  if (compact) {
    return (
      <Link
        to="/marketplace/register"
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <Sparkles className="h-3 w-3" />
        Upgrade para {TIER_LABELS[next]}
        <ArrowRight className="h-3 w-3" />
      </Link>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            Desbloqueie o plano {TIER_LABELS[next]}
          </h3>
        </div>
        {reason && (
          <p className="text-xs text-muted-foreground">{reason}</p>
        )}
        <p className="text-sm text-foreground/90">{nextFeats.description}</p>
        <Button asChild size="sm" className="w-full">
          <Link to="/marketplace/register">
            Falar com vendas <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
