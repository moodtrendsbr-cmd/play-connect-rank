import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onCreated: () => void;
}

const CreatePostDialog = ({ open, onOpenChange, userId, onCreated }: CreatePostDialogProps) => {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((f) => {
      const reader = new FileReader();
      reader.onloadend = () => setPreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeImage = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const extractAndSaveHashtags = async (postId: string, text: string) => {
    const matches = text.match(/#(\w+)/g);
    if (!matches) return;

    const uniqueTags = [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
    for (const tag of uniqueTags) {
      // Upsert hashtag
      const { data: existing } = await supabase.from("hashtags").select("id").eq("tag", tag).maybeSingle();
      let hashtagId: string;
      if (existing) {
        hashtagId = existing.id;
      } else {
        const { data: inserted } = await supabase.from("hashtags").insert({ tag }).select("id").single();
        if (!inserted) continue;
        hashtagId = inserted.id;
      }
      // Link to post
      await supabase.from("post_hashtags").insert({ post_id: postId, hashtag_id: hashtagId });
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && files.length === 0) return;
    setLoading(true);

    try {
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({ author_id: userId, content: content.trim() || "", type: "user" })
        .select("id")
        .single();

      if (postError) throw postError;

      // Extract hashtags
      await extractAndSaveHashtags(post.id, content);

      // Upload images
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const path = `${userId}/${post.id}_${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("post-images").upload(path, file);
        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
        await supabase.from("post_media").insert({ post_id: post.id, media_url: urlData.publicUrl, order_index: i });
      }

      setContent("");
      setFiles([]);
      setPreviews([]);
      onOpenChange(false);
      onCreated();
      toast({ title: "Post publicado! 🎉" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-0" style={{ background: "#0B0F12", color: "white" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl" style={{ color: "#2BFF88" }}>Novo Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="O que está acontecendo? Use #hashtags"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] bg-transparent border-[#9CA3AF]/20 text-white placeholder:text-[#9CA3AF] resize-none"
          />
          {previews.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {previews.map((p, i) => (
                <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 rounded-full p-0.5" style={{ background: "rgba(0,0,0,0.7)" }}>
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
            <button onClick={() => inputRef.current?.click()} className="flex items-center gap-2 text-sm" style={{ color: "#2BFF88" }}>
              <ImagePlus className="h-5 w-5" /> Adicionar imagens
            </button>
            <Button onClick={handleSubmit} disabled={loading || (!content.trim() && files.length === 0)} className="font-semibold" style={{ background: "#2BFF88", color: "#050708" }}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostDialog;
