import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Plus, Trash2, CreditCard, QrCode, Search, UserPlus, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dashboardPathFor } from "@/lib/dashboardPath";

interface Athlete {
  id: string;
  mode: "existing" | "manual";
  user_id?: string;
  name: string;
  email: string;
  whatsapp: string;
  modality_id?: string;
}

interface Modality {
  id: string;
  name: string;
  type: string;
  gender: string | null;
  level: string | null;
  max_entries: number | null;
}

const Payment = () => {
  const { id } = useParams();
  const { user, userRole } = useAuth();
  const backPath = dashboardPathFor(userRole);
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<any>(null);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([{
    id: crypto.randomUUID(),
    mode: "manual",
    name: "",
    email: "",
    whatsapp: "",
  }]);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [loading, setLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [enrollmentIds, setEnrollmentIds] = useState<string[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);

  // Card fields
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    cardHolder: "",
    expirationDate: "",
    securityCode: "",
    docType: "CPF",
    docNumber: "",
    installments: "1",
  });

  // Search existing athletes
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingFor, setSearchingFor] = useState<string | null>(null);

  // Payer info
  const [payerEmail, setPayerEmail] = useState(user?.email || "");
  const [payerFirstName, setPayerFirstName] = useState("");
  const [payerLastName, setPayerLastName] = useState("");
  const [payerDocType, setPayerDocType] = useState("CPF");
  const [payerDocNumber, setPayerDocNumber] = useState("");

  // MP public key & SDK
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).single();
      setTournament(t);

      // Fetch tournament modalities (categories)
      const { data: mods } = await supabase
        .from("tournament_modalities")
        .select("id, name, type, gender, level, max_entries")
        .eq("tournament_id", id!)
        .order("created_at");
      const list = (mods || []) as Modality[];
      setModalities(list);
      // Auto-select if only one modality
      if (list.length === 1) {
        setAthletes((prev) => prev.map((a) => ({ ...a, modality_id: list[0].id })));
      }

      // Fetch MP public key
      const { data: keyData } = await supabase.functions.invoke("get-mp-public-key");
      if (keyData?.public_key) {
        setMpPublicKey(keyData.public_key);
      }

      // Fetch active sponsors with signup_visibility
      const { data: sponsorData } = await supabase
        .from("tournament_sponsorships")
        .select("*, companies(id, name, logo_url), tournament_sponsor_plans!inner(signup_visibility)")
        .eq("tournament_id", id!)
        .eq("status", "active");
      const filtered = (sponsorData || []).filter(
        (s: any) => s.tournament_sponsor_plans?.signup_visibility
      );
      setSponsors(filtered);
    };
    if (id) fetch();
  }, [id]);

  useEffect(() => {
    if (user?.email) setPayerEmail(user.email);
  }, [user]);

  const searchAthletes = async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, whatsapp")
      .ilike("full_name", `%${query}%`)
      .limit(5);
    setSearchResults(data || []);
  };

  const addAthlete = () => {
    setAthletes([...athletes, {
      id: crypto.randomUUID(),
      mode: "manual",
      name: "",
      email: "",
      whatsapp: "",
    }]);
  };

  const removeAthlete = (athleteId: string) => {
    if (athletes.length <= 1) return;
    setAthletes(athletes.filter((a) => a.id !== athleteId));
  };

  const updateAthlete = (athleteId: string, field: string, value: string) => {
    setAthletes(athletes.map((a) => a.id === athleteId ? { ...a, [field]: value } : a));
  };

  const selectExistingAthlete = (athleteId: string, profile: any) => {
    setAthletes(athletes.map((a) => a.id === athleteId ? {
      ...a,
      mode: "existing",
      user_id: profile.user_id,
      name: profile.full_name,
      email: "",
      whatsapp: profile.whatsapp || "",
    } : a));
    setSearchResults([]);
    setSearchingFor(null);
  };

  const handlePayment = async () => {
    if (!user || !tournament) return;

    // Block checkout if no modalities exist on the tournament
    if (modalities.length === 0) {
      toast({
        title: "Sem categorias",
        description: "O organizador ainda não cadastrou categorias para este torneio.",
        variant: "destructive",
      });
      return;
    }

    // Validate athletes
    for (const a of athletes) {
      if (!a.name.trim()) {
        toast({ title: "Erro", description: "Preencha o nome de todos os atletas.", variant: "destructive" });
        return;
      }
      if (!a.modality_id) {
        toast({ title: "Erro", description: "Selecione a categoria de cada atleta.", variant: "destructive" });
        return;
      }
    }

    if (paymentMethod === "pix" && (!payerDocNumber || !payerEmail)) {
      toast({ title: "Erro", description: "Preencha email e CPF do pagador.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // 1. Create enrollments for each athlete
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (tournament.payment_deadline_days || 3));

      const enrollmentData = athletes.map((a) => ({
        tournament_id: id!,
        payer_id: user.id,
        user_id: a.user_id || null,
        athlete_name: a.name,
        athlete_email: a.email || null,
        athlete_whatsapp: a.whatsapp || null,
        modality_id: a.modality_id!,
        status: "pending" as const,
        expires_at: expiresAt.toISOString(),
      }));

      const { data: createdEnrollments, error: enrollError } = await supabase
        .from("enrollments")
        .insert(enrollmentData)
        .select("id");

      if (enrollError) throw enrollError;

      const ids = createdEnrollments!.map((e) => e.id);
      setEnrollmentIds(ids);

      // 2. Create payment
      const paymentBody: any = {
        tournament_id: id,
        tournament_name: tournament.name,
        entry_fee: tournament.entry_fee,
        enrollment_ids: ids,
        payer_email: payerEmail,
        payer_first_name: payerFirstName,
        payer_last_name: payerLastName,
        payer_doc_type: payerDocType,
        payer_doc_number: payerDocNumber,
        payment_method: paymentMethod,
      };

      if (paymentMethod === "credit_card") {
        // For credit card, we need to tokenize with MercadoPago.js
        // Since we can't use the SDK directly in edge functions, we'll use a simplified approach
        paymentBody.token = "card_token_placeholder"; // Will be replaced by SDK
        paymentBody.installments = parseInt(cardForm.installments);
      }

      const { data: paymentData, error: payError } = await supabase.functions.invoke("create-payment", {
        body: paymentBody,
      });

      if (payError) throw payError;

      setPaymentResult(paymentData);

      if (paymentData.status === "approved") {
        toast({ title: "Pagamento aprovado! ✅" });
      } else if (paymentData.pix_qr_code) {
        toast({ title: "QR Code PIX gerado!", description: "Escaneie ou copie o código para pagar." });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }

    setLoading(false);
  };

  if (!tournament) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  const totalAmount = Number(tournament.entry_fee) * athletes.length;

  // Payment approved screen
  if (paymentResult?.status === "approved") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-6 max-w-md">
          <CheckCircle className="h-20 w-20 text-primary mx-auto" />
          <h1 className="text-4xl font-display text-foreground">INSCRIÇÃO CONFIRMADA</h1>
          <p className="text-muted-foreground">
            Pagamento aprovado para {athletes.length} atleta{athletes.length > 1 ? "s" : ""}!
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            {athletes.map((a) => (
              <p key={a.id}>✅ {a.name}</p>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild><Link to="/feed">Ir para Feed</Link></Button>
            <Button variant="outline" asChild><Link to={backPath}>Dashboard</Link></Button>
            <Button variant="outline" asChild><Link to={`/tournaments/${id}`}>Ver Torneio</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  // PIX QR Code screen
  if (paymentResult?.pix_qr_code) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container flex h-16 items-center">
            <Link to="/" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
          </div>
        </header>
        <main className="container max-w-md py-8 text-center">
          <h1 className="text-4xl font-display text-foreground mb-6">PAGAMENTO PIX</h1>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">Escaneie o QR Code ou copie o código PIX</p>
              <div className="flex justify-center">
                {paymentResult.pix_qr_code_base64 && (
                  <img
                    src={`data:image/png;base64,${paymentResult.pix_qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-64 h-64 rounded-lg"
                  />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Código PIX copia e cola:</p>
                <div className="relative">
                  <input
                    readOnly
                    value={paymentResult.pix_copy_paste || ""}
                    className="w-full rounded-md border border-border bg-muted p-2 text-xs text-foreground"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute right-1 top-1"
                    onClick={() => {
                      navigator.clipboard.writeText(paymentResult.pix_copy_paste || "");
                      toast({ title: "Código PIX copiado!" });
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
              <div className="text-lg font-bold text-primary">
                Total: R$ {totalAmount.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {athletes.length} atleta{athletes.length > 1 ? "s" : ""} × R$ {Number(tournament.entry_fee).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Após o pagamento, a confirmação é automática.
              </p>
            </CardContent>
          </Card>
          <Button className="mt-6 w-full" variant="outline" asChild>
            <Link to={backPath}>Voltar ao Dashboard</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/tournaments/${id}`)}>
            ← Voltar
          </Button>
          <Link to={`/tournaments/${id}`} className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container max-w-2xl py-8 pb-24">
        <h1 className="mb-2 text-4xl font-display text-foreground">INSCRIÇÃO & PAGAMENTO</h1>
        <p className="text-muted-foreground mb-8">{tournament.name} — R$ {Number(tournament.entry_fee).toFixed(2)} por atleta</p>

        {/* Athletes section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-sans text-lg flex items-center justify-between">
              Atletas ({athletes.length})
              <Button size="sm" variant="outline" onClick={addAthlete}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar atleta
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {athletes.map((athlete, index) => (
              <div key={athlete.id} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">Atleta {index + 1}</span>
                  {athletes.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => removeAthlete(athlete.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {/* Toggle between search and manual */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={searchingFor === athlete.id ? "default" : "outline"}
                    onClick={() => setSearchingFor(searchingFor === athlete.id ? null : athlete.id)}
                  >
                    <Search className="h-3 w-3 mr-1" /> Buscar existente
                  </Button>
                  <Button
                    size="sm"
                    variant={athlete.mode === "manual" && searchingFor !== athlete.id ? "default" : "outline"}
                    onClick={() => {
                      setSearchingFor(null);
                      updateAthlete(athlete.id, "mode", "manual");
                      updateAthlete(athlete.id, "user_id", "");
                    }}
                  >
                    <UserPlus className="h-3 w-3 mr-1" /> Novo
                  </Button>
                </div>

                {searchingFor === athlete.id && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Buscar por nome..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        searchAthletes(e.target.value);
                      }}
                    />
                    {searchResults.length > 0 && (
                      <div className="rounded-md border border-border bg-card max-h-40 overflow-y-auto">
                        {searchResults.map((p) => (
                          <button
                            key={p.user_id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={() => selectExistingAthlete(athlete.id, p)}
                          >
                            {p.full_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {athlete.mode === "existing" && athlete.user_id ? (
                  <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                    ✅ {athlete.name} (cadastrado)
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Nome *</Label>
                      <Input
                        value={athlete.name}
                        onChange={(e) => updateAthlete(athlete.id, "name", e.target.value)}
                        placeholder="Nome completo"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={athlete.email}
                        onChange={(e) => updateAthlete(athlete.id, "email", e.target.value)}
                        placeholder="email@exemplo.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">WhatsApp</Label>
                      <Input
                        value={athlete.whatsapp}
                        onChange={(e) => updateAthlete(athlete.id, "whatsapp", e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">
                {athletes.length} atleta{athletes.length > 1 ? "s" : ""} × R$ {Number(tournament.entry_fee).toFixed(2)}
              </span>
              <span className="text-3xl font-bold text-primary">R$ {totalAmount.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-sans text-lg">Forma de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={paymentMethod === "pix" ? "default" : "outline"}
                className={`h-16 flex-col gap-1 ${paymentMethod === "pix" ? "box-glow" : ""}`}
                onClick={() => setPaymentMethod("pix")}
              >
                <QrCode className="h-5 w-5" />
                <span className="text-xs">PIX</span>
              </Button>
              <Button
                variant={paymentMethod === "credit_card" ? "default" : "outline"}
                className={`h-16 flex-col gap-1 ${paymentMethod === "credit_card" ? "box-glow" : ""}`}
                onClick={() => setPaymentMethod("credit_card")}
              >
                <CreditCard className="h-5 w-5" />
                <span className="text-xs">Cartão</span>
              </Button>
            </div>

            {/* Payer info */}
            <div className="space-y-3 pt-4 border-t border-border">
              <h4 className="text-sm font-medium text-foreground">Dados do pagador</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={payerFirstName} onChange={(e) => setPayerFirstName(e.target.value)} placeholder="Nome" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Sobrenome</Label>
                  <Input value={payerLastName} onChange={(e) => setPayerLastName(e.target.value)} placeholder="Sobrenome" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} className="mt-1" />
              </div>
              <div className="grid gap-3 grid-cols-3">
                <div>
                  <Label className="text-xs">Doc</Label>
                  <Select value={payerDocType} onValueChange={setPayerDocType}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Número do documento</Label>
                  <Input value={payerDocNumber} onChange={(e) => setPayerDocNumber(e.target.value)} placeholder="000.000.000-00" className="mt-1" />
                </div>
              </div>
            </div>

            {/* Credit card fields */}
            {paymentMethod === "credit_card" && (
              <div className="space-y-3 pt-4 border-t border-border">
                <h4 className="text-sm font-medium text-foreground">Dados do cartão</h4>
                <div>
                  <Label className="text-xs">Número do cartão</Label>
                  <Input
                    value={cardForm.cardNumber}
                    onChange={(e) => setCardForm({ ...cardForm, cardNumber: e.target.value })}
                    placeholder="0000 0000 0000 0000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nome no cartão</Label>
                  <Input
                    value={cardForm.cardHolder}
                    onChange={(e) => setCardForm({ ...cardForm, cardHolder: e.target.value })}
                    placeholder="NOME COMPLETO"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Validade</Label>
                    <Input
                      value={cardForm.expirationDate}
                      onChange={(e) => setCardForm({ ...cardForm, expirationDate: e.target.value })}
                      placeholder="MM/AA"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">CVV</Label>
                    <Input
                      value={cardForm.securityCode}
                      onChange={(e) => setCardForm({ ...cardForm, securityCode: e.target.value })}
                      placeholder="123"
                      className="mt-1"
                      type="password"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Parcelas</Label>
                  <Select value={cardForm.installments} onValueChange={(v) => setCardForm({ ...cardForm, installments: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x de R$ {(totalAmount / n).toFixed(2)} {n === 1 ? "(à vista)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sponsors block */}
        {sponsors.length > 0 && (
          <Card className="mb-6 border-primary/20">
            <CardContent className="pt-5">
              <h4 className="font-display text-sm text-foreground mb-3">🤝 PARCEIROS OFICIAIS</h4>
              <div className="flex flex-wrap gap-3">
                {sponsors.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/50 border border-border">
                    {(s as any).companies?.logo_url ? (
                      <img src={(s as any).companies.logo_url} className="h-7 w-7 rounded object-cover" />
                    ) : (
                      <Store className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-xs text-foreground">{(s as any).companies?.name}</span>
                    <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">Parceiro</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          onClick={handlePayment}
          disabled={loading}
          className="w-full h-14 text-lg font-bold box-glow"
        >
          {loading ? "Processando..." : `🟢 Pagar R$ ${totalAmount.toFixed(2)}`}
        </Button>
      </main>
    </div>
  );
};

export default Payment;
