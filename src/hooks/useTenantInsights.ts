import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TenantInsights {
  loading: boolean;
  // Rede
  arenasActive: number;
  organizersActive: number;
  eventsActive: number;
  tournamentsThisWeek: number;
  sponsorsActive: number;
  // Crescimento
  topArenaName: string | null;          // maior ocupação 30d
  topArenaGrowingName: string | null;   // maior crescimento receita período
  peakHour: string | null;
  topSport: string | null;              // mais inscrições absolutas 30d
  topSportGrowing: string | null;       // maior crescimento % período
  lowActivityArenas: number;
  newArenas30d: number;
  newOrganizers30d: number;
  // Inteligência
  trendingTournament: string | null;    // maior nº de inscrições reais 30d
  bestConversionArena: string | null;
}

const empty: TenantInsights = {
  loading: true,
  arenasActive: 0, organizersActive: 0, eventsActive: 0, tournamentsThisWeek: 0, sponsorsActive: 0,
  topArenaName: null, topArenaGrowingName: null, peakHour: null, topSport: null, topSportGrowing: null,
  lowActivityArenas: 0, newArenas30d: 0, newOrganizers30d: 0,
  trendingTournament: null, bestConversionArena: null,
};

export function useTenantInsights(tenantId: string | null | undefined): TenantInsights {
  const [data, setData] = useState<TenantInsights>(empty);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    (async () => {
      const now = new Date();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
      const today = now.toISOString().slice(0, 10);

      const [arenasRes, membersRes, tournamentsRes, sponsorsRes, bookingsRes, txRes, enrollRes] = await Promise.all([
        supabase.from("arenas")
          .select("id, name, is_active, created_at")
          .eq("tenant_id", tenantId),
        supabase.from("tenant_memberships")
          .select("user_id, created_at")
          .eq("tenant_id", tenantId),
        supabase.from("tournaments")
          .select("id, name, modality, start_date, end_date, arena_id, created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", d60)
          .order("created_at", { ascending: false })
          .limit(400),
        supabase.from("sponsor_arena_links" as any)
          .select("id, company_id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true),
        supabase.from("bookings")
          .select("id, arena_id, start_time, status, booking_date")
          .eq("tenant_id", tenantId)
          .gte("booking_date", d60.slice(0, 10))
          .limit(3000),
        supabase.from("financial_transactions")
          .select("arena_id, total_amount, status, created_at")
          .eq("tenant_id", tenantId)
          .eq("status", "paid")
          .gte("created_at", d60)
          .limit(2000),
        supabase.from("enrollments")
          .select("tournament_id, created_at, status")
          .gte("created_at", d30)
          .limit(2000),
      ]);

      if (cancelled) return;

      const arenas = arenasRes.data ?? [];
      const members = membersRes.data ?? [];
      const tournaments = (tournamentsRes.data ?? []) as any[];
      const sponsors = (sponsorsRes.data ?? []) as any[];
      const bookings = (bookingsRes.data ?? []) as any[];
      const txs = (txRes.data ?? []) as any[];
      const enrollments = (enrollRes.data ?? []) as any[];

      // Rede
      const arenasActive = arenas.filter((a: any) => a.is_active).length;
      const eventsActive = tournaments.filter((t: any) => t.end_date && t.end_date >= today).length;
      const tournamentsThisWeek = tournaments.filter((t: any) => t.created_at >= weekStart).length;
      const uniqueSponsors = new Set(sponsors.map((s) => s.company_id));

      // Crescimento
      const newArenas30d = arenas.filter((a: any) => a.created_at >= d30).length;
      const newOrganizers30d = members.filter((m: any) => m.created_at >= d30).length;

      // Ocupação 30d (bookings confirmados/pagos)
      const occ = new Map<string, number>();
      bookings.filter((b) => b.booking_date >= d30.slice(0, 10) && (b.status === "paid" || b.status === "confirmed"))
        .forEach((b) => occ.set(b.arena_id, (occ.get(b.arena_id) ?? 0) + 1));
      const topArenaId = [...occ.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topArenaName = arenas.find((a: any) => a.id === topArenaId)?.name ?? null;

      // Crescimento receita por arena (30d vs 30-60d)
      const cur = new Map<string, number>(); const prev = new Map<string, number>();
      txs.forEach((t) => {
        const map = t.created_at >= d30 ? cur : prev;
        map.set(t.arena_id, (map.get(t.arena_id) ?? 0) + Number(t.total_amount || 0));
      });
      let topGrowingId: string | null = null; let topGrowthDelta = -Infinity;
      arenas.forEach((a: any) => {
        const c = cur.get(a.id) ?? 0; const p = prev.get(a.id) ?? 0;
        const delta = c - p;
        if (c > 0 && delta > topGrowthDelta) { topGrowthDelta = delta; topGrowingId = a.id; }
      });
      const topArenaGrowingName = arenas.find((a: any) => a.id === topGrowingId)?.name ?? null;

      // Horário de pico (todos os bookings 30d)
      const hourBuckets = new Map<number, number>();
      bookings.filter((b) => b.booking_date >= d30.slice(0, 10)).forEach((b) => {
        if (!b.start_time) return;
        const h = parseInt(String(b.start_time).slice(0, 2), 10);
        if (!isNaN(h)) hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1);
      });
      const peakHourNum = [...hourBuckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const peakHour = peakHourNum !== undefined ? `${String(peakHourNum).padStart(2, "0")}h` : null;

      // Esporte com mais inscrições absolutas 30d
      const tourModalityMap = new Map<string, string>();
      tournaments.forEach((t) => { if (t.modality) tourModalityMap.set(t.id, t.modality); });
      const sportEnroll = new Map<string, number>();
      enrollments.forEach((e) => {
        const m = tourModalityMap.get(e.tournament_id);
        if (m) sportEnroll.set(m, (sportEnroll.get(m) ?? 0) + 1);
      });
      const topSport = [...sportEnroll.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      // Esporte crescendo (% delta 30d vs 30-60d via tournaments criados como proxy)
      const sportCur = new Map<string, number>(); const sportPrev = new Map<string, number>();
      tournaments.forEach((t) => {
        const m = t.modality ?? "outros";
        const map = t.created_at >= d30 ? sportCur : sportPrev;
        map.set(m, (map.get(m) ?? 0) + 1);
      });
      let topSportGrowing: string | null = null; let bestPct = -Infinity;
      sportCur.forEach((c, k) => {
        const p = sportPrev.get(k) ?? 0;
        const pct = p === 0 ? (c > 0 ? 9999 : 0) : ((c - p) / p) * 100;
        if (c > 0 && pct > bestPct) { bestPct = pct; topSportGrowing = k; }
      });

      // Arenas paradas
      const anyActivity = new Set<string>();
      bookings.filter((b) => b.booking_date >= d30.slice(0, 10)).forEach((b) => anyActivity.add(b.arena_id));
      tournaments.filter((t) => t.created_at >= d30 && t.arena_id).forEach((t) => anyActivity.add(t.arena_id));
      const lowActivityArenas = arenas.filter((a: any) => !anyActivity.has(a.id)).length;

      // Torneio em alta — maior nº de inscrições reais 30d
      const tourEnroll = new Map<string, number>();
      enrollments.forEach((e) => tourEnroll.set(e.tournament_id, (tourEnroll.get(e.tournament_id) ?? 0) + 1));
      const topTourId = [...tourEnroll.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const trendingTournament = tournaments.find((t) => t.id === topTourId)?.name ?? null;

      // Melhor conversão
      const arenaConv = new Map<string, { paid: number; total: number }>();
      bookings.filter((b) => b.booking_date >= d30.slice(0, 10)).forEach((b) => {
        const cur2 = arenaConv.get(b.arena_id) ?? { paid: 0, total: 0 };
        cur2.total += 1;
        if (b.status === "paid" || b.status === "confirmed") cur2.paid += 1;
        arenaConv.set(b.arena_id, cur2);
      });
      const bestConvId = [...arenaConv.entries()]
        .filter(([, v]) => v.total >= 3)
        .sort((a, b) => b[1].paid / b[1].total - a[1].paid / a[1].total)[0]?.[0];
      const bestConversionArena = arenas.find((a: any) => a.id === bestConvId)?.name ?? null;

      setData({
        loading: false,
        arenasActive,
        organizersActive: members.length,
        eventsActive,
        tournamentsThisWeek,
        sponsorsActive: uniqueSponsors.size,
        topArenaName,
        topArenaGrowingName,
        peakHour,
        topSport,
        topSportGrowing,
        lowActivityArenas,
        newArenas30d,
        newOrganizers30d,
        trendingTournament,
        bestConversionArena,
      });
    })();

    return () => { cancelled = true; };
  }, [tenantId]);

  return data;
}
