import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAiSubjectVariantsCampaign } from "@workspace/api-client-react";
import type { AiSubjectVariantsBodyCampaignType } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

interface AiSubjectVariantsButtonProps {
  campaignType: string;
  eventTitle: string;
  tone?: string | null;
  currentSubject?: string | null;
  onPick: (subject: string) => void;
  buttonClassName?: string;
}

const VALID_TYPES: AiSubjectVariantsBodyCampaignType[] = [
  "invitation",
  "reminder",
  "followup",
  "announcement",
  "custom",
];

function normalizeCampaignType(value: string): AiSubjectVariantsBodyCampaignType {
  return (VALID_TYPES as string[]).includes(value)
    ? (value as AiSubjectVariantsBodyCampaignType)
    : "custom";
}

export function AiSubjectVariantsButton({
  campaignType,
  eventTitle,
  tone,
  currentSubject,
  onPick,
  buttonClassName,
}: AiSubjectVariantsButtonProps) {
  const { activeOrgId } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const mutation = useAiSubjectVariantsCampaign();

  const fetchVariants = () => {
    mutation.mutate(
      {
        orgId: activeOrgId,
        data: {
          campaignType: normalizeCampaignType(campaignType),
          eventTitle,
          tone: tone ?? null,
          currentSubject: currentSubject ?? null,
        },
      },
      {
        onError: (error: unknown) => {
          const apiErr = error as {
            data?: { error?: string; detail?: string };
            message?: string;
          };
          if (apiErr.data?.error === "AI_NOT_CONFIGURED") {
            toast({
              title: "AI not configured",
              description: "Open Settings → AI to set up a provider.",
              variant: "destructive",
            });
          }
        },
      },
    );
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !mutation.isPending && !mutation.data) {
      fetchVariants();
    }
  };

  const handlePick = (variant: string) => {
    onPick(variant);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={buttonClassName}
          disabled={!eventTitle?.trim()}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Suggest subject lines
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        {mutation.isPending && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating variants…
          </div>
        )}
        {!mutation.isPending && mutation.isError && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-destructive">
              Could not generate variants.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={fetchVariants}>
              Try again
            </Button>
          </div>
        )}
        {!mutation.isPending && mutation.data?.variants && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">
              Click one to apply
            </p>
            {mutation.data.variants.map((variant, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handlePick(variant)}
                className="w-full text-left text-sm px-2 py-2 rounded-md hover:bg-muted transition-colors"
              >
                {variant}
              </button>
            ))}
            <div className="pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={fetchVariants}
              >
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
