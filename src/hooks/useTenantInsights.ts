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
  topArenaName: string | null;
  peakHour: string | null;
  topSport: string | null;
  lowActivityArenas: number;
  newArenas30d: number;
  newOrganizers30d: number;
  // Inteligência
  trendingTournament: string | null;
  bestConversionArena: string | null;
}

const empty: TenantInsights = {
  loading: true,
  arenasActive: 0, organizersActive: 0, eventsActive: 0, tournamentsThisWeek: 0, sponsorsActive: 0,
  topArenaName: null, peakHour: null, topSport: null, lowActivityArenas: 0,
  newArenas30d: 0, newOrganizers30d: 0,
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
      const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
      const today = now.toISOString().slice(0, 10);

      const [arenasRes, membersRes, tournamentsRes, sponsorsRes, bookingsRes] = await Promise.all([
        supabase.from("arenas")
          .select("id, name, is_active, created_at")
          .eq("tenant_id", tenantId),
        supabase.from("tenant_memberships")
          .select("user_id, created_at")
          .eq("tenant_id", tenantId),
        supabase.from("tournaments")
          .select("id, name, modality, start_date, end_date, arena_id, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("sponsor_arena_links" as any)
          .select("id, company_id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true),
        supabase.from("bookings")
          .select("id, arena_id, start_time, status, booking_date")
          .eq("tenant_id", tenantId)
          .gte("booking_date", d30.slice(0, 10))
          .limit(2000),
      ]);

      if (cancelled) return;

      const arenas = arenasRes.data ?? [];
      const members = membersRes.data ?? [];
      const tournaments = (tournamentsRes.data ?? []) as any[];
      const sponsors = (sponsorsRes.data ?? []) as any[];
      const bookings = (bookingsRes.data ?? []) as any[];

      // Rede
      const arenasActive = arenas.filter((a: any) => a.is_active).length;
      const eventsActive = tournaments.filter((t: any) => t.end_date >= today).length;
      const tournamentsThisWeek = tournaments.filter((t: any) => t.created_at >= weekStart).length;

      const uniqueSponsors = new Set(sponsors.map((s) => s.company_id));

      // Crescimento
      const newArenas30d = arenas.filter((a: any) => a.created_at >= d30).length;
      const newOrganizers30d = members.filter((m: any) => m.created_at >= d30).length;

      // Arena com mais atividade (bookings + torneios)
      const arenaActivity = new Map<string, number>();
      bookings.forEach((b) => arenaActivity.set(b.arena_id, (arenaActivity.get(b.arena_id) ?? 0) + 1));
      tournaments.forEach((t) => t.arena_id && arenaActivity.set(t.arena_id, (arenaActivity.get(t.arena_id) ?? 0) + 2));
      const topArenaId = [...arenaActivity.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topArenaName = arenas.find((a: any) => a.id === topArenaId)?.name ?? null;

      // Horário de pico
      const hourBuckets = new Map<number, number>();
      bookings.forEach((b) => {
        if (!b.start_time) return;
        const h = parseInt(String(b.start_time).slice(0, 2), 10);
        if (!isNaN(h)) hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1);
      });
      const peakHourNum = [...hourBuckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const peakHour = peakHourNum !== undefined ? `${String(peakHourNum).padStart(2, "0")}h` : null;

      // Esporte mais praticado
      const sportBuckets = new Map<string, number>();
      tournaments.forEach((t) => {
        const m = t.modality ?? "outros";
        sportBuckets.set(m, (sportBuckets.get(m) ?? 0) + 1);
      });
      const topSport = [...sportBuckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      // Arenas com baixa atividade (sem bookings + sem torneios 30d)
      const lowActivityArenas = arenas.filter((a: any) => !arenaActivity.has(a.id)).length;

      // Torneio em alta (mais recente com mais inscrições — usar created_at recente como proxy)
      const trendingTournament = tournaments[0]?.name ?? null;

      // Melhor conversão (arena com maior % bookings pagos)
      const arenaConv = new Map<string, { paid: number; total: number }>();
      bookings.forEach((b) => {
        const cur = arenaConv.get(b.arena_id) ?? { paid: 0, total: 0 };
        cur.total += 1;
        if (b.status === "paid" || b.status === "confirmed") cur.paid += 1;
        arenaConv.set(b.arena_id, cur);
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
        peakHour,
        topSport,
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
