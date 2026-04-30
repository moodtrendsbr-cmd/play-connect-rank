import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Upload, Link2, X, Loader2, ImageIcon } from "lucide-react";

export type ImageBucket =
  | "tournament-images"
  | "arena-images"
  | "company-images"
  | "post-images";

export interface ImageUploadFieldProps {
  label?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  bucket: ImageBucket;
  /** Path prefix inside the bucket. The filename + extension is appended automatically. */
  pathPrefix: string;
  /** Visual hint only — does not enforce. */
  aspect?: "16/9" | "1/1" | "3/1" | "4/3";
  previewShape?: "rectangle" | "square" | "circle";
  allowUrl?: boolean;
  allowUpload?: boolean;
  helperText?: string;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Unified image input: upload a file OR paste a URL, with preview & remove.
 * Reuses existing public Supabase Storage buckets.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  bucket,
  pathPrefix,
  aspect = "16/9",
  previewShape = "rectangle",
  allowUrl = true,
  allowUpload = true,
  helperText,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 5,
  disabled = false,
  className,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"upload" | "url">(allowUpload ? "upload" : "url");
  const [urlDraft, setUrlDraft] = useState(value ?? "");

  const handleFile = async (file: File) => {
    if (!file) return;
    if (!accept.split(",").some((t) => file.type === t.trim())) {
      toast({ title: "Formato inválido", description: "Envie JPG, PNG ou WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: `Limite de ${maxSizeMB}MB.`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const safePrefix = pathPrefix.replace(/^\/+|\/+$/g, "");
      const path = `${safePrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      setUrlDraft(data.publicUrl);
      toast({ title: "Imagem enviada" });
    } catch (e: any) {
      toast({ title: "Falha ao enviar", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const applyUrl = () => {
    const v = urlDraft.trim();
    if (!v) {
      onChange(null);
      return;
    }
    onChange(v);
    toast({ title: "Link aplicado" });
  };

  const remove = () => {
    onChange(null);
    setUrlDraft("");
  };

  const previewClass =
    previewShape === "circle"
      ? "rounded-full aspect-square w-24 h-24"
      : previewShape === "square"
      ? "rounded-lg aspect-square"
      : aspect === "3/1"
      ? "rounded-lg aspect-[3/1]"
      : aspect === "4/3"
      ? "rounded-lg aspect-[4/3]"
      : aspect === "1/1"
      ? "rounded-lg aspect-square"
      : "rounded-lg aspect-video";

  return (
    <div className={className ?? "space-y-2"}>
      {label && <Label>{label}</Label>}

      {/* Preview */}
      <div className={`relative bg-muted/40 border border-border overflow-hidden ${previewClass} ${previewShape === "circle" ? "" : "w-full max-w-md"}`}>
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }} />
            {!disabled && (
              <button
                type="button"
                onClick={remove}
                className="absolute top-1.5 right-1.5 bg-background/90 hover:bg-background border border-border rounded-md p-1 text-destructive shadow"
                aria-label="Remover imagem"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1">
            <ImageIcon className="h-6 w-6 opacity-50" />
            <span className="text-xs">Sem imagem</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      {!disabled && (allowUpload || allowUrl) && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full max-w-md">
          <TabsList className="grid w-full grid-cols-2">
            {allowUpload && (
              <TabsTrigger value="upload" className="text-xs gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Enviar imagem
              </TabsTrigger>
            )}
            {allowUrl && (
              <TabsTrigger value="url" className="text-xs gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Colar link
              </TabsTrigger>
            )}
          </TabsList>

          {allowUpload && (
            <TabsContent value="upload" className="mt-2">
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Enviando...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-1.5" /> Selecionar arquivo</>
                )}
              </Button>
            </TabsContent>
          )}

          {allowUrl && (
            <TabsContent value="url" className="mt-2">
              <div className="flex gap-2">
                <Input
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  placeholder="https://..."
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyUrl(); } }}
                />
                <Button type="button" size="sm" variant="outline" onClick={applyUrl}>Aplicar</Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}

      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}

export default ImageUploadField;
