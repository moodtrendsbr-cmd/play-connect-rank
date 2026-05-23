import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Store, Settings, ArrowLeft, Share2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import MyNextMatchCard from "@/components/athlete/MyNextMatchCard";
import { SocialActivityFeed } from "@/components/social/SocialActivityFeed";
import { LiveBadge } from "@/components/social/LiveBadge";

const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const TournamentDetail = () => {
  const { id } = useParams();
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<any>(null);
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [circuit, setCircuit] = useState<{ id: string; name: string } | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!id || !isValidUUID(id)) {
        setTournament(null);
        return;
      }
      const { data } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
      setTournament(data);

      if ((data as any)?.circuit_id) {
        const { data: c } = await supabase.from("circuits" as any).select("id, name").eq("id", (data as any).circuit_id).maybeSingle();
        if (c) setCircuit({ id: (c as any).id, name: (c as any).name });
      } else {
        setCircuit(null);
      }

      const { count } = await supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("tournament_id", id!);
      setEnrollmentCount(count || 0);

      if (user) {
        const { data: enrollment } = await supabase
          .from("enrollments")
          .select("id")
          .eq("tournament_id", id!)
          .eq("user_id", user.id)
          .maybeSingle();
        setAlreadyEnrolled(!!enrollment);
      }

      // Fetch tournament partners
      const { data: partnerData } = await supabase
        .from("tournament_partners")
        .select("*, companies(id, name, logo_url)")
        .eq("tournament_id", id!)
        .order("position_order");
      setPartners(partnerData || []);

      // Active paid sponsorships (P3 — produto/CTA in-tournament)
      const { data: sponsorData } = await supabase
        .from("tournament_sponsorships")
        .select("id, logo_url, link, message, company_id, companies:company_id(id, name, logo_url)")
        .eq("tournament_id", id!)
        .eq("status", "active");
      setSponsors(sponsorData || []);
    };
    if (id) fetch();
  }, [id, user]);

  // Update document title + og meta tags whenever tournament loads
  useEffect(() => {
    if (!tournament) return;
    const desc = `${tournament.city || ""} - ${tournament.state || ""} · ${tournament.start_date} a ${tournament.end_date} · R$ ${Number(tournament.entry_fee || 0).toFixed(2)}`;
    const title = `${tournament.name} · MOOD PLAY`;
    document.title = title;

    const setMeta = (selector: string, attr: "content", value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        const [, key, name] = selector.match(/^meta\[(name|property)="([^"]+)"\]$/) || [];
        if (key && name) el.setAttribute(key, name);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:type"]', "content", "website");
    setMeta('meta[property="og:url"]', "content", `${window.location.origin}/tournaments/${tournament.id}`);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", desc);

    // JSON-LD SportsEvent (P3 SEO)
    const ldId = "tournament-jsonld";
    let script = document.getElementById(ldId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = ldId;
      document.head.appendChild(script);
    }
    const ld: any = {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: tournament.name,
      startDate: tournament.start_date,
      endDate: tournament.end_date,
      eventStatus: new Date(tournament.end_date) < new Date()
        ? "https://schema.org/EventCompleted"
        : "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      url: `${window.location.origin}/tournaments/${tournament.id}`,
      description: desc,
      location: {
        "@type": "Place",
        name: tournament.arena || `${tournament.city || ""}/${tournament.state || ""}`,
        address: {
          "@type": "PostalAddress",
          addressLocality: tournament.city || undefined,
          addressRegion: tournament.state || undefined,
          addressCountry: "BR",
        },
      },
      offers: tournament.entry_fee != null ? {
        "@type": "Offer",
        price: Number(tournament.entry_fee).toFixed(2),
        priceCurrency: "BRL",
        availability: "https://schema.org/InStock",
        url: `${window.location.origin}/tournaments/${tournament.id}`,
      } : undefined,
      organizer: tournament.organizer_id ? {
        "@type": "Organization",
        name: "MoodPlay",
      } : undefined,
    };
    script.text = JSON.stringify(ld);

    return () => {
      const el = document.getElementById(ldId);
      if (el) el.remove();
    };
  }, [tournament]);

  const handleEnroll = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    navigate(`/payment/${id}`);
  };

  if (!tournament) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  const available = tournament.max_slots - enrollmentCount;
  const isFinished = new Date(tournament.end_date) < new Date();
  const isAthlete = !userRole || userRole === "athlete";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tournaments" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Link to="/tournaments" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container max-w-2xl py-8 pb-24">
        <h1 className="text-4xl font-display text-foreground">🏐 {tournament.name}</h1>

        {circuit && (
          <Link
            to={`/tenant/circuitos/${circuit.id}`}
            className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            🏆 Etapa do circuito · {circuit.name}
          </Link>
        )}

        {user && alreadyEnrolled && (
          <div className="mt-4">
            <MyNextMatchCard />
          </div>
        )}

        <div className="mt-6 space-y-3 text-foreground">
          <p>📍 {tournament.city} - {tournament.state}</p>
          <p>📅 {tournament.start_date} a {tournament.end_date}</p>
          <p>💰 R$ {Number(tournament.entry_fee).toFixed(2)}</p>
          <p>🎟 Vagas disponíveis: {available > 0 ? available : 0}</p>
        </div>

        {tournament.rules && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <h3 className="font-sans font-bold mb-2">Regulamento</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.rules}</p>
            </CardContent>
          </Card>
        )}

        {isAthlete && (
          <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            Ao se inscrever, sua vaga fica reservada por {tournament.payment_deadline_days} dias.
            A confirmação acontece automaticamente após pagamento.
          </div>
        )}

        {/* Terms checkbox */}
        {isAthlete && !isFinished && !alreadyEnrolled && available > 0 && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(v) => setTermsAccepted(v === true)}
              className="mt-0.5"
            />
            <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-snug">
              Declaro que li o regulamento e aceito os termos para divulgação de minha imagem nos perfis de torneios e divulgações vinculados a Mood Play
            </label>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {isFinished ? (
            <>
              <Button disabled className="w-full h-14 text-lg">🏁 Torneio encerrado</Button>
              <Button variant="outline" className="w-full h-14 text-lg font-bold" asChild>
                <Link to={`/tournaments/${id}/brackets`}>🏆 Ver resultados</Link>
              </Button>
            </>
          ) : isAthlete ? (
            alreadyEnrolled ? (
              <Button className="w-full h-14 text-lg font-bold" asChild>
                <Link to={`/payment/${id}`}>Continuar para pagamento</Link>
              </Button>
            ) : available <= 0 ? (
              <Button disabled className="w-full h-14 text-lg">Vagas esgotadas</Button>
            ) : tournament.match_enabled ? (
              <>
                <Button onClick={handleEnroll} disabled={!termsAccepted} className="w-full h-14 text-lg font-bold box-glow">
                  👥 Tenho dupla/time
                </Button>
                <Button variant="outline" disabled={!termsAccepted} className="w-full h-14 text-lg font-bold border-primary text-primary" asChild={termsAccepted}>
                  {termsAccepted ? (
                    <Link to={`/tournaments/${id}/match`}>🔍 Procurar parceiros</Link>
                  ) : (
                    <span>🔍 Procurar parceiros</span>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={handleEnroll} disabled={!termsAccepted} className="w-full h-14 text-lg font-bold box-glow">
                🟢 Inscrever-se
              </Button>
            )
          ) : null}

          <Button variant="outline" className="w-full h-12 font-bold mt-3" asChild>
            <Link to={`/tournaments/${id}/share`}>
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar / QR
            </Link>
          </Button>

          {user?.id === tournament.organizer_id && (
            <Button variant="outline" className="w-full h-14 text-lg font-bold mt-3" asChild>
              <Link to={`/tournaments/${id}/manage`}>
                <Settings className="mr-2 h-5 w-5" /> Gerenciar torneio
              </Link>
            </Button>
          )}
        </div>

        {sponsors.length > 0 && (
          <div className="mt-8">
            <h3 className="font-display text-lg text-foreground mb-3">⭐ APRESENTADO POR</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {sponsors.map((s) => {
                const logo = s.logo_url || s.companies?.logo_url;
                const name = s.companies?.name || "Patrocinador";
                const handleClick = async () => {
                  try {
                    await supabase
                      .from("tournament_sponsorships")
                      .update({ clicks_count: (s.clicks_count || 0) + 1 } as any)
                      .eq("id", s.id);
                  } catch {}
                };
                const inner = (
                  <div className="flex items-center gap-3 rounded-xl p-4 border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent transition-all hover:border-primary/60 hover:shadow-[0_0_18px_hsl(110_100%_55%/0.18)]">
                    {logo ? (
                      <img src={logo} alt={name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Store className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                      {s.message && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{s.message}</p>
                      )}
                    </div>
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Patrocinador</Badge>
                  </div>
                );
                if (s.link) {
                  return (
                    <a key={s.id} href={s.link} target="_blank" rel="noopener noreferrer sponsored" onClick={handleClick}>
                      {inner}
                    </a>
                  );
                }
                if (s.companies?.id) {
                  return (
                    <Link key={s.id} to={`/marketplace/company/${s.companies.id}`} onClick={handleClick}>
                      {inner}
                    </Link>
                  );
                }
                return <div key={s.id}>{inner}</div>;
              })}
            </div>
          </div>
        )}

        {partners.length > 0 && (
          <div className="mt-8">
            <h3 className="font-display text-lg text-foreground mb-3">🤝 PARCEIROS OFICIAIS</h3>
            <div className="flex flex-wrap gap-3">
              {partners.map((p) => (
                <Link
                  key={p.id}
                  to={`/marketplace/company/${p.companies?.id}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 border border-primary/20 transition-all hover:border-primary/40 hover:shadow-[0_0_10px_hsl(110_100%_55%/0.1)]"
                  style={{ background: "#0B0F12" }}
                >
                  {p.companies?.logo_url ? (
                    <img src={p.companies.logo_url} className="h-8 w-8 rounded-lg object-cover" />
                  ) : (
                    <Store className="h-6 w-6 text-muted-foreground" />
                  )}
                  <span className="text-sm text-foreground">{p.companies?.name}</span>
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary ml-1">Parceiro</Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Atividade do torneio */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-display text-lg text-foreground">ATIVIDADE</h3>
            <LiveBadge variant="starting_soon" count={tournament?.start_date && new Date(tournament.start_date).getTime() - Date.now() < 2 * 3600 * 1000 && new Date(tournament.start_date).getTime() > Date.now() ? 1 : 0} />
          </div>
          <SocialActivityFeed tournamentId={id} limit={15} title="" realtime />
        </div>
      </main>
    </div>
  );
};

export default TournamentDetail;
