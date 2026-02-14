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

    // 1. Create users
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
        // Try to find existing user
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existing = listData?.users?.find((x: any) => x.email === u.email);
        if (existing) userIds[u.email] = existing.id;
        continue;
      }
      userIds[u.email] = data.user.id;
      results.push(`Created user ${u.email}`);
    }

    // Wait for triggers to finish
    await new Promise((r) => setTimeout(r, 2000));

    // 2. Update profiles with city/state/whatsapp
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

    // 3. Fix roles for organizers and admin (trigger sets default based on metadata, but let's ensure)
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

    // 4. Create tournaments
    const tournaments = [
      {
        name: "Copa Mood Play 2026",
        organizer_id: org1,
        category: "masculino",
        type: "individual",
        max_slots: 16,
        entry_fee: 50,
        city: "São Paulo",
        state: "SP",
        address: "Arena Mood Play - Av. Paulista, 1000",
        start_date: "2026-03-15",
        end_date: "2026-03-17",
        is_public: true,
        rules: "Eliminatória simples. Jogos de 3 sets. Tie-break no terceiro set.",
      },
      {
        name: "Torneio Feminino de Praia",
        organizer_id: org2,
        category: "feminino",
        type: "duplas",
        max_slots: 8,
        entry_fee: 80,
        city: "Rio de Janeiro",
        state: "RJ",
        address: "Praia de Copacabana - Posto 6",
        start_date: "2026-04-10",
        end_date: "2026-04-12",
        is_public: true,
        rules: "Duplas femininas. Sets de 21 pontos. Melhor de 3.",
      },
      {
        name: "Arena Mista Inverno",
        organizer_id: org1,
        category: "misto",
        type: "equipes",
        max_slots: 12,
        entry_fee: 120,
        city: "Curitiba",
        state: "PR",
        address: "Ginásio Municipal de Curitiba",
        start_date: "2026-07-05",
        end_date: "2026-07-08",
        is_public: true,
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

    // 5. Create enrollments
    const athletes = [ath1, ath2, ath3];
    const statuses = ["paid", "paid", "pending"];
    for (let ti = 0; ti < tournamentIds.length; ti++) {
      for (let ai = 0; ai < athletes.length; ai++) {
        const status = statuses[(ti + ai) % 3];
        await supabase.from("enrollments").insert({
          tournament_id: tournamentIds[ti],
          user_id: athletes[ai],
          payer_id: athletes[ai],
          status,
          athlete_name: users.find((u) => userIds[u.email] === athletes[ai])?.full_name,
          athlete_email: users.find((u) => userIds[u.email] === athletes[ai])?.email,
        });
      }
    }
    results.push("Created 9 enrollments");

    // 6. Create match_results for Copa Mood Play (tournament 0)
    if (tournamentIds[0]) {
      const matches = [
        { tournament_id: tournamentIds[0], round: 1, match_number: 1, player1_id: ath1, player2_id: ath2, score1: 21, score2: 18, winner_id: ath1 },
        { tournament_id: tournamentIds[0], round: 1, match_number: 2, player1_id: ath3, player2_id: ath1, score1: 15, score2: 21, winner_id: ath1 },
        { tournament_id: tournamentIds[0], round: 1, match_number: 3, player1_id: ath2, player2_id: ath3, score1: 21, score2: 19, winner_id: ath2 },
        { tournament_id: tournamentIds[0], round: 2, match_number: 1, player1_id: ath1, player2_id: ath2, score1: 21, score2: 16, winner_id: ath1 },
      ];
      await supabase.from("match_results").insert(matches);
      results.push("Created 4 matches for Copa Mood Play");
    }

    // Match results for Torneio Feminino (tournament 1)
    if (tournamentIds[1]) {
      const matches = [
        { tournament_id: tournamentIds[1], round: 1, match_number: 1, player1_id: ath2, player2_id: ath3, score1: 21, score2: 17, winner_id: ath2 },
        { tournament_id: tournamentIds[1], round: 1, match_number: 2, player1_id: ath1, player2_id: ath2, score1: 19, score2: 21, winner_id: ath2 },
      ];
      await supabase.from("match_results").insert(matches);
      results.push("Created 2 matches for Torneio Feminino");
    }

    // 7. Create posts
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

    // 8. Create likes
    const allUsers = [org1, org2, ath1, ath2, ath3];
    const likesData: any[] = [];
    for (let i = 0; i < postIds.length; i++) {
      // Each post gets 2-3 random likes
      const likers = allUsers.filter((_, idx) => (idx + i) % 3 !== 0);
      for (const userId of likers.slice(0, 3)) {
        likesData.push({ post_id: postIds[i], user_id: userId });
      }
    }
    await supabase.from("likes").insert(likesData);
    results.push(`Created ${likesData.length} likes`);

    // 9. Create comments
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
