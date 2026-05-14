import { Link, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Briefcase, ArrowRight } from "lucide-react";

const COPY: Record<string, { title: string; desc: string; cta: string; to: string; icon: any }> = {
  arena: {
    title: "Vamos configurar sua arena",
    desc: "Sua conta foi criada, mas ainda não temos os dados da arena. Complete o cadastro para acessar o painel.",
    cta: "Cadastrar arena",
    to: "/register",
    icon: Building2,
  },
  company: {
    title: "Vamos configurar sua empresa",
    desc: "Sua conta foi criada, mas ainda não temos os dados da empresa. Complete o cadastro para acessar o painel.",
    cta: "Cadastrar empresa",
    to: "/register",
    icon: Briefcase,
  },
};

export default function OnboardingPending() {
  const { kind } = useParams();
  const cfg = COPY[kind ?? ""] ?? COPY.arena;
  const Icon = cfg.icon;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full bg-card border-border">
        <CardContent className="p-8 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
            <Icon className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-display text-foreground">{cfg.title}</h1>
            <p className="text-sm text-muted-foreground">{cfg.desc}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link to={cfg.to}>
                {cfg.cta} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/athlete/feed">Continuar como atleta</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
