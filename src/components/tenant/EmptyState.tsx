import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, ctaHref, onCta }: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-card/40">
      <CardContent className="py-10 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {ctaLabel && (ctaHref || onCta) && (
          ctaHref ? (
            <Button asChild size="sm" className="mt-2">
              <Link to={ctaHref}>{ctaLabel} <ArrowRight className="ml-2 h-3.5 w-3.5" /></Link>
            </Button>
          ) : (
            <Button size="sm" className="mt-2" onClick={onCta}>
              {ctaLabel} <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
