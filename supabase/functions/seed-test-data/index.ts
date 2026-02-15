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
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: string[] = [];

    // ========== 1. USERS ==========
    const users = [
      { email: "organizer1@moodplay.test", full_name: "Carlos Silva", role: "organizer" },
      { email: "organizer2@moodplay.test", full_name: "Marina Santos", role: "organizer" },
      { email: "athlete1@moodplay.test", full_name: "Lucas Oliveira", role: "athlete" },
      { email: "athlete2@moodplay.test", full_name: "Ana Costa", role: "athlete" },
      { email: "athlete3@moodplay.test", full_name: "Pedro Souza", role: "athlete" },
      { email: "admin@moodplay.test", full_name: "Admin Mood Play", role: "admin" },
    ];

    const userIds: Record<string, string> = {};

    for (const u of users) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: "Test1234!",
        email_confirm: true,
        user_metadata: { full_name: u.full_name, role: u.role },
      });
      if (error) {
        results.push(`SKIP user ${u.email}: ${error.message}`);
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existing = listData?.users?.find((x: any) => x.email === u.email);
        if (existing) userIds[u.email] = existing.id;
        continue;
      }
      userIds[u.email] = data.user.id;
      results.push(`Created user ${u.email}`);
    }

    await new Promise((r) => setTimeout(r, 2000));

    // ========== 2. PROFILES ==========
    const profileUpdates: Record<string, any> = {
      "organizer1@moodplay.test": { city: "São Paulo", state: "SP", whatsapp: "11999990001" },
      "organizer2@moodplay.test": { city: "Rio de Janeiro", state: "RJ", whatsapp: "21999990002" },
      "athlete1@moodplay.test": { city: "Curitiba", state: "PR", whatsapp: "41999990003" },
      "athlete2@moodplay.test": { city: "Belo Horizonte", state: "MG", whatsapp: "31999990004" },
      "athlete3@moodplay.test": { city: "Salvador", state: "BA", whatsapp: "71999990005" },
      "admin@moodplay.test": { city: "São Paulo", state: "SP", whatsapp: "11999990000" },
    };

    for (const [email, updates] of Object.entries(profileUpdates)) {
      const uid = userIds[email];
      if (!uid) continue;
      await supabase.from("profiles").update(updates).eq("user_id", uid);
    }

    // ========== 3. ROLES ==========
    for (const email of ["organizer1@moodplay.test", "organizer2@moodplay.test"]) {
      const uid = userIds[email];
      if (!uid) continue;
      await supabase.from("user_roles").update({ role: "organizer" }).eq("user_id", uid);
    }
    const adminUid = userIds["admin@moodplay.test"];
    if (adminUid) {
      await supabase.from("user_roles").update({ role: "admin" }).eq("user_id", adminUid);
    }
    results.push("Updated profiles and roles");

    // Helper IDs
    const org1 = userIds["organizer1@moodplay.test"];
    const org2 = userIds["organizer2@moodplay.test"];
    const ath1 = userIds["athlete1@moodplay.test"];
    const ath2 = userIds["athlete2@moodplay.test"];
    const ath3 = userIds["athlete3@moodplay.test"];

    if (!org1 || !org2 || !ath1 || !ath2 || !ath3) {
      return new Response(JSON.stringify({ error: "Missing user IDs", userIds, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // ========== 4. TOURNAMENTS ==========
    const tournaments = [
      {
        name: "Copa Mood Play 2026", organizer_id: org1, category: "masculino", type: "individual",
        max_slots: 16, entry_fee: 50, city: "São Paulo", state: "SP",
        address: "Arena Mood Play - Av. Paulista, 1000", start_date: "2026-03-15", end_date: "2026-03-17",
        is_public: true, match_enabled: true,
        rules: "Eliminatória simples. Jogos de 3 sets. Tie-break no terceiro set.",
      },
      {
        name: "Torneio Feminino de Praia", organizer_id: org2, category: "feminino", type: "duplas",
        max_slots: 8, entry_fee: 80, city: "Rio de Janeiro", state: "RJ",
        address: "Praia de Copacabana - Posto 6", start_date: "2026-04-10", end_date: "2026-04-12",
        is_public: true, match_enabled: true,
        rules: "Duplas femininas. Sets de 21 pontos. Melhor de 3.",
      },
      {
        name: "Arena Mista Inverno", organizer_id: org1, category: "misto", type: "equipes",
        max_slots: 12, entry_fee: 120, city: "Curitiba", state: "PR",
        address: "Ginásio Municipal de Curitiba", start_date: "2026-07-05", end_date: "2026-07-08",
        is_public: true, match_enabled: false,
        rules: "Equipes mistas de 4 jogadores. Fase de grupos + eliminatória.",
      },
    ];

    const tournamentIds: string[] = [];
    for (const t of tournaments) {
      const { data, error } = await supabase.from("tournaments").insert(t).select("id").single();
      if (error) {
        results.push(`ERROR tournament ${t.name}: ${error.message}`);
        continue;
      }
      tournamentIds.push(data.id);
      results.push(`Created tournament: ${t.name}`);
    }

    // ========== 5. ENROLLMENTS ==========
    const athletes = [ath1, ath2, ath3];
    const statuses = ["paid", "paid", "pending"];
    for (let ti = 0; ti < tournamentIds.length; ti++) {
      for (let ai = 0; ai < athletes.length; ai++) {
        const status = statuses[(ti + ai) % 3];
        await supabase.from("enrollments").insert({
          tournament_id: tournamentIds[ti], user_id: athletes[ai], payer_id: athletes[ai], status,
          athlete_name: users.find((u) => userIds[u.email] === athletes[ai])?.full_name,
          athlete_email: users.find((u) => userIds[u.email] === athletes[ai])?.email,
        });
      }
    }
    results.push("Created 9 enrollments");

    // ========== 6. MATCH RESULTS ==========
    if (tournamentIds[0]) {
      await supabase.from("match_results").insert([
        { tournament_id: tournamentIds[0], round: 1, match_number: 1, player1_id: ath1, player2_id: ath2, score1: 21, score2: 18, winner_id: ath1 },
        { tournament_id: tournamentIds[0], round: 1, match_number: 2, player1_id: ath3, player2_id: ath1, score1: 15, score2: 21, winner_id: ath1 },
        { tournament_id: tournamentIds[0], round: 1, match_number: 3, player1_id: ath2, player2_id: ath3, score1: 21, score2: 19, winner_id: ath2 },
        { tournament_id: tournamentIds[0], round: 2, match_number: 1, player1_id: ath1, player2_id: ath2, score1: 21, score2: 16, winner_id: ath1 },
      ]);
      results.push("Created 4 matches for Copa Mood Play");
    }
    if (tournamentIds[1]) {
      await supabase.from("match_results").insert([
        { tournament_id: tournamentIds[1], round: 1, match_number: 1, player1_id: ath2, player2_id: ath3, score1: 21, score2: 17, winner_id: ath2 },
        { tournament_id: tournamentIds[1], round: 1, match_number: 2, player1_id: ath1, player2_id: ath2, score1: 19, score2: 21, winner_id: ath2 },
      ]);
      results.push("Created 2 matches for Torneio Feminino");
    }

    // ========== 7. COMPANY PLANS ==========
    const planDefs = [
      { name: "free", display_name: "Free", monthly_price: 0, max_products: 3, sponsored_posts_per_month: 0, banner_feed_enabled: false, tournament_visibility: false, marketplace_highlight: false, commission_rate: 15, description: "Plano gratuito básico" },
      { name: "pro", display_name: "Pro", monthly_price: 99.90, max_products: 20, sponsored_posts_per_month: 5, banner_feed_enabled: true, tournament_visibility: true, marketplace_highlight: false, commission_rate: 10, description: "Para empresas em crescimento" },
      { name: "elite", display_name: "Elite", monthly_price: 249.90, max_products: null, sponsored_posts_per_month: 15, banner_feed_enabled: true, tournament_visibility: true, marketplace_highlight: true, commission_rate: 5, description: "Visibilidade máxima e menor comissão" },
    ];

    const planIds: Record<string, string> = {};
    for (const p of planDefs) {
      // Check if exists
      const { data: existing } = await supabase.from("company_plans").select("id").eq("name", p.name).maybeSingle();
      if (existing) {
        planIds[p.name] = existing.id;
        results.push(`SKIP plan ${p.name}: already exists`);
      } else {
        const { data, error } = await supabase.from("company_plans").insert(p).select("id").single();
        if (error) { results.push(`ERROR plan ${p.name}: ${error.message}`); continue; }
        planIds[p.name] = data.id;
        results.push(`Created plan: ${p.name}`);
      }
    }

    // ========== 8. COMPANIES ==========
    const companyDefs = [
      { name: "Volei Store SP", owner_user_id: org1, category: "vestuário", city: "São Paulo", state: "SP", status: "approved", plan: "pro", plan_id: planIds["pro"], billing_status: "active", description: "Loja especializada em artigos de vôlei", email: "contato@voleistore.test", phone: "11988880001", commission_rate: 10 },
      { name: "Beach Gear RJ", owner_user_id: org2, category: "acessórios", city: "Rio de Janeiro", state: "RJ", status: "approved", plan: "elite", plan_id: planIds["elite"], billing_status: "active", description: "Equipamentos premium para vôlei de praia", email: "contato@beachgear.test", phone: "21988880002", commission_rate: 5, feed_ads_enabled: true, highlight_enabled: true, tournament_visibility: true },
      { name: "Foto Esportiva", owner_user_id: org1, category: "fotografia", city: "Curitiba", state: "PR", status: "pending_approval", plan: "free", plan_id: planIds["free"], billing_status: "none", description: "Fotografia profissional de eventos esportivos", email: "contato@fotoesportiva.test", phone: "41988880003", commission_rate: 15 },
    ];

    const companyIds: Record<string, string> = {};
    for (const c of companyDefs) {
      const { data: existing } = await supabase.from("companies").select("id").eq("name", c.name).maybeSingle();
      if (existing) {
        companyIds[c.name] = existing.id;
        results.push(`SKIP company ${c.name}: already exists`);
      } else {
        const { data, error } = await supabase.from("companies").insert(c).select("id").single();
        if (error) { results.push(`ERROR company ${c.name}: ${error.message}`); continue; }
        companyIds[c.name] = data.id;
        results.push(`Created company: ${c.name}`);
      }
    }

    const voleiStoreId = companyIds["Volei Store SP"];
    const beachGearId = companyIds["Beach Gear RJ"];
    const fotoEsportivaId = companyIds["Foto Esportiva"];

    // ========== 9. SUBSCRIPTIONS ==========
    if (voleiStoreId && planIds["pro"]) {
      const { error } = await supabase.from("subscriptions").insert({
        company_id: voleiStoreId, plan_id: planIds["pro"], status: "active",
        started_at: new Date().toISOString(), next_billing_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      if (error?.message?.includes("duplicate")) results.push("SKIP subscription Volei Store: exists");
      else if (error) results.push(`ERROR subscription Volei Store: ${error.message}`);
      else results.push("Created subscription: Volei Store SP (Pro)");
    }
    if (beachGearId && planIds["elite"]) {
      const { error } = await supabase.from("subscriptions").insert({
        company_id: beachGearId, plan_id: planIds["elite"], status: "active",
        started_at: new Date().toISOString(), next_billing_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      if (error?.message?.includes("duplicate")) results.push("SKIP subscription Beach Gear: exists");
      else if (error) results.push(`ERROR subscription Beach Gear: ${error.message}`);
      else results.push("Created subscription: Beach Gear RJ (Elite)");
    }

    // ========== 10. PRODUCTS ==========
    const productDefs = [
      { company_id: voleiStoreId, name: "Camiseta Mood Play Pro", description: "Camiseta dry-fit oficial Mood Play", price: 89.90, stock: 50, status: "approved", image_urls: [] },
      { company_id: voleiStoreId, name: "Shorts Vôlei Masculino", description: "Short leve para treino e competição", price: 59.90, stock: 30, status: "approved", image_urls: [] },
      { company_id: beachGearId, name: "Bola Mikasa V200W", description: "Bola oficial de competições FIVB", price: 399.90, stock: 15, status: "approved", featured: true, image_urls: [] },
      { company_id: beachGearId, name: "Óculos de Sol Esportivo", description: "Proteção UV para vôlei de praia", price: 149.90, stock: 25, status: "approved", image_urls: [] },
      { company_id: fotoEsportivaId, name: "Pacote Fotos Torneio", description: "Cobertura fotográfica completa do seu torneio", price: 500.00, stock: 10, status: "pending", image_urls: [] },
      { company_id: fotoEsportivaId, name: "Edição de Vídeo Highlights", description: "Vídeo de melhores momentos do torneio", price: 800.00, stock: 5, status: "pending", image_urls: [] },
    ];

    const productIds: string[] = [];
    for (const p of productDefs) {
      if (!p.company_id) continue;
      const { data, error } = await supabase.from("products").insert(p).select("id").single();
      if (error) { results.push(`ERROR product ${p.name}: ${error.message}`); continue; }
      productIds.push(data.id);
      results.push(`Created product: ${p.name}`);
    }

    // ========== 11. MARKETPLACE ORDERS ==========
    // Athletes buying approved products (first 4 products are approved)
    const orderDefs = [
      { buyer_user_id: ath1, product_id: productIds[0], quantity: 2, total_amount: 179.80, company_amount: 161.82, mood_commission: 17.98, status: "paid" },
      { buyer_user_id: ath2, product_id: productIds[2], quantity: 1, total_amount: 399.90, company_amount: 379.91, mood_commission: 19.99, status: "paid" },
      { buyer_user_id: ath3, product_id: productIds[3], quantity: 1, total_amount: 149.90, company_amount: 142.41, mood_commission: 7.49, status: "pending" },
    ];
    for (const o of orderDefs) {
      if (!o.product_id) continue;
      const { error } = await supabase.from("marketplace_orders").insert(o);
      if (error) results.push(`ERROR order: ${error.message}`);
    }
    results.push("Created 3 marketplace orders");

    // ========== 12. ATHLETE SPONSORS ==========
    if (beachGearId && voleiStoreId) {
      await supabase.from("athlete_sponsors").insert([
        { company_id: beachGearId, athlete_user_id: ath1, amount: 500, start_date: "2026-01-01", end_date: "2026-12-31" },
        { company_id: voleiStoreId, athlete_user_id: ath2, amount: 300, start_date: "2026-02-01", end_date: "2026-07-31" },
      ]);
      results.push("Created 2 athlete sponsors");
    }

    // ========== 13. FINANCIAL LEDGER ==========
    const ledgerEntries = [
      { source: "tournament", amount: 450, mood_share: 45, description: "Copa Mood Play 2026 — 9 inscrições", source_id: tournamentIds[0] || null },
      { source: "tournament", amount: 640, mood_share: 64, description: "Torneio Feminino de Praia — 8 inscrições", source_id: tournamentIds[1] || null },
      { source: "subscription", amount: 99.90, mood_share: 99.90, description: "Assinatura Pro — Volei Store SP", company_id: voleiStoreId || null },
      { source: "subscription", amount: 249.90, mood_share: 249.90, description: "Assinatura Elite — Beach Gear RJ", company_id: beachGearId || null },
      { source: "marketplace", amount: 45.46, mood_share: 45.46, description: "Comissão marketplace — 3 pedidos" },
    ];
    for (const entry of ledgerEntries) {
      await supabase.from("financial_ledger").insert(entry);
    }
    results.push("Created 5 financial ledger entries");

    // ========== 14. ORGANIZER BALANCES ==========
    if (tournamentIds[0]) {
      await supabase.from("organizer_balances").insert({
        organizer_id: org1, tournament_id: tournamentIds[0], amount: 405, commission: 45, status: "pending",
      });
    }
    if (tournamentIds[1]) {
      await supabase.from("organizer_balances").insert({
        organizer_id: org2, tournament_id: tournamentIds[1], amount: 576, commission: 64, status: "pending",
      });
    }
    results.push("Created 2 organizer balances");

    // ========== 15. MATCH POOL ==========
    if (tournamentIds[0]) {
      await supabase.from("tournament_match_pool").insert([
        { tournament_id: tournamentIds[0], user_id: ath1, level: "avançado", category: "masculino", match_type: "dupla", position: "levantador", availability: "Manhã e tarde", bio: "Jogador experiente, busco parceiro para dupla", status: "looking" },
        { tournament_id: tournamentIds[0], user_id: ath2, level: "intermediário", category: "masculino", match_type: "dupla", position: "ponteiro", availability: "Qualquer horário", bio: "Procurando parceiro(a) para torneio", status: "looking" },
        { tournament_id: tournamentIds[0], user_id: ath3, level: "iniciante", category: "masculino", match_type: "dupla", position: "líbero", availability: "Tarde", bio: "Primeiro torneio, animado para jogar!", status: "looking" },
      ]);
      results.push("Created 3 match pool entries");
    }

    // ========== 16. MATCH REQUESTS ==========
    if (tournamentIds[0]) {
      await supabase.from("match_requests").insert({
        tournament_id: tournamentIds[0], from_user_id: ath1, to_user_id: ath2, status: "pending",
      });
      results.push("Created 1 match request");
    }

    // ========== 17. POSTS ==========
    const posts = [
      { author_id: ath1, content: "Treinando pesado para a Copa Mood Play! 💪🏐 Quem mais vai participar?", type: "manual" },
      { author_id: ath2, content: "Ansiosa para o Torneio Feminino de Praia! Copacabana, aí vamos nós! 🏖️", type: "manual" },
      { author_id: ath3, content: "Primeira vez participando de um torneio pela Mood Play. Bora! 🔥", type: "manual" },
      { author_id: org1, content: "Inscrições abertas para a Copa Mood Play 2026! Vagas limitadas, garanta a sua! 🏆", type: "manual", tournament_id: tournamentIds[0] },
      { author_id: org2, content: "Torneio Feminino de Praia no Rio! Duplas, venham representar! 🌊", type: "manual", tournament_id: tournamentIds[1] },
      { author_id: org1, content: "Arena Mista Inverno em Curitiba vai ser épico! Equipes mistas, inscreva-se! ❄️", type: "manual", tournament_id: tournamentIds[2] },
      { author_id: ath1, content: "Me inscrevi na Copa Mood Play 2026! Vamos com tudo! 🎯", type: "enrollment", tournament_id: tournamentIds[0] },
      { author_id: ath1, content: "Vitória na primeira rodada da Copa Mood Play! 21x18 🏆", type: "win", tournament_id: tournamentIds[0] },
      { author_id: ath2, content: "Classificada para a próxima fase do Torneio Feminino! 💪", type: "win", tournament_id: tournamentIds[1] },
    ];

    const postIds: string[] = [];
    for (const p of posts) {
      const { data } = await supabase.from("posts").insert(p).select("id").single();
      if (data) postIds.push(data.id);
    }
    results.push(`Created ${postIds.length} posts`);

    // ========== 18. LIKES & COMMENTS ==========
    const allUsers = [org1, org2, ath1, ath2, ath3];
    const likesData: any[] = [];
    for (let i = 0; i < postIds.length; i++) {
      const likers = allUsers.filter((_, idx) => (idx + i) % 3 !== 0);
      for (const userId of likers.slice(0, 3)) {
        likesData.push({ post_id: postIds[i], user_id: userId });
      }
    }
    await supabase.from("likes").insert(likesData);
    results.push(`Created ${likesData.length} likes`);

    const comments = [
      { post_id: postIds[0], author_id: ath2, content: "Bora Lucas! Nos vemos lá! 🙌" },
      { post_id: postIds[0], author_id: org1, content: "Vai ser um grande torneio! Esperamos você!" },
      { post_id: postIds[1], author_id: ath3, content: "Copa vai ser demais! Boa sorte Ana!" },
      { post_id: postIds[3], author_id: ath1, content: "Já estou inscrito! Valeu Carlos!" },
      { post_id: postIds[4], author_id: ath2, content: "Não vejo a hora! 🏖️" },
      { post_id: postIds[7], author_id: ath3, content: "Parabéns pela vitória, Lucas! 👏" },
      { post_id: postIds[7], author_id: org1, content: "Grande jogo! Continue assim!" },
      { post_id: postIds[8], author_id: ath1, content: "Mandou bem, Ana! 💪" },
    ];
    await supabase.from("comments").insert(comments);
    results.push(`Created ${comments.length} comments`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
