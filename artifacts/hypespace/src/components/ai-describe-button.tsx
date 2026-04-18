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
import { useAiDescribeEvent } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

interface AiDescribeButtonProps {
  title: string;
  type?: string | null;
  category?: string | null;
  location?: string | null;
  onApply: (description: string) => void;
  buttonLabel?: string;
  buttonClassName?: string;
  compact?: boolean;
}

export function AiDescribeButton({
  title,
  type,
  category,
  location,
  onApply,
  buttonLabel = "Generate with AI",
  buttonClassName,
  compact,
}: AiDescribeButtonProps) {
  const { activeOrgId } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [additionalContext, setAdditionalContext] = useState("");
  const mutation = useAiDescribeEvent();

  const handleClick = (e: React.MouseEvent) => {
    if (!title.trim()) {
      e.preventDefault();
      toast({
        title: "Add a title first",
        description: "The AI needs a title for context.",
        variant: "destructive",
      });
      return;
    }
    setOpen(true);
  };

  const handleSubmit = () => {
    mutation.mutate(
      {
        orgId: activeOrgId,
        data: {
          title,
          type: type ?? null,
          category: category ?? null,
          location: location ?? null,
          additionalContext: additionalContext.trim() || null,
        },
      },
      {
        onSuccess: (res) => {
          onApply(res.description);
          setOpen(false);
          setAdditionalContext("");
          toast({ title: "Description generated" });
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
            title: "AI generation failed",
            description:
              apiErr.data?.detail || apiErr.message || "Could not generate a description.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant={compact ? "outline" : "default"}
        size={compact ? "sm" : "default"}
        className={buttonClassName}
        onClick={handleClick}
      >
        <Wand2 className="h-4 w-4 mr-2" />
        {buttonLabel}
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Generate event description
          </DialogTitle>
          <DialogDescription>
            Optionally add extra context — speaker names, keynote topics, anything specific.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="e.g. Highlight the keynote speaker is Dr. X."
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
            disabled={!title.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
