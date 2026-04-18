import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAiRewriteCampaign } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

interface AiImproveButtonProps {
  html: string;
  subject: string;
  eventTitle?: string;
  onApply: (next: { html: string; subject: string }) => void;
  buttonLabel?: string;
  buttonClassName?: string;
  compact?: boolean;
}

const PRESETS = ["Shorter", "More formal", "Add urgency", "More casual"];

export function AiImproveButton({
  html,
  subject,
  eventTitle,
  onApply,
  buttonLabel = "Improve with AI",
  buttonClassName,
  compact,
}: AiImproveButtonProps) {
  const { activeOrgId } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const mutation = useAiRewriteCampaign();

  const handleSubmit = () => {
    if (!instruction.trim()) return;
    mutation.mutate(
      {
        orgId: activeOrgId,
        data: {
          html,
          subject,
          instruction: instruction.trim(),
          eventTitle: eventTitle ?? null,
        },
      },
      {
        onSuccess: (res) => {
          onApply({ html: res.html, subject: res.subject });
          setOpen(false);
          setInstruction("");
          toast({ title: "Updated with AI" });
        },
        onError: (error: unknown) => {
          const apiErr = error as {
            data?: { error?: string; provider?: string; detail?: string };
            message?: string;
          };
          if (apiErr.data?.error === "AI_NOT_CONFIGURED") {
            toast({
              title: "AI not configured",
              description: "Open Settings → AI to set up a provider.",
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "AI rewrite failed",
            description:
              apiErr.data?.detail || apiErr.message || "Could not rewrite the campaign.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={compact ? "outline" : "default"}
          size={compact ? "sm" : "default"}
          className={buttonClassName}
        >
          <Wand2 className="h-4 w-4 mr-2" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Improve with AI
          </DialogTitle>
          <DialogDescription>
            Describe how you want to change the email — or pick a preset.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInstruction(preset)}
                disabled={mutation.isPending}
              >
                {preset}
              </Button>
            ))}
          </div>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Tell the AI what to change…"
            rows={4}
            disabled={mutation.isPending}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!instruction.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Improving…
              </>
            ) : (
              "Improve"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
