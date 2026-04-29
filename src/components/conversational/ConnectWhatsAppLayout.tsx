import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface Props {
  scopeLabel: string;
  title: string;
  highlight?: string;
  subtitle: string;
  backHref: string;
  children: ReactNode;
}

export function ConnectWhatsAppLayout({ scopeLabel, title, highlight, subtitle, backHref, children }: Props) {
  return (
    <div className="min-h-screen bg-[#050708] text-foreground">
      <header className="border-b border-border/30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to={backHref}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
          </Button>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">{scopeLabel}</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="font-bebas text-4xl sm:text-6xl tracking-wide leading-[0.95]">
            {title}
            {highlight && <span className="text-[#2BFF88]"> {highlight}</span>}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
