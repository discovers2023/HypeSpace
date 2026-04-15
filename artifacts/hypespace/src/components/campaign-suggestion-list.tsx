import { useState } from "react";
import { Sparkles, Check, Wand2, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  applySuggestionToHtml,
  getSuggestionMeta,
  type SuggestionAction,
} from "@/lib/campaign-suggestions";
import { useToast } from "@/hooks/use-toast";

interface Props {
  suggestions: string[];
  html: string;
  onApply: (newHtml: string) => void;
  compact?: boolean;
}

interface SuggestionState {
  applied: boolean;
  pending: boolean;
  inputValue: string;
  showInput: boolean;
}

export function CampaignSuggestionList({ suggestions, html, onApply, compact }: Props) {
  const { toast } = useToast();
  const [states, setStates] = useState<Record<number, SuggestionState>>(() =>
    Object.fromEntries(
      suggestions.map((_, i) => [
        i,
        { applied: false, pending: false, inputValue: "", showInput: false },
      ])
    )
  );

  const updateState = (i: number, patch: Partial<SuggestionState>) =>
    setStates((prev) => ({ ...prev, [i]: { ...prev[i], ...patch } }));

  const handleApply = (i: number, suggestionText: string, currentHtml: string) => {
    const meta = getSuggestionMeta(suggestionText);

    if (meta.requiresInput && !states[i]?.showInput) {
      updateState(i, { showInput: true });
      return;
    }

    const input = meta.requiresInput ? states[i]?.inputValue : undefined;
    if (meta.requiresInput && !input?.trim()) {
      toast({ title: "Please enter a value first", variant: "destructive" });
      return;
    }

    updateState(i, { pending: true });

    const result = applySuggestionToHtml(currentHtml, meta.action as SuggestionAction, input);

    setTimeout(() => {
      if (result.applied) {
        onApply(result.html);
        updateState(i, { applied: true, pending: false, showInput: false });
        toast({ title: "Applied!", description: result.message });
      } else {
        updateState(i, { pending: false, showInput: false });
        toast({ title: result.message, variant: "destructive" });
      }
    }, 150);
  };

  const isInfoOnly = (action: SuggestionAction) =>
    action === "speaker-tip" || action === "topic-tip";

  return (
    <div className="space-y-2">
      {suggestions.map((suggestion, i) => {
        const meta = getSuggestionMeta(suggestion);
        const state = states[i] ?? { applied: false, pending: false, inputValue: "", showInput: false };
        const infoOnly = isInfoOnly(meta.action as SuggestionAction);

        return (
          <div
            key={i}
            className={`rounded-xl border transition-all ${
              state.applied
                ? "border-green-200 bg-green-50/60"
                : infoOnly
                ? "border-border/60 bg-muted/20"
                : "border-primary/15 bg-primary/5 hover:border-primary/30 hover:bg-primary/8"
            }`}
          >
            <div className={`flex items-start gap-3 ${compact ? "p-2.5" : "p-3.5"}`}>
              <div className="shrink-0 mt-0.5">
                {state.applied ? (
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                ) : infoOnly ? (
                  <div className="h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-amber-600" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
                    <Wand2 className="h-3 w-3 text-primary" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`${compact ? "text-xs" : "text-sm"} ${state.applied ? "text-green-700 line-through opacity-70" : "text-foreground"} leading-snug`}>
                  {suggestion}
                </p>

                {state.showInput && !state.applied && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      className="h-7 text-xs"
                      placeholder={meta.inputPlaceholder}
                      value={state.inputValue}
                      onChange={(e) => updateState(i, { inputValue: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleApply(i, suggestion, html);
                        if (e.key === "Escape") updateState(i, { showInput: false });
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3 shrink-0"
                      onClick={() => handleApply(i, suggestion, html)}
                      disabled={state.pending || !state.inputValue.trim()}
                    >
                      {state.pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}
              </div>

              {!state.applied && !infoOnly && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={`shrink-0 ${compact ? "h-6 text-xs px-2" : "h-7 text-xs px-2.5"} text-primary hover:bg-primary/10`}
                  onClick={() => handleApply(i, suggestion, html)}
                  disabled={state.pending}
                >
                  {state.pending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : state.showInput ? (
                    <>Enter name <ChevronRight className="h-3 w-3 ml-1" /></>
                  ) : (
                    <>Apply <ChevronRight className="h-3 w-3 ml-1" /></>
                  )}
                </Button>
              )}

              {state.applied && (
                <Badge variant="outline" className="shrink-0 text-xs bg-green-50 text-green-700 border-green-200">
                  Done
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
