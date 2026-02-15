import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

interface ProfileSuggestion {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const MentionInput = ({ value, onChange, placeholder, className, multiline, onKeyDown }: MentionInputProps) => {
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const searchProfiles = useCallback(async (query: string) => {
    if (query.length < 1) { setSuggestions([]); setShowDropdown(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .ilike("full_name", `%${query}%`)
      .limit(6);
    setSuggestions(data || []);
    setShowDropdown((data || []).length > 0);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(val);
    setCursorPos(pos);

    // Check if we're in a mention context
    const textBeforeCursor = val.slice(0, pos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const q = mentionMatch[1];
      setMentionQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchProfiles(q), 300);
    } else {
      setShowDropdown(false);
      setMentionQuery("");
    }
  };

  const selectSuggestion = (profile: ProfileSuggestion) => {
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (!mentionMatch) return;

    const start = cursorPos - mentionMatch[0].length;
    const newValue = value.slice(0, start) + `@${profile.full_name} ` + value.slice(cursorPos);
    onChange(newValue);
    setShowDropdown(false);
    setMentionQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const commonProps = {
    ref: inputRef as any,
    value,
    onChange: handleChange,
    placeholder,
    className,
    onKeyDown,
  };

  return (
    <div className="relative">
      {multiline ? (
        <textarea {...commonProps} ref={inputRef as React.RefObject<HTMLTextAreaElement>} />
      ) : (
        <input type="text" {...commonProps} ref={inputRef as React.RefObject<HTMLInputElement>} />
      )}
      {showDropdown && (
        <div
          className="absolute left-0 right-0 z-50 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          style={{ background: "#0B0F12", border: "1px solid rgba(43,255,136,0.2)", bottom: multiline ? undefined : "100%", top: multiline ? "100%" : undefined }}
        >
          {suggestions.map((s) => (
            <button
              key={s.user_id}
              onClick={() => selectSuggestion(s)}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/5 transition-colors text-left"
            >
              {s.avatar_url ? (
                <img src={s.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "#2BFF88" }}>
                  {getInitials(s.full_name)}
                </div>
              )}
              <span className="text-sm text-white">{s.full_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
