import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type Arena = {
  id: string;
  name: string;
  slug?: string;
  logo_url?: string | null;
  modalities?: string[] | null;
  qr_token?: string | null;
};

type Step = "loading" | "intro" | "name" | "sport" | "submitting" | "done" | "error";

const PublicCheckin = () => {
  const { code } = useParams();
  const [params] = useSearchParams();
  const mode: "qr" | "booking" = params.get("kind") === "qr" ? "qr" : code?.startsWith("QR-") ? "qr" : "booking";

  const [step, setStep] = useState<Step>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [arena, setArena] = useState<Arena | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [sport, setSport] = useState<string | null>(null);

  const sports = useMemo(() => {
    const m = arena?.modalities || [];
    return m.length ? m : ["Beach Tennis", "Padel", "Vôlei", "Futevôlei"];
  }, [arena]);

  useEffect(() => {
    (async () => {
      try {
        if (mode === "qr") {
          const token = code?.startsWith("QR-") ? code.slice(3) : code;
          const { data } = await supabase.functions.invoke("arena-public-checkin", {
            body: { action: "resolve_qr", token },
          });
          if (!data?.success) {
            setErrorMsg(data?.error === "checkin_disabled" ? "Check-in desativado pela arena." : "QR inválido ou expirado.");
            setStep("error");
            return;
          }
          setArena(data.data);
          setStep("intro");
        } else {
          const { data } = await supabase.functions.invoke("arena-public-checkin", {
            body: { action: "resolve_booking", shortcode: code },
          });
          if (!data?.success) {
            setErrorMsg("Link inválido ou expirado.");
            setStep("error");
            return;
          }
          const d = data.data;
          setArena({ id: d.arena_id, name: d.arena_name, slug: d.arena_slug, logo_url: d.arena_logo, modalities: d.modalities });
          setBookingId(d.booking_id);
          setStep("intro");
        }
      } catch {
        setErrorMsg("Erro ao carregar.");
        setStep("error");
      }
    })();
  }, [code, mode]);

  const submit = async (chosenSport: string) => {
    if (!arena) return;
    setStep("submitting");
    const { data } = await supabase.functions.invoke("arena-public-checkin", {
      body: {
        action: "complete",
        arena_id: arena.id,
        phone,
        name: name.trim() || null,
        sport: chosenSport,
        booking_id: bookingId,
        qr_token: arena.qr_token || null,
        source: mode === "qr" ? "qr" : "booking_link",
      },
    });
    if (data?.success) {
      setStep("done");
    } else {
      setErrorMsg(data?.error === "rate_limited" ? "Muitas tentativas. Aguarde alguns minutos." : "Não foi possível confirmar. Tente novamente.");
      setStep("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardContent className="p-8 space-y-5 text-center">
          {step === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Carregando…</p>
            </>
          )}

          {step === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h1 className="text-xl font-display text-foreground">Não foi possível</h1>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </>
          )}

          {step !== "loading" && step !== "error" && arena && (
            <>
              {arena.logo_url ? (
                <img src={arena.logo_url} alt={arena.name} className="h-16 w-16 rounded-full mx-auto object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary/10 mx-auto" />
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Bem-vindo à</p>
                <h1 className="text-xl font-display text-foreground">{arena.name}</h1>
              </div>
            </>
          )}

          {step === "intro" && (
            <div className="space-y-3 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Seu WhatsApp</Label>
                <Input id="phone" type="tel" inputMode="numeric" placeholder="(11) 99999-9999" autoFocus
                  value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome</Label>
                <Input id="name" placeholder="Como podemos te chamar" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">Qual esporte hoje?</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {sports.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      disabled={phone.replace(/\D/g, "").length < 8}
                      onClick={() => { setSport(s); submit(s); }}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
                {phone.replace(/\D/g, "").length < 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">Digite o WhatsApp para liberar</p>
                )}
              </div>
            </div>
          )}

          {step === "submitting" && (
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          )}

          {step === "done" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h1 className="text-xl font-display text-foreground">Entrada confirmada</h1>
              <p className="text-sm text-muted-foreground">Bom jogo, {name || "atleta"}! 🎾</p>
              {sport && <p className="text-xs text-muted-foreground">{sport}</p>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicCheckin;
