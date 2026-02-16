import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Check, Upload, Eye, Megaphone, FileText, Flag, Gift, ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: any;
  company: any;
  onSuccess: () => void;
}

const SponsorTournamentDialog = ({ open, onOpenChange, tournament, company, onSuccess }: Props) => {
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(company?.logo_url || "");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Giveaway fields
  const [wantsGiveaway, setWantsGiveaway] = useState(false);
  const [giveaway, setGiveaway] = useState({
    item_type: "",
    quantity: 1,
    rules: "",
    needs_refrigeration: false,
    delivery_deadline: "",
    contact_name: "",
    contact_whatsapp: "",
    contact_email: "",
    pickup_address: "",
    delivery_address: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedPlan(null);
      setLogoUrl(company?.logo_url || "");
      setLink("");
      setMessage("");
      setWantsGiveaway(false);
      setGiveaway({ item_type: "", quantity: 1, rules: "", needs_refrigeration: false, delivery_deadline: "", contact_name: "", contact_whatsapp: "", contact_email: "", pickup_address: "", delivery_address: "", notes: "" });

      const fetchPlans = async () => {
        const { data } = await supabase
          .from("tournament_sponsor_plans")
          .select("*")
          .eq("active", true)
          .order("price", { ascending: true });
        setPlans(data || []);
      };
      fetchPlans();
    }
  }, [open, company]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `sponsorship-logos/${company.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("company-images").upload(path, file);
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("company-images").getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);

    const { data: sp, error } = await supabase.from("tournament_sponsorships").insert({
      tournament_id: tournament.id,
      company_id: company.id,
      plan_id: selectedPlan,
      logo_url: logoUrl || null,
      link: link || null,
      message: message || null,
      status: "pending",
    } as any).select().single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Insert giveaway if enabled
    if (wantsGiveaway && giveaway.item_type && sp) {
      await supabase.from("sponsorship_giveaways").insert({
        sponsorship_id: sp.id,
        item_type: giveaway.item_type,
        quantity: giveaway.quantity || 1,
        rules: giveaway.rules || null,
        needs_refrigeration: giveaway.needs_refrigeration,
        delivery_deadline: giveaway.delivery_deadline || null,
        contact_name: giveaway.contact_name || null,
        contact_whatsapp: giveaway.contact_whatsapp || null,
        contact_email: giveaway.contact_email || null,
        pickup_address: giveaway.pickup_address || null,
        delivery_address: giveaway.delivery_address || null,
        notes: giveaway.notes || null,
      } as any);
    }

    onSuccess();
    setSubmitting(false);
  };

  const planFeatures = (plan: any) => {
    const features = [];
    if (plan.tournament_visibility) features.push({ icon: Eye, label: "Página do torneio" });
    if (plan.signup_visibility) features.push({ icon: FileText, label: "Tela de inscrição" });
    if (plan.feed_visibility) features.push({ icon: Megaphone, label: "Feed local" });
    if (plan.physical_banner_allowed) features.push({ icon: Flag, label: "Banner físico" });
    return features;
  };

  const stepTitles = ["Pacote", "Identidade", "Brindes", "Confirmar"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">PATROCINAR TORNEIO</DialogTitle>
          <p className="text-sm text-muted-foreground">{tournament.name}</p>
          {/* Step indicator */}
          <div className="flex items-center gap-1 pt-2">
            {stepTitles.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${step > i ? "bg-primary" : step === i + 1 ? "bg-primary animate-pulse" : "bg-muted"}`} />
                <span className={`text-[10px] ${step === i + 1 ? "text-primary" : "text-muted-foreground"}`}>{t}</span>
                {i < 3 && <div className="w-4 h-px bg-border" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Step 1: Plan selection */}
        {step === 1 && (
          <div className="space-y-3">
            <Label className="text-sm font-bold">Escolha seu pacote</Label>
            {plans.map((plan) => {
              const features = planFeatures(plan);
              const isSelected = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    isSelected ? "border-primary bg-primary/5 shadow-[0_0_20px_hsl(110_100%_55%/0.15)]" : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg text-foreground">{plan.display_name}</span>
                      {plan.name === "elite" && <Badge className="bg-secondary text-secondary-foreground text-xs">Popular</Badge>}
                    </div>
                    <span className="font-bold text-primary text-lg">R$ {Number(plan.price).toFixed(0)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{plan.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {features.map((f, i) => (
                      <span key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <f.icon className="h-3 w-3 text-primary" /> {f.label}
                      </span>
                    ))}
                  </div>
                  {isSelected && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                      <Check className="h-3.5 w-3.5" /> Selecionado
                    </div>
                  )}
                </button>
              );
            })}
            <Button className="w-full h-11" disabled={!selectedPlan} onClick={() => setStep(2)}>
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Identity */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold">Logo da empresa</Label>
              {logoUrl && (
                <div className="flex justify-center">
                  <img src={logoUrl} alt="Logo" className="h-20 w-20 rounded-xl object-cover border border-border" />
                </div>
              )}
              <div className="relative">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Button variant="outline" className="w-full" disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Enviando..." : "Alterar logo"}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Link da empresa</Label>
              <Input placeholder="https://suaempresa.com" value={link} onChange={(e) => setLink(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Mensagem curta (opcional)</Label>
              <Textarea placeholder="Ex: Parceiro oficial do esporte local!" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Giveaways */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">Quero oferecer brindes</span>
              </div>
              <Switch checked={wantsGiveaway} onCheckedChange={setWantsGiveaway} />
            </div>

            {wantsGiveaway && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de brinde *</Label>
                  <Input placeholder="Ex: Camiseta, Garrafinha, Cupom" value={giveaway.item_type} onChange={(e) => setGiveaway({ ...giveaway, item_type: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade</Label>
                    <Input type="number" min={1} value={giveaway.quantity} onChange={(e) => setGiveaway({ ...giveaway, quantity: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prazo de entrega</Label>
                    <Input type="date" value={giveaway.delivery_deadline} onChange={(e) => setGiveaway({ ...giveaway, delivery_deadline: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Regras de distribuição</Label>
                  <Input placeholder="Ex: Para os 50 primeiros inscritos" value={giveaway.rules} onChange={(e) => setGiveaway({ ...giveaway, rules: e.target.value })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Necessita refrigeração?</Label>
                  <Switch checked={giveaway.needs_refrigeration} onCheckedChange={(v) => setGiveaway({ ...giveaway, needs_refrigeration: v })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nome do responsável</Label>
                  <Input value={giveaway.contact_name} onChange={(e) => setGiveaway({ ...giveaway, contact_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">WhatsApp</Label>
                    <Input value={giveaway.contact_whatsapp} onChange={(e) => setGiveaway({ ...giveaway, contact_whatsapp: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input value={giveaway.contact_email} onChange={(e) => setGiveaway({ ...giveaway, contact_email: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Endereço de retirada</Label>
                  <Input placeholder="Onde buscar os brindes" value={giveaway.pickup_address} onChange={(e) => setGiveaway({ ...giveaway, pickup_address: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Endereço de entrega</Label>
                  <Input placeholder="Onde entregar no evento" value={giveaway.delivery_address} onChange={(e) => setGiveaway({ ...giveaway, delivery_address: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observações logísticas</Label>
                  <Textarea placeholder="Informações adicionais..." value={giveaway.notes} onChange={(e) => setGiveaway({ ...giveaway, notes: e.target.value })} rows={2} />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button className="flex-1" onClick={() => setStep(4)}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <h3 className="font-display text-lg text-foreground">RESUMO DO PATROCÍNIO</h3>
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">Torneio: <span className="text-foreground">{tournament.name}</span></p>
                <p className="text-muted-foreground">Pacote: <span className="text-foreground">{plans.find(p => p.id === selectedPlan)?.display_name}</span></p>
                <p className="text-muted-foreground">Valor: <span className="text-primary font-bold">R$ {Number(plans.find(p => p.id === selectedPlan)?.price || 0).toFixed(0)}</span></p>
                {logoUrl && <p className="text-muted-foreground">Logo: <Check className="h-3.5 w-3.5 inline text-primary" /></p>}
                {link && <p className="text-muted-foreground">Link: <span className="text-foreground">{link}</span></p>}
                {wantsGiveaway && giveaway.item_type && (
                  <p className="text-muted-foreground">Brinde: <span className="text-foreground">{giveaway.item_type} (x{giveaway.quantity})</span></p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button className="flex-1 box-glow font-bold" disabled={submitting} onClick={handleSubmit}>
                {submitting ? "Enviando..." : "Confirmar patrocínio"}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Após confirmação, a ativação será feita pelo administrador.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SponsorTournamentDialog;
