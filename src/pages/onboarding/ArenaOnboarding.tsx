import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export default function ArenaOnboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setSlug(slugify(name)); }, [name]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) { toast.error("Preencha nome e slug"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("arenas").insert({
        owner_user_id: user.id,
        name: name.trim(),
        slug: slug.trim(),
        contact_whatsapp: whatsapp.trim() || null,
      } as any);
      if (error) throw error;
      toast.success("Arena criada!");
      navigate("/arena/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar arena");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-2">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle>Vamos configurar sua arena</CardTitle>
          <CardDescription>Preencha o básico para acessar seu painel.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da arena *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Arena Beach Club" required />
            </div>
            <div>
              <Label htmlFor="slug">Slug (URL) *</Label>
              <Input id="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="arena-beach-club" required />
            </div>
            <div>
              <Label htmlFor="wa">WhatsApp de contato</Label>
              <Input id="wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+55 11 99999-9999" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar arena
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
