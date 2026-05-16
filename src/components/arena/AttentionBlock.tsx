import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type AttentionItem = {
  key: string;
  severity: "warn" | "alert";
  title: string;
  context?: string;
  actionLabel: string;
  to: string;
};

export const AttentionBlock = ({ items }: { items: AttentionItem[] }) => {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">Precisa de atenção</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.slice(0, 3).map((it) => (
          <Card
            key={it.key}
            className={cn(
              "bg-card border-l-2",
              it.severity === "alert" ? "border-l-destructive border-border" : "border-l-amber-400 border-border",
            )}
          >
            <CardContent className="p-4 flex flex-col gap-2 h-full">
              <p className="text-sm font-medium text-foreground leading-snug">{it.title}</p>
              {it.context && <p className="text-xs text-muted-foreground leading-snug">{it.context}</p>}
              <div className="mt-auto pt-2">
                <Link to={it.to}>
                  <Button size="sm" variant="outline" className="h-8 text-xs w-full">
                    {it.actionLabel}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
