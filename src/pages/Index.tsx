import { motion } from "framer-motion";
import { Trophy, Users, Zap, BarChart3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Trophy,
    title: "Torneios Completos",
    description: "Crie e gerencie torneios com inscrições, pagamentos e chaveamento automático.",
  },
  {
    icon: Users,
    title: "Rede Social Esportiva",
    description: "Conecte-se com atletas, compartilhe vitórias e acompanhe a comunidade.",
  },
  {
    icon: BarChart3,
    title: "Ranking em Tempo Real",
    description: "Acompanhe sua posição no ranking geral e evolua a cada torneio.",
  },
  {
    icon: Zap,
    title: "Pagamento Integrado",
    description: "Inscrição e pagamento via Mercado Pago com confirmação automática.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Cadastrar</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute right-1/4 bottom-1/4 h-[300px] w-[300px] rounded-full bg-secondary/5 blur-[100px]" />
        </div>

        <div className="container relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-display leading-none">
              <span className="text-foreground">ONDE JOGOS</span>
              <br />
              <span className="text-primary text-glow">VIRAM RANKING.</span>
            </h1>
          </motion.div>

          <motion.p
            className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Onde atletas viram comunidade. Organize torneios, inscreva-se, acompanhe rankings e conecte-se com a comunidade esportiva.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <Button size="lg" className="h-14 px-8 text-lg font-bold box-glow" asChild>
              <Link to="/tournaments">
                🟢 Participar de Torneio
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold border-muted-foreground/30" asChild>
              <Link to="/register?role=organizer">
                ⚫ Sou Organizador
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border py-24">
        <div className="container">
          <motion.h2
            className="text-center text-4xl sm:text-5xl font-display text-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            TUDO QUE VOCÊ PRECISA
          </motion.h2>
          <p className="mx-auto mt-4 max-w-md text-center text-muted-foreground">
            Mood Play conecta organizadores, atletas e fãs em um único ecossistema.
          </p>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-sans text-lg font-bold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-24">
        <div className="container text-center">
          <h2 className="text-4xl sm:text-5xl font-display text-foreground">
            PRONTO PARA <span className="text-primary text-glow">COMPETIR?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            Cadastre-se agora e entre na arena. Seu ranking começa aqui.
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
      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <span className="font-display text-lg text-foreground/60">MOOD PLAY</span>
          <p className="mt-1">Powered by Grupo MOOD</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
