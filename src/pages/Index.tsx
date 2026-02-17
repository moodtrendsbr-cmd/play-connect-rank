import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trophy, Users, Zap, BarChart3, ArrowRight, Building2, Briefcase,
  UserPlus, Medal, Target, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

const ecosystemCards = [
  { icon: Users, emoji: "🏐", title: "Atletas", desc: "Compita, evolua no ranking e encontre parceiros." },
  { icon: Trophy, emoji: "🏆", title: "Organizadores", desc: "Crie torneios profissionais com gestão automática." },
  { icon: Building2, emoji: "🏟", title: "Arenas", desc: "Receba campeonatos e aumente sua ocupação." },
  { icon: Briefcase, emoji: "🏬", title: "Empresas", desc: "Apoie o esporte local e apareça para atletas reais." },
];

const featureCards = [
  { icon: Trophy, title: "Torneios completos", desc: "Criação, inscrições, pagamentos e chaveamentos automáticos." },
  { icon: Users, title: "Rede social esportiva", desc: "Compartilhe jogos, acompanhe resultados e conecte-se." },
  { icon: BarChart3, title: "Ranking em tempo real", desc: "Cada ponto conta para sua evolução." },
  { icon: Zap, title: "Pagamentos integrados", desc: "Confirmação automática e controle financeiro simplificado." },
];

const steps = [
  { num: "01", title: "Crie sua conta", desc: "Cadastre-se em segundos." },
  { num: "02", title: "Participe ou organize", desc: "Entre em campeonatos ou crie o seu." },
  { num: "03", title: "Evolua", desc: "Pontue, suba no ranking e ganhe visibilidade." },
];

const profiles = [
  {
    id: "atletas",
    title: "Jogue. Evolua. Seja visto.",
    bullets: [
      "Encontre torneios na sua cidade",
      "Ranking automático",
      "Match para formar duplas e times",
      "Perfil esportivo valorizado",
    ],
    cta: "Criar conta como Atleta",
    link: "/register",
  },
  {
    id: "organizadores",
    title: "Crie campeonatos profissionais sem planilhas.",
    bullets: [
      "Inscrições automáticas",
      "Chaveamentos inteligentes",
      "Resultados em tempo real",
      "Monetização integrada",
    ],
    cta: "Quero organizar torneios",
    link: "/register",
  },
  {
    id: "arenas",
    title: "Transforme sua quadra em palco de competição.",
    bullets: [
      "Receba campeonatos",
      "Conecte-se com organizadores",
      "Aumente ocupação",
      "Visibilidade local",
    ],
    cta: "Cadastrar minha Arena",
    link: "/register",
  },
  {
    id: "empresas",
    title: "Apareça para atletas reais, no momento certo.",
    bullets: [
      "Patrocínio de torneios",
      "Visibilidade na inscrição e no feed",
      "Ativações com brindes",
      "Métricas de impacto",
    ],
    cta: "Ser parceiro Mood Play",
    link: "/register",
  },
];

const socialProof = [
  { value: "1.200+", label: "Atletas cadastrados" },
  { value: "80+", label: "Torneios realizados" },
  { value: "25+", label: "Cidades ativas" },
];



const Index = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && userRole !== "admin") {
      navigate("/feed", { replace: true });
    }
  }, [loading, user, userRole, navigate]);

  if (loading || (user && userRole !== "admin")) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <span className="text-2xl font-display text-primary">🏐 Mood Play</span>
          <div className="flex items-center gap-3">
            {user && userRole === "admin" ? (
              <Button asChild><Link to="/admin">Painel Admin</Link></Button>
            ) : (
              <>
                <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
                <Button asChild><Link to="/register">Cadastrar</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-primary/3 blur-[120px]" />
        </div>
        <div className="container relative z-10 px-6 sm:px-8 flex flex-col items-center">
          <h1 className="text-[clamp(1.8rem,5.5vw,4.5rem)] font-display leading-tight text-center whitespace-nowrap">
            <motion.span
              className="block font-normal text-foreground"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0 }}
            >
              Onde <span className="text-primary">jogos</span> viram ranking.
            </motion.span>
            <motion.span
              className="block font-normal text-foreground"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
            >
              <span className="text-primary">Atletas</span> ganham valor.
            </motion.span>
            <motion.span
              className="block font-normal text-foreground"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
            >
              <span className="text-primary">Torneios</span> viram ecossistema.
            </motion.span>
            <motion.span
              className="block font-normal text-foreground"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.36 }}
            >
              <span className="text-primary">Empresas</span> ganham visibilidade.
            </motion.span>
          </h1>

          <motion.p
            className="mx-auto mt-8 max-w-md text-sm sm:text-base text-muted-foreground"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
          >
            Conectamos atletas, organizadores, arenas e empresas em um único ecossistema esportivo.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Button size="lg" className="h-12 px-7 text-base font-bold" asChild>
              <Link to="/register">
                Quero Participar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:bg-muted/20" asChild>
              <Link to="/tournaments">Ver torneios disponíveis</Link>
            </Button>
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {[
                { label: "Sou Atleta", target: "atletas" },
                { label: "Sou Organizador", target: "organizadores" },
                { label: "Sou Arena", target: "arenas" },
                { label: "Sou Empresa", target: "empresas" },
              ].map((btn) => (
                <Button
                  key={btn.target}
                  variant="outline"
                  size="sm"
                  className="border-muted-foreground/20 text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => scrollTo(btn.target)}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Ecossistema */}
      <section id="ecosystem" className="border-t border-border py-20 sm:py-28">
        <div className="container">
          <motion.h2
            className="text-center text-3xl sm:text-4xl md:text-5xl font-display text-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Um ecossistema onde todos <span className="text-primary">crescem juntos.</span>
          </motion.h2>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 max-w-3xl mx-auto">
            {ecosystemCards.map((card, i) => (
              <motion.div
                key={card.title}
                className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="font-sans text-lg font-bold text-foreground">{card.emoji} {card.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{card.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.p
            className="mt-10 text-center text-muted-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Cada parte fortalece a outra. <span className="text-primary font-semibold">Isso é Mood Play.</span>
          </motion.p>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="features" className="border-t border-border py-20 sm:py-28">
        <div className="container">
          <motion.h2
            className="text-center text-3xl sm:text-4xl md:text-5xl font-display text-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Tudo que você precisa
          </motion.h2>
          <p className="mx-auto mt-4 max-w-md text-center text-muted-foreground">
            Para competir e crescer.
          </p>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((f, i) => (
              <motion.div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-sans text-lg font-bold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="border-t border-border py-20 sm:py-28">
        <div className="container">
          <motion.h2
            className="text-center text-3xl sm:text-4xl md:text-5xl font-display text-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Simples. Rápido. <span className="text-primary">Profissional.</span>
          </motion.h2>

          <div className="mt-14 grid gap-8 sm:grid-cols-3 max-w-3xl mx-auto">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <span className="text-5xl font-display text-primary">{s.num}</span>
                <h3 className="mt-3 font-sans text-lg font-bold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Para Cada Perfil */}
      {profiles.map((p, i) => (
        <section
          key={p.id}
          id={p.id}
          className="border-t border-border py-20 sm:py-28"
        >
          <div className="container max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-xs font-sans font-semibold uppercase tracking-widest text-primary">
                Para {p.id}
              </span>
              <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-display text-foreground">
                {p.title}
              </h2>
              <ul className="mt-6 space-y-3">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm">{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button className="box-glow" asChild>
                  <Link to={p.link}>
                    {p.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      ))}

      {/* Prova Social */}
      <section className="border-t border-border py-20 sm:py-28">
        <div className="container">
          <motion.h2
            className="text-center text-3xl sm:text-4xl font-display text-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            O esporte da sua cidade já está <span className="text-primary">entrando na arena.</span>
          </motion.h2>

          <div className="mt-14 grid grid-cols-3 gap-6 max-w-xl mx-auto">
            {socialProof.map((s, i) => (
              <motion.div
                key={s.label}
                className="text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <span className="text-3xl sm:text-4xl font-display text-primary">{s.value}</span>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="border-t border-border py-20 sm:py-28">
        <div className="container text-center">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-display text-foreground">
            Pronto para <span className="text-primary">entrar na arena?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            Faça parte do ecossistema esportivo que está conectando cidades.
          </p>
          <div className="mt-8">
            <Button size="lg" className="h-14 px-10 text-lg font-bold box-glow" asChild>
              <Link to="/register">
                Criar minha conta
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div>
              <span className="font-display text-xl text-foreground/80">🏐 Mood Play</span>
              <p className="mt-1 text-sm text-muted-foreground">Onde jogos viram ranking.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["Atletas", "Organizadores", "Arenas", "Empresas", "Termos", "Privacidade"].map((l) => (
                <button
                  key={l}
                  className="hover:text-foreground transition-colors"
                  onClick={() => {
                    const id = l.toLowerCase();
                    if (["atletas", "organizadores", "arenas", "empresas"].includes(id)) scrollTo(id);
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground/60">Powered by Grupo MOOD</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
