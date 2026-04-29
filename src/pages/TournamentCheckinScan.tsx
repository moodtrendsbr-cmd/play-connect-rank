import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, QrCode, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type ResultRow = {
  ok: boolean;
  message: string;
  athleteName?: string;
  ts: number;
};

const TournamentCheckinScan = () => {
  const { id } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ResultRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id,name,city,state,start_date,end_date")
        .eq("id", id!)
        .maybeSingle();
      setTournament(data);
    };
    load();
    inputRef.current?.focus();
  }, [id]);

  const submit = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setBusy(true);
    try {
      // Accept either raw UUID token, or a URL ending with the token
      const m = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
      const finalToken = m ? m[0] : value;

      const { data, error } = await supabase.rpc("enrollment_checkin_validate", {
        _token: finalToken,
      });

      if (error) throw error;
      const res: any = data;
      const ok = !!res?.ok;
      const msg = res?.message || (ok ? "Check-in confirmado" : "Token inválido");
      const athleteName = res?.athlete_name || res?.athleteName;
      setHistory((h) => [{ ok, message: msg, athleteName, ts: Date.now() }, ...h].slice(0, 20));
      if (ok) toast.success(msg);
      else toast.error(msg);
    } catch (e: any) {
      setHistory((h) => [{ ok: false, message: e.message || "Erro", ts: Date.now() }, ...h].slice(0, 20));
      toast.error(e.message || "Erro ao validar token");
    } finally {
      setBusy(false);
      setToken("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/tournaments/${id}/manage`}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <QrCode className="h-5 w-5 text-primary" /> Check-in do torneio
            </CardTitle>
            {tournament && (
              <p className="text-sm text-muted-foreground">
                {tournament.name} · {tournament.city}/{tournament.state}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Aponte o leitor de QR para o token do atleta ou cole/digite o código abaixo.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(token);
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Cole o token / URL do QR"
                autoComplete="off"
                disabled={busy}
              />
              <Button type="submit" disabled={busy || !token.trim()}>
                Validar
              </Button>
            </form>
          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas validações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
                    r.ok ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"
                  }`}
                >
                  {r.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {r.athleteName && (
                      <p className="font-medium truncate">{r.athleteName}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{r.message}</p>
                  </div>
                  <Badge variant={r.ok ? "default" : "destructive"}>
                    {r.ok ? "OK" : "Erro"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TournamentCheckinScan;
