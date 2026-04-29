import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Copy, Share2, Download } from "lucide-react";
import { toast } from "sonner";

const QR_API = (text: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&data=${encodeURIComponent(text)}`;

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const TournamentShare = () => {
  const { id } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const publicUrl = `${window.location.origin}/tournaments/${id}`;

  useEffect(() => {
    if (!id || !isValidUUID(id)) return;
    supabase
      .from("tournaments")
      .select("name, city, state, start_date, end_date")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setTournament(data));
  }, [id]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado");
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tournament?.name || "Torneio",
          text: `Confira o torneio ${tournament?.name}`,
          url: publicUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink();
    }
  };

  if (!tournament) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/tournaments/${id}`} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <span className="text-2xl font-display text-primary">🏐 Compartilhar</span>
        </div>
      </header>

      <main className="container max-w-md py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-display text-foreground">{tournament.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tournament.city} - {tournament.state} · {tournament.start_date} → {tournament.end_date}
          </p>
        </div>

        <Card className="border-primary/30">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <div className="bg-card rounded-xl p-3 border border-border">
              <img src={QR_API(publicUrl)} alt="QR do torneio" className="w-72 h-72" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Aponte a câmera para abrir a página do torneio. Imprima e cole na arena.
            </p>
            <a
              href={QR_API(publicUrl)}
              download={`qr-${id}.png`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Download className="h-4 w-4" /> Baixar QR como imagem
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs font-mono break-all">
              {publicUrl}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={copyLink} className="w-full">
                <Copy className="h-4 w-4 mr-2" /> Copiar link
              </Button>
              <Button onClick={share} className="w-full">
                <Share2 className="h-4 w-4 mr-2" /> Compartilhar
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TournamentShare;
