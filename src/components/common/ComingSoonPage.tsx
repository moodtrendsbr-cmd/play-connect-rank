import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardPathFor } from "@/lib/dashboardPath";

interface Props {
  title: string;
  description: string;
  backTo?: string;
  ctaLabel?: string;
  ctaTo?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function ComingSoonPage({
  title,
  description,
  backTo,
  ctaLabel,
  ctaTo,
  icon: Icon = Sparkles,
}: Props) {
  const { userRole } = useAuth();
  const back = backTo ?? dashboardPathFor(userRole);
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full bg-card border-border">
        <CardContent className="p-8 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
            <Icon className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl font-display text-foreground">{title}</h1>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Em preparação</Badge>
            <p className="text-sm text-muted-foreground pt-2">{description}</p>
          </div>
          <div className="flex flex-col gap-2">
            {ctaTo && ctaLabel && (
              <Button asChild>
                <Link to={ctaTo}>{ctaLabel}</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to={back}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
