import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Sparkles, Crown } from "lucide-react";

interface Props {
  entityType: "tournament" | "product" | "company" | "arena" | "sponsored_post";
  entityId: string;
  size?: "sm" | "md";
}

const TIER_META: Record<string, { icon: any; color: string; label: string }> = {
  basic:     { icon: Star,     color: "#2BFF88", label: "Destaque" },
  premium:   { icon: Sparkles, color: "#F5C842", label: "Premium" },
  spotlight: { icon: Crown,    color: "#FF8A2B", label: "Spotlight" },
};

/**
 * Reads featured_active_v to check if entity is currently featured.
 * Renders a pill badge or null. Lightweight — runs one query per render.
 * For lists, prefer the higher-level useFeaturedMap hook.
 */
const FeaturedBadge = ({ entityType, entityId, size = "sm" }: Props) => {
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("featured_active_v")
        .select("tier")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("tier", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) setTier((data as any)?.tier || null);
    })();
    return () => { mounted = false; };
  }, [entityType, entityId]);

  if (!tier) return null;
  const meta = TIER_META[tier] || TIER_META.basic;
  const Icon = meta.icon;
  const sizeCls = size === "sm" ? "text-[10px] px-1.5 py-0.5 gap-1" : "text-xs px-2 py-1 gap-1.5";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeCls}`}
      style={{ background: `${meta.color}1f`, color: meta.color, border: `1px solid ${meta.color}66` }}
    >
      <Icon className={iconSize} />
      {meta.label}
    </span>
  );
};

export default FeaturedBadge;
