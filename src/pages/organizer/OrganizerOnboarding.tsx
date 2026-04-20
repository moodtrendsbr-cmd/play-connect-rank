import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const OrganizerOnboarding = () => {
  const { user, loading } = useAuth();
  const { refresh, memberships } = useTenant();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSlug(name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
  }, [name]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  // If user is already owner/admin of any tenant other than the default, redirect to settings
  const userOwnedTenants = memberships.filter(
    (m) => (m.role === "owner" || m.role === "admin") && m.tenant_id !== "00000000-0000-0000-0000-000000000001"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error("Preencha nome e slug");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("create_organizer_tenant", {
        _name: name.trim(),
        _slug: slug.trim(),
        _display_name: displayName.trim() || null,
      });
      if (error) throw error;
      toast.success("Organizador criado!");
      await refresh();
      navigate("/organizer/settings");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar organizador");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Criar Organizador</CardTitle>
          <CardDescription>
            Configure seu espaço para gerenciar arenas, torneios e operação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userOwnedTenants.length > 0 && (
            <div className="mb-4 p-3 rounded-md bg-muted text-sm text-muted-foreground">
              Você já possui {userOwnedTenants.length} organizador(es). Você pode criar outro abaixo.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do organizador *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Liga Beach Tennis SP"
                required
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug (URL) *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="liga-beach-tennis-sp"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Apenas letras, números e hífens</p>
            </div>
            <div>
              <Label htmlFor="display">Nome de exibição (opcional)</Label>
              <Input
                id="display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Mesmo do nome se vazio"
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar organizador
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizerOnboarding;
