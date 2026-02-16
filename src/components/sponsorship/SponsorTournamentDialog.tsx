import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check, Upload, Eye, Megaphone, FileText, Flag } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: any;
  company: any;
  onSuccess: () => void;
}

const SponsorTournamentDialog = ({ open, onOpenChange, tournament, company, onSuccess }: Props) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(company?.logo_url || "");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from("tournament_sponsor_plans")
        .select("*")
        .eq("active", true)
        .order("price", { ascending: true });
      setPlans(data || []);
    };
    if (open) fetchPlans();
  }, [open]);

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
    if (!selectedPlan) {
      toast({ title: "Selecione um pacote", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("tournament_sponsorships").insert({
      tournament_id: tournament.id,
      company_id: company.id,
      plan_id: selectedPlan,
      logo_url: logoUrl || null,
      link: link || null,
      message: message || null,
      status: "pending",
    } as any);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      onSuccess();
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">PATROCINAR TORNEIO</DialogTitle>
          <p className="text-sm text-muted-foreground">{tournament.name}</p>
        </DialogHeader>

        {/* Plan selection */}
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
                  isSelected
                    ? "border-primary bg-primary/5 shadow-[0_0_20px_hsl(110_100%_55%/0.15)]"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-foreground">{plan.display_name}</span>
                    {plan.name === "elite" && (
                      <Badge className="bg-secondary text-secondary-foreground text-xs">Popular</Badge>
                    )}
                  </div>
                  <span className="font-bold text-primary text-lg">
                    R$ {Number(plan.price).toFixed(0)}
                  </span>
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
        </div>

        {/* Logo upload */}
        <div className="space-y-2">
          <Label className="text-sm font-bold">Logo da empresa</Label>
          {logoUrl && (
            <div className="flex justify-center">
              <img src={logoUrl} alt="Logo" className="h-20 w-20 rounded-xl object-cover border border-border" />
            </div>
          )}
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Button variant="outline" className="w-full" disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Enviando..." : "Alterar logo"}
            </Button>
          </div>
        </div>

        {/* Link */}
        <div className="space-y-1">
          <Label className="text-sm">Link da empresa</Label>
          <Input
            placeholder="https://suaempresa.com"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>

        {/* Message */}
        <div className="space-y-1">
          <Label className="text-sm">Mensagem curta (opcional)</Label>
          <Textarea
            placeholder="Ex: Parceiro oficial do esporte local!"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
          />
        </div>

        <Button
          className="w-full h-12 font-bold box-glow"
          disabled={!selectedPlan || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Enviando..." : "Confirmar patrocínio"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Após confirmação, a ativação será feita pelo administrador.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default SponsorTournamentDialog;
