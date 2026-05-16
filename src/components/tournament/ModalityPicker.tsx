import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "./EmptyState";
import { Layers } from "lucide-react";

interface Modality {
  id: string;
  name: string;
  num_groups?: number | null;
}

interface Props {
  tournamentId: string;
  emptyTitle: string;
  emptyDescription?: string;
  emptyCtaLabel?: string;
  onEmptyCta?: () => void;
  children: (modality: Modality) => React.ReactNode;
}

/**
 * Generic picker: shows category chips, lets user pick one, renders children for it.
 * Used by Grupos / Jogos / Chave / Pódio tabs in the Central.
 */
export default function ModalityPicker({
  tournamentId,
  emptyTitle,
  emptyDescription,
  emptyCtaLabel,
  onEmptyCta,
  children,
}: Props) {
  const [mods, setMods] = useState<Modality[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tournament_modalities")
        .select("id, name, num_groups")
        .eq("tournament_id", tournamentId)
        .order("created_at");
      const list = (data || []) as Modality[];
      setMods(list);
      setSelected(list[0]?.id || null);
      setLoading(false);
    };
    load();
  }, [tournamentId]);

  if (loading) return <Skeleton className="h-24 rounded-lg" />;

  if (mods.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title={emptyTitle}
        description={emptyDescription}
        ctaLabel={emptyCtaLabel}
        onCta={onEmptyCta}
      />
    );
  }

  const current = mods.find((m) => m.id === selected) || mods[0];

  return (
    <div className="space-y-4">
      {mods.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {mods.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                selected === m.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
      {children(current)}
    </div>
  );
}
