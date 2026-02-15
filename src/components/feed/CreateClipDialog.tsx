import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Upload } from "lucide-react";

interface CreateClipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const CreateClipDialog = ({ open, onOpenChange, onCreated }: CreateClipDialogProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!user || !file) return;
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `clips/${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("post-images").upload(path, file);
    if (upErr) { toast({ title: "Erro no upload", variant: "destructive" }); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);

    const { error } = await supabase.from("clips").insert({
      author_id: user.id,
      media_url: urlData.publicUrl,
      caption: caption || null,
    } as any);

    if (error) { toast({ title: "Erro ao criar clip", variant: "destructive" }); setUploading(false); return; }

    toast({ title: "Clip publicado!" });
    setFile(null);
    setCaption("");
    setUploading(false);
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: "#0B0F12", border: "1px solid rgba(43,255,136,0.15)" }}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2"><Video className="h-5 w-5" style={{ color: "#2BFF88" }} /> Novo Clip</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:border-[#2BFF88]/40"
            style={{ borderColor: file ? "#2BFF88" : "rgba(43,255,136,0.2)", background: "rgba(43,255,136,0.05)" }}
          >
            {file ? (
              <span className="text-sm text-white">{file.name}</span>
            ) : (
              <>
                <Upload className="h-8 w-8" style={{ color: "#2BFF88" }} />
                <span className="text-sm" style={{ color: "#9CA3AF" }}>Selecionar vídeo (máx 60s)</span>
              </>
            )}
          </button>

          <div>
            <Label style={{ color: "#9CA3AF" }}>Legenda (opcional)</Label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1" placeholder="Escreva algo..." maxLength={200} />
          </div>

          <Button onClick={handleSubmit} disabled={!file || uploading} className="w-full" style={{ background: "#2BFF88", color: "#050708" }}>
            {uploading ? "Publicando..." : "Publicar Clip"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateClipDialog;
