/**
 * ORKYM Context Resolvers — read-only helpers that build rich context blocks
 * to send to ORKYM. They DO NOT decide anything; they only organize raw data.
 *
 * Each function returns a JSON-serializable object ready to be injected into
 * `payload.context` of an `invokeOrkym` call.
 */
import { supabase } from "@/integrations/supabase/client";

export async function buildArenaOperationsContext(arenaId: string) {
  const today = new Date();
  const dayStart = new Date(today); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(today); dayEnd.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const sevenDaysAhead = new Date(Date.now() + 7 * 86400000).toISOString();

  const [students, classesToday, attendance7d, billingPending, billingOverdue, occurrences, eventsBacklog] = await Promise.all([
    supabase.from("arena_students").select("id", { count: "exact", head: true }).eq("arena_id", arenaId).eq("status", "active"),
    supabase.from("arena_classes").select("id,title,start_at,capacity", { count: "exact" }).eq("arena_id", arenaId).gte("start_at", dayStart.toISOString()).lte("start_at", dayEnd.toISOString()),
    supabase.from("arena_attendance").select("status").eq("arena_id", arenaId).gte("checked_in_at", sevenDaysAgo),
    supabase.from("arena_billing_cycles").select("id,amount,due_at", { count: "exact" }).eq("arena_id", arenaId).eq("status", "pending").lte("due_at", sevenDaysAhead),
    supabase.from("arena_billing_cycles").select("id,amount,due_at", { count: "exact" }).eq("arena_id", arenaId).eq("status", "overdue"),
    supabase.from("arena_occurrences").select("id,title,severity,category", { count: "exact" }).eq("arena_id", arenaId).in("status", ["open", "in_progress"]).limit(20),
    supabase.from("arena_operational_events").select("event_type", { count: "exact", head: true }).eq("arena_id", arenaId).is("processed_at", null),
  ]);

  const presentCount = (attendance7d.data || []).filter((a: any) => a.status === "present").length;
  const absentCount = (attendance7d.data || []).filter((a: any) => a.status === "absent").length;

  return {
    arena_id: arenaId,
    snapshot_at: new Date().toISOString(),
    students: { active: students.count || 0 },
    classes: { today_count: classesToday.count || 0, today_sample: (classesToday.data || []).slice(0, 10) },
    attendance_7d: { present: presentCount, absent: absentCount },
    billing: {
      pending_7d_count: billingPending.count || 0,
      pending_7d_amount: (billingPending.data || []).reduce((s: number, b: any) => s + Number(b.amount || 0), 0),
      overdue_count: billingOverdue.count || 0,
      overdue_amount: (billingOverdue.data || []).reduce((s: number, b: any) => s + Number(b.amount || 0), 0),
    },
    occurrences: { open_count: occurrences.count || 0, sample: occurrences.data || [] },
    events_backlog: eventsBacklog.count || 0,
  };
}

export async function buildFinanceContext(tenantId: string, arenaId?: string) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  let txQuery = supabase
    .from("financial_transactions")
    .select("id,total_amount,status,source_type,paid_at,refunded_amount")
    .eq("tenant_id", tenantId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  if (arenaId) txQuery = txQuery.eq("arena_id", arenaId);

  const [txs, splitsPending, refunds] = await Promise.all([
    txQuery,
    supabase.from("transaction_splits").select("id,amount,recipient_type,status", { count: "exact" }).eq("tenant_id", tenantId).in("status", ["calculated", "pending"]).limit(50),
    supabase.from("financial_adjustments").select("id,adjustment_type,amount,created_at").eq("tenant_id", tenantId).in("adjustment_type", ["refund_full", "refund_partial"]).gte("created_at", since).limit(20),
  ]);

  const data = txs.data || [];
  const totalRevenue = data.filter((t: any) => t.status === "paid").reduce((s: number, t: any) => s + Number(t.total_amount || 0), 0);
  const totalRefunded = data.reduce((s: number, t: any) => s + Number(t.refunded_amount || 0), 0);

  return {
    tenant_id: tenantId,
    arena_id: arenaId ?? null,
    window_days: 30,
    snapshot_at: new Date().toISOString(),
    revenue_30d: totalRevenue,
    refunded_30d: totalRefunded,
    transactions_count: data.length,
    by_status: data.reduce((acc: Record<string, number>, t: any) => {
      acc[t.status] = (acc[t.status] || 0) + 1; return acc;
    }, {}),
    by_source: data.reduce((acc: Record<string, number>, t: any) => {
      acc[t.source_type] = (acc[t.source_type] || 0) + 1; return acc;
    }, {}),
    splits_pending_count: splitsPending.count || 0,
    refunds_30d: refunds.data || [],
  };
}

export async function buildTournamentsContext(tournamentId: string) {
  const [tournament, enrollments, modalities] = await Promise.all([
    supabase.from("tournaments").select("id,name,start_date,end_date,tenant_id,organizer_id,arena").eq("id", tournamentId).maybeSingle(),
    supabase.from("enrollments").select("id,status,checked_in_at", { count: "exact" }).eq("tournament_id", tournamentId),
    supabase.from("tournament_modalities").select("id,name,gender,category", { count: "exact" }).eq("tournament_id", tournamentId),
  ]);

  const enr = enrollments.data || [];
  return {
    tournament: tournament.data,
    enrollments: {
      total: enrollments.count || 0,
      paid: enr.filter((e: any) => e.status === "paid").length,
      pending: enr.filter((e: any) => e.status === "pending").length,
      checked_in: enr.filter((e: any) => e.checked_in_at).length,
    },
    modalities: { count: modalities.count || 0, sample: modalities.data || [] },
    snapshot_at: new Date().toISOString(),
  };
}

export async function buildGrowthContext(tenantId: string) {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const [ads, products, activities] = await Promise.all([
    supabase.from("ad_campaigns").select("id,name,kind,status,priority", { count: "exact" }).eq("tenant_id", tenantId).eq("status", "active").limit(20),
    supabase.from("products").select("id,name,price,featured", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("athlete_activities").select("activity_type", { count: "exact" }).eq("tenant_id", tenantId).gte("created_at", since).limit(500),
  ]);

  const acts = activities.data || [];
  const byType = acts.reduce((acc: Record<string, number>, a: any) => {
    acc[a.activity_type] = (acc[a.activity_type] || 0) + 1; return acc;
  }, {});

  return {
    tenant_id: tenantId,
    snapshot_at: new Date().toISOString(),
    ads_active: { count: ads.count || 0, sample: ads.data || [] },
    products_approved_total: products.count || 0,
    activities_14d: { total: acts.length, by_type: byType },
  };
}
