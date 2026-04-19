import { useState, type KeyboardEvent } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AiPromptBarProps {
  placeholder: string;
  presets?: string[];
  isPending: boolean;
  onSubmit: (instruction: string) => void;
  helperText?: string;
  disabled?: boolean;
}

export function AiPromptBar({
  placeholder,
  presets,
  isPending,
  onSubmit,
  helperText,
  disabled,
}: AiPromptBarProps) {
  const [instruction, setInstruction] = useState("");

  const submit = () => {
    const trimmed = instruction.trim();
    if (!trimmed || isPending || disabled) return;
    onSubmit(trimmed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const disabledOrPending = disabled || isPending;

  return (
    <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950/30 dark:via-pink-950/20 dark:to-orange-950/20 border border-purple-200/70 dark:border-purple-900/40 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-purple-900 dark:text-purple-200">
        <Sparkles className="h-4 w-4 text-purple-600" />
        Ask AI
      </div>
      <div className="flex gap-2">
        <Input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabledOrPending}
          className="bg-background/80 border-purple-200/60 dark:border-purple-900/40 focus-visible:ring-purple-400"
        />
        <Button
          type="button"
          onClick={submit}
          disabled={!instruction.trim() || disabledOrPending}
          className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Working…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Apply
            </>
          )}
        </Button>
      </div>
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setInstruction(preset)}
              disabled={disabledOrPending}
              className="text-xs px-2.5 py-1 rounded-full bg-white/80 dark:bg-background/60 border border-purple-200/70 dark:border-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {preset}
            </button>
          ))}
        </div>
      )}
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
