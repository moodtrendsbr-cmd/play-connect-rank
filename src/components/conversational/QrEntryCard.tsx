import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, ArrowRight } from "lucide-react";

interface Props {
  title?: string;
  subtitle?: string;
  ctaTo: string;
  ctaLabel?: string;
}

export const QrEntryCard = ({
  title = "Entrada por QR",
  subtitle = "Check-in físico, acesso e ativação rápida",
  ctaTo,
  ctaLabel = "Abrir QR",
}: Props) => {
  return (
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

        <Button asChild size="sm" className="mt-auto w-full">
          <Link to={ctaTo}>
            {ctaLabel}
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
