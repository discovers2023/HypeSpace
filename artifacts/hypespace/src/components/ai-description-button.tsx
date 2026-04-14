import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface AIDescriptionButtonProps {
  context: {
    title?: string;
    type?: string;
    category?: string;
    location?: string;
    startDate?: Date;
  };
  onGenerated: (description: string) => void;
  size?: "sm" | "default";
}

// Template library - generates varied, natural-sounding event descriptions
const INTROS: Record<string, string[]> = {
  conference: [
    "Join industry leaders and innovators at",
    "Don't miss the premier gathering for",
    "Be part of the conversation that matters at",
  ],
  workshop: [
    "Get hands-on experience and practical skills at",
    "Roll up your sleeves and dive deep at",
    "Transform your skills in an intensive workshop:",
  ],
  webinar: [
    "Join us online for an exclusive session on",
    "Tune in to learn from the best at",
    "Reserve your virtual seat at",
  ],
  networking: [
    "Connect with like-minded professionals at",
    "Expand your network at",
    "Meet the movers and shakers at",
  ],
  seminar: [
    "Deepen your understanding at",
    "Explore important topics at",
    "Engage with thought leaders at",
  ],
  study_club: [
    "Dive into collaborative learning at",
    "Meet fellow learners at",
    "Join our regular study session:",
  ],
  other: [
    "Come be part of",
    "Don't miss out on",
    "Join us at",
  ],
};

const BODIES: Record<string, string[]> = {
  onsite: [
    "Experience the energy of being there in person. Connect face-to-face, share ideas, and make memories that last.",
    "Nothing beats an in-person experience. Meet the speakers, chat with fellow attendees, and soak in the atmosphere.",
    "Join us on-site for an immersive experience filled with networking opportunities and interactive sessions.",
  ],
  remote: [
    "Participate from anywhere in the world. All you need is a stable connection and a curious mind.",
    "Our virtual experience brings the event directly to you — no travel required, maximum engagement.",
    "Attend from the comfort of your space. Interactive features ensure you won't miss a beat.",
  ],
  hybrid: [
    "Whether you join us in person or virtually, you'll get the full experience with seamless interaction between both audiences.",
    "Choose your adventure: be there in person for the full energy, or connect remotely — both routes give you premium access.",
    "Our hybrid format lets you participate your way. In-person networking or virtual convenience — the choice is yours.",
  ],
};

const CLOSERS = [
  "Seats are limited — reserve yours today.",
  "Save your spot and be part of something memorable.",
  "Don't wait — RSVP now to secure your place.",
  "We can't wait to welcome you.",
  "Early registration is encouraged.",
];

function generateDescription(ctx: AIDescriptionButtonProps["context"]): string {
  const category = ctx.category || "other";
  const type = ctx.type || "onsite";
  const title = ctx.title || "this event";

  const intros = INTROS[category] || INTROS.other;
  const bodies = BODIES[type] || BODIES.onsite;

  const intro = intros[Math.floor(Math.random() * intros.length)];
  const body = bodies[Math.floor(Math.random() * bodies.length)];
  const closer = CLOSERS[Math.floor(Math.random() * CLOSERS.length)];

  const locationLine = ctx.location
    ? ` Taking place at ${ctx.location}.`
    : type === "remote"
      ? " Join us online from wherever you are."
      : "";

  return `${intro} ${title}.${locationLine}\n\n${body}\n\n${closer}`;
}

export function AIDescriptionButton({ context, onGenerated, size = "sm" }: AIDescriptionButtonProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<string>("");
  const [open, setOpen] = useState(false);

  const generate = () => {
    if (!context.title) {
      toast({
        title: "Add a title first",
        description: "The AI needs an event title to craft a description.",
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    // Simulate AI delay for realism
    setTimeout(() => {
      const result = generateDescription(context);
      setPreview(result);
      setIsGenerating(false);
      setOpen(true);
    }, 600);
  };

  const apply = () => {
    onGenerated(preview);
    setOpen(false);
    toast({ title: "Description added" });
  };

  const regenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setPreview(generateDescription(context));
      setIsGenerating(false);
    }, 400);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          onClick={generate}
          disabled={isGenerating}
          className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isGenerating ? "Generating..." : "AI Generate"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-4" align="end">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Wand2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI Suggested Description</p>
            <p className="text-xs text-muted-foreground">Based on your event details</p>
          </div>
        </div>
        <Textarea
          value={preview}
          onChange={(e) => setPreview(e.target.value)}
          className="min-h-[140px] text-sm resize-none"
        />
        <div className="flex gap-2 mt-3">
          <Button type="button" variant="outline" size="sm" onClick={regenerate} disabled={isGenerating} className="flex-1">
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Regenerate</>}
          </Button>
          <Button type="button" size="sm" onClick={apply} className="flex-1 bg-primary hover:bg-primary/90 text-white">
            Use this
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
