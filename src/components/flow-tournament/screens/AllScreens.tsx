// High-fidelity tournament screens. Mobile-first, 390px wide content.
import { tournament, pairs, groups, courts, schedule, bracket, podium, rankingDelta, feedPosts, Profile } from "./mock/tournamentData";
import { Calendar, MapPin, Trophy, Users, Clock, CheckCircle2, QrCode, Camera, Heart, MessageCircle, Share2, Play, ArrowDown, ArrowUp, Crown, Medal, Search, Filter } from "lucide-react";

const initials = (name: string) => name.split(" ").map(n => n[0]).slice(0, 2).join("");

// ============== S02 — PÁGINA PÚBLICA ==============
export function S02PublicPage({ profile }: { profile: Profile }) {
  return (
    <div>
      <div className="relative h-52 -mt-2">
        <img src={tournament.cover} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{tournament.countdown.toUpperCase()}</div>
        <div className="absolute bottom-3 left-4 right-4">
          <div className="text-[10px] tracking-widest text-primary uppercase">{tournament.edition}</div>
          <h1 className="text-2xl leading-tight tracking-wider text-foreground" style={{ fontFamily: "Bebas Neue" }}>{tournament.name}</h1>
        </div>
      </div>
      <div className="px-4 mt-3 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 text-primary" /><span>{tournament.dates}</span>
          <span className="text-border">•</span>
          <MapPin className="w-3.5 h-3.5 text-primary" /><span>{tournament.venue}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-[9px] uppercase text-muted-foreground">Inscritos</div>
            <div className="text-lg font-bold mt-0.5">52<span className="text-xs text-muted-foreground font-normal">/72</span></div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-[9px] uppercase text-muted-foreground">Premiação</div>
            <div className="text-lg font-bold mt-0.5 text-primary">{tournament.prize}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-[9px] uppercase text-muted-foreground">Inscrição</div>
            <div className="text-lg font-bold mt-0.5">{tournament.fee}</div>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Modalidades</div>
          <div className="space-y-2">
            {tournament.modalities.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-card border border-border rounded-xl p-3">
                <div>
                  <div className="font-semibold">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground">{m.entries}/{m.capacity} duplas</div>
                </div>
                <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(m.entries/m.capacity)*100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {profile === "athlete" && (
          <button className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold tracking-wide">
            Quero me inscrever
          </button>
        )}
        {profile === "organizer" && (
          <div className="grid grid-cols-2 gap-2">
            <button className="py-3 rounded-xl bg-card border border-primary text-primary font-semibold text-sm">Editar</button>
            <button className="py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">Compartilhar</button>
          </div>
        )}
        {profile === "arena" && (
          <button className="w-full py-3 rounded-xl bg-card border border-border text-sm">Ver minhas quadras alocadas</button>
        )}
        {profile === "public" && (
          <button className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold">Acompanhar torneio</button>
        )}
      </div>
    </div>
  );
}

// ============== S03 — INSCRIÇÃO ==============
export function S03Enrollment() {
  return (
    <div className="px-4 space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Categoria</div>
        <div className="space-y-2">
          {tournament.modalities.map((m, i) => (
            <label key={m.id} className={`flex items-center justify-between p-3 rounded-xl border ${i===0 ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${i===0 ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                <div>
                  <div className="font-semibold text-sm">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground">{m.entries}/{m.capacity} duplas</div>
                </div>
              </div>
              <span className="font-bold text-primary text-sm">R$ 180</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Sua dupla</div>
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-xs">LM</div>
            <div className="flex-1">
              <div className="text-sm font-medium">Larissa Mendes</div>
              <div className="text-[10px] text-muted-foreground">Você</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted grid place-items-center font-bold text-xs">CR</div>
            <div className="flex-1">
              <div className="text-sm font-medium">Camila Ribeiro</div>
              <div className="text-[10px] text-primary">Convite aceito ✓</div>
            </div>
          </div>
        </div>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" defaultChecked className="mt-0.5 accent-primary" />
        <span>Li e aceito o <span className="text-primary underline">regulamento</span> do torneio.</span>
      </label>
      <div className="bg-card border border-border rounded-xl p-3 space-y-1 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">Inscrição</span><span>R$ 180,00</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Taxa</span><span>R$ 5,00</span></div>
        <div className="flex justify-between font-bold pt-1 border-t border-border"><span>Total</span><span className="text-primary">R$ 185,00</span></div>
      </div>
      <button className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold">Pagar com PIX</button>
    </div>
  );
}

// ============== S04 — INSCRITOS ==============
export function S04Athletes({ profile }: { profile: Profile }) {
  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input placeholder="Buscar dupla..." className="bg-transparent outline-none text-xs flex-1" />
        </div>
        <button className="p-2 rounded-xl bg-card border border-border"><Filter className="w-4 h-4" /></button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {["Todas", "Mista C", "Open", "Iniciante"].map((c, i) => (
          <button key={c} className={`px-3 py-1 rounded-full text-[11px] whitespace-nowrap ${i===1 ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>{c}</button>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground">{pairs.length} duplas inscritas • {profile === "organizer" ? "Gestão habilitada" : "Lista pública"}</div>
      <div className="space-y-2">
        {pairs.slice(0, 10).map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
            <div className="text-xs font-bold text-muted-foreground w-5">{i+1}</div>
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-primary/80 border-2 border-card grid place-items-center text-[10px] font-bold text-primary-foreground">{initials(p.p1)}</div>
              <div className="w-8 h-8 rounded-full bg-secondary border-2 border-card grid place-items-center text-[10px] font-bold text-secondary-foreground">{initials(p.p2)}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{p.p1.split(" ")[0]} & {p.p2.split(" ")[0]}</div>
              <div className="text-[10px] text-muted-foreground">{p.city}</div>
            </div>
            {p.seed && <span className="text-[10px] text-primary font-bold">#{p.seed}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== S05 — CHECK-IN ==============
export function S05CheckIn({ profile }: { profile: Profile }) {
  const total = 32, done = 23;
  if (profile === "athlete") {
    return (
      <div className="px-4 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <div className="text-[10px] uppercase tracking-widest text-primary mb-2">Seu QR Code</div>
          <div className="w-44 h-44 mx-auto bg-foreground rounded-xl grid place-items-center">
            <QrCode className="w-32 h-32 text-background" />
          </div>
          <div className="text-xs text-muted-foreground mt-3">Apresente na recepção</div>
          <div className="text-sm font-semibold mt-1">Larissa & Camila</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <div className="text-xs"><span className="font-semibold">Check-in confirmado</span><div className="text-muted-foreground">Hoje, 07:42</div></div>
        </div>
      </div>
    );
  }
  return (
    <div className="px-4 space-y-3">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Confirmados</div>
          <div className="text-[10px] text-primary">Ao vivo</div>
        </div>
        <div className="flex items-end gap-2">
          <div className="text-4xl font-bold text-primary" style={{ fontFamily: "Bebas Neue" }}>{done}</div>
          <div className="text-lg text-muted-foreground mb-1">/ {total}</div>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${(done/total)*100}%` }} />
        </div>
      </div>
      <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2">
        <Camera className="w-4 h-4" /> Ler QR Code
      </button>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground pt-2">Últimos check-ins</div>
      {pairs.slice(0, 6).map((p, i) => (
        <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-2.5">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <div className="flex-1 text-xs font-medium">{p.p1.split(" ")[0]} & {p.p2.split(" ")[0]}</div>
          <div className="text-[10px] text-muted-foreground">07:{42-i}</div>
        </div>
      ))}
    </div>
  );
}

// ============== S08 — GRUPOS ==============
export function S08GroupsView() {
  return (
    <div className="px-4 space-y-3">
      <div className="text-xs text-muted-foreground">4 chaves • 16 duplas • 24 jogos</div>
      {groups.map(g => (
        <div key={g.id} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="bg-primary/10 px-3 py-2 flex items-center justify-between border-b border-primary/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold text-sm">{g.id}</div>
              <span className="font-semibold text-sm">Chave {g.id}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">6 jogos</span>
          </div>
          <div className="divide-y divide-border">
            {g.pairs.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2.5 px-3 py-2">
                <div className="text-[10px] w-3 text-muted-foreground">{i+1}</div>
                <div className="w-6 h-6 rounded-full bg-primary/80 grid place-items-center text-[9px] font-bold text-primary-foreground">{initials(p.p1)}</div>
                <div className="flex-1 text-xs">{p.p1.split(" ")[0]} & {p.p2.split(" ")[0]}</div>
                {p.seed && <span className="text-[9px] text-primary font-bold">#{p.seed}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============== S10 — AGENDA ==============
export function S10Schedule({ profile }: { profile: Profile }) {
  const grouped = courts.map(c => ({ ...c, matches: schedule.filter(m => m.court === c.id) }));
  return (
    <div className="px-4 space-y-3">
      {profile === "athlete" && (
        <div className="bg-primary/10 border border-primary/40 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-widest text-primary mb-1">Seu próximo jogo</div>
          <div className="text-sm font-semibold">09:00 • Quadra Praia</div>
          <div className="text-xs text-muted-foreground mt-0.5">vs. Vitória & Eduarda</div>
        </div>
      )}
      {grouped.map(c => (
        <div key={c.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-bold text-primary">{c.id}</div>
            <div className="text-xs font-semibold">{c.label}</div>
          </div>
          {c.matches.map(m => (
            <div key={m.id} className={`bg-card border rounded-xl p-3 ${m.status === "live" ? "border-primary shadow-[0_0_15px_hsl(var(--primary)/0.2)]" : "border-border"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{m.time}</div>
                {m.status === "live" && <span className="text-[9px] text-primary font-bold animate-pulse">● AO VIVO</span>}
                {m.status === "done" && <span className="text-[9px] text-muted-foreground">FINAL</span>}
              </div>
              <div className="space-y-1.5">
                {[{ p: m.pairA, s: m.scoreA, w: m.winner === "A" }, { p: m.pairB, s: m.scoreB, w: m.winner === "B" }].map((row, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/70 grid place-items-center text-[8px] font-bold text-primary-foreground">{initials(row.p.p1)}</div>
                      <span className={`text-xs ${row.w ? "font-bold" : ""} ${m.status === "done" && !row.w ? "text-muted-foreground" : ""}`}>{row.p.p1.split(" ")[0]} & {row.p.p2.split(" ")[0]}</span>
                    </div>
                    <span className={`text-xs font-bold ${row.w ? "text-primary" : "text-foreground"}`}>{row.s ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============== S11 — BRACKET ==============
export function S11Bracket() {
  const r16 = bracket.filter(b => b.round === "r16");
  const qf = bracket.filter(b => b.round === "qf");
  const sf = bracket.filter(b => b.round === "sf");
  const f = bracket.filter(b => b.round === "f");

  const Cell = ({ m, w = 100 }: { m: typeof bracket[number]; w?: number }) => (
    <div className="bg-card border border-border rounded-md p-1.5 text-[9px] space-y-0.5" style={{ width: w }}>
      {[{ n: m.pairA?.p1, s: m.scoreA, w: m.winner === "A" }, { n: m.pairB?.p1, s: m.scoreB, w: m.winner === "B" }].map((r, i) => (
        <div key={i} className={`flex items-center justify-between ${r.w ? "text-primary font-bold" : "text-muted-foreground"}`}>
          <span className="truncate max-w-[70%]">{r.n?.split(" ")[0] ?? "—"}</span>
          <span>{r.s ?? "·"}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="px-2">
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex gap-3 min-w-max pb-3">
          {/* Oitavas */}
          <div className="flex flex-col gap-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-widest">Oitavas</div>
            {r16.map(m => <Cell key={m.id} m={m} w={92} />)}
          </div>
          {/* Quartas */}
          <div className="flex flex-col justify-around">
            <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Quartas</div>
            {qf.map(m => <Cell key={m.id} m={m} w={92} />)}
          </div>
          {/* Semis */}
          <div className="flex flex-col justify-around">
            <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Semi</div>
            {sf.map(m => <Cell key={m.id} m={m} w={92} />)}
          </div>
          {/* Final */}
          <div className="flex flex-col justify-center">
            <div className="text-[9px] text-primary uppercase tracking-widest mb-1">Final</div>
            {f.map(m => (
              <div key={m.id} className="bg-primary/10 border border-primary rounded-md p-1.5 space-y-0.5" style={{ width: 92 }}>
                {[{ n: m.pairA?.p1, s: m.scoreA, w: m.winner === "A" }, { n: m.pairB?.p1, s: m.scoreB, w: m.winner === "B" }].map((r, i) => (
                  <div key={i} className={`flex items-center justify-between text-[9px] ${r.w ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    <span className="truncate max-w-[70%]">{r.n?.split(" ")[0]}</span><span>{r.s}</span>
                  </div>
                ))}
                <Crown className="w-3 h-3 text-primary mx-auto mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 px-2 text-center bg-primary/10 border border-primary rounded-xl p-3">
        <Crown className="w-5 h-5 text-primary mx-auto mb-1" />
        <div className="text-[10px] uppercase tracking-widest text-primary">Campeãs</div>
        <div className="text-sm font-bold">{podium.champion.p1} & {podium.champion.p2}</div>
      </div>
    </div>
  );
}

// ============== S18 — FEED PÓS ==============
export function S18PostFeed() {
  return (
    <div className="px-4 space-y-3">
      <div className="bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/30 rounded-xl p-4">
        <Trophy className="w-6 h-6 text-primary mb-1" />
        <div className="text-[10px] uppercase tracking-widest text-primary">Torneio finalizado</div>
        <div className="text-base font-bold mt-0.5">{tournament.name}</div>
        <div className="text-xs text-muted-foreground">12 V-Clips • 89 posts</div>
      </div>
      {feedPosts.map(post => (
        <div key={post.id} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 p-3">
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-xs">{post.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{post.author}</div>
              <div className="text-[10px] text-muted-foreground">{post.time} • Beach Tennis Open</div>
            </div>
          </div>
          {post.hasVideo && (
            <div className="relative aspect-video bg-muted">
              <img src={tournament.cover} alt="" className="w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="w-12 h-12 rounded-full bg-primary/90 grid place-items-center"><Play className="w-5 h-5 text-primary-foreground fill-primary-foreground" /></div>
              </div>
            </div>
          )}
          <div className="p-3 space-y-2">
            <p className="text-sm">{post.text}</p>
            <div className="flex items-center gap-4 text-muted-foreground text-xs">
              <button className="flex items-center gap-1"><Heart className="w-4 h-4" />{post.likes}</button>
              <button className="flex items-center gap-1"><MessageCircle className="w-4 h-4" />24</button>
              <button className="flex items-center gap-1"><Share2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============== SIMPLIFIED SCREENS ==============

export function S01Create() {
  const steps = ["Modalidade", "Categorias", "Datas e Local", "Inscrições", "Premiação", "Publicar"];
  return (
    <div className="px-4 space-y-3">
      <div className="text-xs text-muted-foreground">Passo 3 de 6</div>
      <div className="h-1 rounded-full bg-muted"><div className="h-full w-1/2 bg-primary rounded-full" /></div>
      {steps.map((s, i) => (
        <div key={s} className={`flex items-center gap-3 p-3 rounded-xl border ${i===2 ? "bg-primary/5 border-primary" : "bg-card border-border"}`}>
          <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${i<2 ? "bg-primary text-primary-foreground" : i===2 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{i<2 ? "✓" : i+1}</div>
          <span className={`text-sm ${i===2 ? "font-semibold" : ""}`}>{s}</span>
        </div>
      ))}
      <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold mt-2">Continuar</button>
    </div>
  );
}

export function S06GroupsForm() {
  return (
    <div className="px-4 space-y-3">
      <div className="text-xs text-muted-foreground">16 duplas • 4 chaves de 4</div>
      <div className="grid grid-cols-2 gap-2">
        {["A","B","C","D"].map(g => (
          <div key={g} className="bg-card border border-border rounded-xl p-3 aspect-square grid place-items-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary" style={{ fontFamily: "Bebas Neue" }}>{g}</div>
              <div className="text-[10px] text-muted-foreground mt-1">4 duplas</div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-3 text-xs space-y-2">
        <div className="flex justify-between"><span className="text-muted-foreground">Distribuição</span><span>Por seed</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Cabeças de chave</span><span className="text-primary">4 separados</span></div>
      </div>
      <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold">Confirmar formação</button>
    </div>
  );
}

export function S07Draw() {
  return (
    <div className="px-4 space-y-3 text-center pt-6">
      <div className="text-[10px] uppercase tracking-widest text-primary">Sorteio em andamento</div>
      <div className="text-2xl tracking-wider" style={{ fontFamily: "Bebas Neue" }}>Distribuindo duplas</div>
      <div className="relative h-44 grid place-items-center">
        <div className="absolute w-32 h-32 rounded-full border-2 border-primary/30 animate-ping" />
        <div className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary grid place-items-center">
          <Trophy className="w-10 h-10 text-primary" />
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-3 text-left text-xs space-y-1.5">
        <div className="flex justify-between"><span className="text-muted-foreground">Larissa & Camila</span><span className="text-primary font-bold">→ Chave A</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Marina & Júlia</span><span className="text-primary font-bold">→ Chave B</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Bianca & Helena</span><span className="text-primary font-bold">→ Chave C</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Sorteando...</span><span className="text-muted-foreground animate-pulse">● ● ●</span></div>
      </div>
    </div>
  );
}

export function S09GenerateMatches() {
  return (
    <div className="px-4 space-y-3">
      <div className="bg-card border border-border rounded-xl p-4 text-center">
        <div className="text-3xl font-bold text-primary" style={{ fontFamily: "Bebas Neue" }}>24</div>
        <div className="text-xs text-muted-foreground">jogos gerados</div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {courts.map(c => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-2">
            <div className="text-[10px] text-muted-foreground">{c.id}</div>
            <div className="font-bold">8</div>
            <div className="text-[9px] text-muted-foreground">jogos</div>
          </div>
        ))}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground pt-1">Prévia</div>
      {schedule.slice(0, 4).map(m => (
        <div key={m.id} className="bg-card border border-border rounded-xl p-2.5 text-xs flex items-center justify-between">
          <span className="text-muted-foreground">{m.time} • {m.court}</span>
          <span className="font-medium truncate ml-2">{m.pairA.p1.split(" ")[0]} vs {m.pairB.p1.split(" ")[0]}</span>
        </div>
      ))}
      <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold">Publicar agenda</button>
    </div>
  );
}

export function S12Live() {
  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary animate-pulse" /><span className="text-xs font-semibold">3 jogos ao vivo agora</span></div>
      {schedule.filter(m => m.status === "live" || m.status === "done").slice(0, 4).map((m, i) => (
        <div key={m.id} className={`rounded-xl p-3 border ${i===0 ? "bg-primary/10 border-primary" : "bg-card border-border"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground">{m.court} • {m.time}</span>
            {i===0 && <span className="text-[10px] text-primary font-bold animate-pulse">● AO VIVO</span>}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>{m.pairA.p1.split(" ")[0]} & {m.pairA.p2.split(" ")[0]}</span>
            <span className="font-bold text-primary text-lg">{m.scoreA ?? "0"}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{m.pairB.p1.split(" ")[0]} & {m.pairB.p2.split(" ")[0]}</span>
            <span className="font-bold text-lg">{m.scoreB ?? "0"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function S13Result({ profile }: { profile: Profile }) {
  return (
    <div className="px-4 space-y-3">
      <div className="bg-card border border-border rounded-xl p-3 text-xs text-muted-foreground">
        Quadra Praia • 09:00
      </div>
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        {[{ name: "Larissa & Camila", winner: true }, { name: "Vitória & Eduarda", winner: false }].map((row, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${row.winner ? "font-bold" : ""}`}>{row.name}</span>
              {row.winner && <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">VENCEDOR</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["Set 1", "Set 2", "Set 3"].map((s, j) => (
                <div key={j} className="bg-background border border-border rounded-lg p-2 text-center">
                  <div className="text-[9px] text-muted-foreground">{s}</div>
                  <div className="text-xl font-bold">{row.winner ? [6,6,"—"][j] : [4,3,"—"][j]}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {profile === "organizer" && (
        <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold">Confirmar resultado</button>
      )}
    </div>
  );
}

export function S14Advance() {
  return (
    <div className="px-4 space-y-3 pt-4 text-center">
      <div className="text-[10px] uppercase tracking-widest text-primary">Fase concluída</div>
      <div className="text-2xl tracking-wider" style={{ fontFamily: "Bebas Neue" }}>Quartas → Semi</div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-left">
        {[pairs[0], pairs[1], pairs[2], pairs[4]].map(p => (
          <div key={p.id} className="bg-primary/10 border border-primary rounded-xl p-2.5">
            <div className="text-[9px] text-primary uppercase">Classificada</div>
            <div className="text-xs font-bold mt-0.5">{p.p1.split(" ")[0]} & {p.p2.split(" ")[0]}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground pt-2">As semifinais começam em 30 min</div>
      <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold">Ver chaveamento</button>
    </div>
  );
}

export function S15Final() {
  return (
    <div className="px-4 space-y-3 pt-2">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-widest text-primary">Grande final</div>
        <div className="text-2xl tracking-wider" style={{ fontFamily: "Bebas Neue" }}>Beach Tennis Open</div>
      </div>
      <div className="bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary rounded-2xl p-5 space-y-4">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary text-primary-foreground grid place-items-center text-lg font-bold">LM</div>
          <div className="text-base font-bold mt-2">Larissa & Camila</div>
          <div className="text-xs text-muted-foreground">Cabeças de chave #1</div>
        </div>
        <div className="text-center text-3xl font-bold tracking-widest" style={{ fontFamily: "Bebas Neue" }}>VS</div>
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-secondary text-secondary-foreground grid place-items-center text-lg font-bold">MC</div>
          <div className="text-base font-bold mt-2">Marina & Júlia</div>
          <div className="text-xs text-muted-foreground">Cabeças de chave #2</div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-3 text-center text-xs">
        <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
        Hoje, 17:00 • Quadra Praia
      </div>
    </div>
  );
}

export function S16Champion() {
  return (
    <div className="px-4 pt-4 space-y-4">
      <div className="text-center">
        <Trophy className="w-10 h-10 text-primary mx-auto" />
        <div className="text-[10px] uppercase tracking-widest text-primary mt-2">Campeãs do torneio</div>
      </div>
      <div className="flex items-end justify-center gap-2 mt-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-secondary text-secondary-foreground grid place-items-center font-bold mx-auto">MC</div>
          <Medal className="w-4 h-4 mx-auto text-secondary mt-1" />
          <div className="text-[10px] font-semibold mt-0.5">Marina & Júlia</div>
          <div className="h-16 w-16 bg-secondary/30 mt-1 rounded-t-md grid place-items-center text-lg font-bold">2</div>
        </div>
        <div className="text-center">
          <Crown className="w-6 h-6 text-primary mx-auto" />
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold mx-auto -mt-1">LC</div>
          <div className="text-xs font-bold mt-1">Larissa & Camila</div>
          <div className="h-24 w-20 bg-primary/30 mt-1 rounded-t-md grid place-items-center text-2xl font-bold text-primary">1</div>
        </div>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-muted grid place-items-center font-bold mx-auto">BH</div>
          <Medal className="w-4 h-4 mx-auto text-amber-700 mt-1" />
          <div className="text-[10px] font-semibold mt-0.5">Bianca & Helena</div>
          <div className="h-12 w-16 bg-muted mt-1 rounded-t-md grid place-items-center text-lg font-bold">3</div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-3 text-center text-xs">
        Final: <span className="font-bold text-primary">7/6 6/7 10/8</span>
      </div>
      <div className="bg-card border border-border rounded-xl p-3 text-center">
        <div className="text-[10px] uppercase text-muted-foreground">Premiação</div>
        <div className="text-2xl font-bold text-primary mt-0.5" style={{ fontFamily: "Bebas Neue" }}>R$ 3.000</div>
      </div>
    </div>
  );
}

export function S17Ranking() {
  return (
    <div className="px-4 space-y-3">
      <div className="text-xs text-muted-foreground">Ranking nacional atualizado</div>
      {rankingDelta.map((r, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 text-center">
            <div className="text-base font-bold">{r.to}</div>
            <div className="text-[8px] text-muted-foreground">posição</div>
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold">{r.pair.p1.split(" ")[0]} & {r.pair.p2.split(" ")[0]}</div>
            <div className="text-[10px] text-muted-foreground">{r.pair.city}</div>
          </div>
          <div className={`flex items-center gap-1 text-xs font-bold ${r.delta < 0 ? "text-primary" : "text-destructive"}`}>
            {r.delta < 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(r.delta)}
          </div>
        </div>
      ))}
    </div>
  );
}
