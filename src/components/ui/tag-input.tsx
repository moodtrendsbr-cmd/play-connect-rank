import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

interface TagInputProps {
  label: string;
  suggestions: string[];
  value: string[];
  onChange: (tags: string[]) => void;
}

const TagInput = ({ label, suggestions, value, onChange }: TagInputProps) => {
  const [customValue, setCustomValue] = useState("");

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (customValue.trim()) {
        addTag(customValue);
        setCustomValue("");
      }
    }
  };

  const availableSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="space-y-2">
      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1 text-sm">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Suggestion buttons */}
      {availableSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableSuggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => addTag(suggestion)}
            >
              <Plus className="h-3 w-3" />
              {suggestion}
            </Button>
          ))}
        </div>
      )}

      {/* Custom input */}
      <div className="flex gap-2">
        <Input
          placeholder={`Adicionar ${label.toLowerCase()} personalizado...`}
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (customValue.trim()) {
              addTag(customValue);
              setCustomValue("");
            }
          }}
          disabled={!customValue.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export { TagInput };
