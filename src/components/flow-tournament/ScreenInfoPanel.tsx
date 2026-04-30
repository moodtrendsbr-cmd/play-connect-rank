import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ScreenInfo {
  name: string;
  sees: string;
  actions: string[];
  components: string[];
  data: string[];
  state?: string;
}

export default function ScreenInfoPanel({ info }: { info: ScreenInfo }) {
  return (
    <div className="space-y-3 text-sm">
      <Card className="p-4 bg-card border-border">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Nome da tela</div>
        <h3 className="text-xl tracking-wider" style={{ fontFamily: "Bebas Neue" }}>{info.name}</h3>
        {info.state && <Badge variant="outline" className="mt-2 border-primary text-primary">{info.state}</Badge>}
      </Card>

      <Card className="p-4 bg-card border-border">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">O que o usuário vê</div>
        <p className="leading-relaxed text-foreground/90">{info.sees}</p>
      </Card>

      <Card className="p-4 bg-card border-border">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Principais ações</div>
        <ul className="space-y-1">
          {info.actions.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-foreground/90">
              <span className="text-primary mt-1">▸</span><span>{a}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4 bg-card border-border">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Componentes</div>
        <div className="flex flex-wrap gap-1.5">
          {info.components.map((c, i) => (
            <Badge key={i} variant="secondary" className="font-normal">{c}</Badge>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-card border-border">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Dados exibidos</div>
        <ul className="space-y-1 text-foreground/80 text-xs">
          {info.data.map((d, i) => <li key={i}>• {d}</li>)}
        </ul>
      </Card>
    </div>
  );
}
