import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({ icon: Icon, title, description, ctaLabel, onCta }: Props) {
  return (
    <div className="text-center py-10 px-4 rounded-xl border border-dashed border-border bg-card/50">
      {Icon && (
        <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>}
      {ctaLabel && onCta && (
        <Button className="mt-4" onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
