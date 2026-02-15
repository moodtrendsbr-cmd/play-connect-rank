import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get companies with active subscriptions and plans that allow sponsored posts
    const { data: companies, error: compError } = await supabase
      .from("companies")
      .select("id, name, city, plan_id, billing_status")
      .eq("status", "approved")
      .eq("billing_status", "active");

    if (compError) throw compError;
    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ message: "No eligible companies", generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plans
    const planIds = [...new Set(companies.map((c) => c.plan_id).filter(Boolean))];
    if (planIds.length === 0) {
      return new Response(JSON.stringify({ message: "No plans assigned", generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plans } = await supabase
      .from("company_plans")
      .select("*")
      .in("id", planIds);

    const planMap: Record<string, any> = {};
    (plans || []).forEach((p) => { planMap[p.id] = p; });

    // Current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Count existing sponsored posts this month per company
    const { data: existingPosts } = await supabase
      .from("sponsored_posts")
      .select("id, company_id")
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd);

    const countMap: Record<string, number> = {};
    (existingPosts || []).forEach((p) => {
      countMap[p.company_id] = (countMap[p.company_id] || 0) + 1;
    });

    let generated = 0;
    const toInsert: any[] = [];

    for (const company of companies) {
      if (!company.plan_id) continue;
      const plan = planMap[company.plan_id];
      if (!plan || plan.sponsored_posts_per_month <= 0) continue;

      const existing = countMap[company.id] || 0;
      if (existing >= plan.sponsored_posts_per_month) continue;

      const remaining = plan.sponsored_posts_per_month - existing;
      for (let i = 0; i < remaining; i++) {
        toInsert.push({
          company_id: company.id,
          title: `${company.name} — Parceiro Mood Play em ${company.city || "sua cidade"}`,
          content: `Confira as ofertas de ${company.name} para atletas de ${company.city || "sua região"}!`,
          city: company.city || null,
          active_from: now.toISOString(),
          active_to: monthEnd,
          active: false, // awaiting admin approval
        });
        generated++;
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("sponsored_posts")
        .insert(toInsert);
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ message: "Ads generated", generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
