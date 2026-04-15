import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Wand2,
  Mail,
  Users,
  CheckCircle2,
  Rocket,
  Send,
  UserPlus,
  Upload,
  FileSpreadsheet,
  Search,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  Calendar,
  MapPin,
  Video,
  Clock,
  Bell,
  BellRing,
  Plus,
  X,
} from "lucide-react";
import {
  useGetEvent,
  useListGuests,
  useListCampaigns,
  useListReminders,
  useCreateReminder,
  useAddGuest,
  useRemoveGuest,
  useAiGenerateCampaign,
  useCreateCampaign,
  useGetOrganization,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CSVImportModal } from "@/components/csv-import-modal";
import { GHLImportModal } from "@/components/ghl-import-modal";

const ORG_ID = 1;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STEPS = [
  { key: "campaign", label: "Design Campaign", icon: Mail },
  { key: "test", label: "Test Email", icon: Send },
  { key: "guests", label: "Add Guests", icon: Users },
  { key: "reminders", label: "Set Reminders", icon: Bell },
  { key: "review", label: "Review & Launch", icon: Rocket },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const addGuestSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  company: z.string().optional(),
});

type AddGuestForm = z.infer<typeof addGuestSchema>;

// ─── Branding helper ────────────────────────────────────────────────
function applyBranding(
  html: string,
  branding: { primaryColor?: string | null; accentColor?: string | null; name: string; logoUrl?: string | null; emailFooterText?: string | null; fromEmail?: string | null },
) {
  let out = html;
  const primary = branding.primaryColor || "#7C3AED";
  const accent = branding.accentColor || "#EA580C";
  out = out.replace(/#7C3AED/g, primary).replace(/#EA580C/g, accent);
  out = out.replace(/HypeSpace Events/g, branding.name);
  if (branding.logoUrl) {
    out = out.replace(
      /<h1 style[^>]*>.*?<\/h1>/,
      `<img src="${branding.logoUrl}" alt="${branding.name}" style="max-height:48px;max-width:180px;object-fit:contain;margin-bottom:8px;" />`,
    );
  }
  if (branding.emailFooterText) {
    out = out.replace(/You're receiving this email because you're on our guest list\./, branding.emailFooterText);
  }
  return out;
}

// ─── Step indicator ─────────────────────────────────────────────────
function StepIndicator({
  currentIndex,
  onJump,
  disabled = false,
}: {
  currentIndex: number;
  onJump?: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-0 w-full mb-8">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const Icon = step.icon;
        const clickable = !disabled && onJump && i !== currentIndex;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <button
              type="button"
              onClick={clickable ? () => onJump(i) : undefined}
              disabled={!clickable}
              className={`flex flex-col items-center gap-1.5 flex-1 rounded-lg p-1 -m-1 transition-colors ${
                clickable ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
              }`}
              aria-current={active ? "step" : undefined}
              title={clickable ? `Jump to: ${step.label}` : undefined}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  done
                    ? "bg-green-500 text-white shadow-md shadow-green-500/20 ring-2 ring-transparent hover:ring-green-200"
                    : active
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "bg-muted text-muted-foreground border-2 border-muted-foreground/20 hover:border-primary/40"
                }`}
              >
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={`text-xs font-medium text-center leading-tight ${
                  done ? "text-green-600" : active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 rounded-full transition-colors ${done ? "bg-green-500" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// Main Component
// =====================================================================

export default function EventSetup() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<StepKey>("campaign");
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  const [hasResumed, setHasResumed] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────
  const { data: event, isLoading: isEventLoading } = useGetEvent(ORG_ID, eventId);
  const { data: guests } = useListGuests(ORG_ID, eventId);
  const { data: campaigns } = useListCampaigns(ORG_ID, { eventId } as any);
  const { data: reminders } = useListReminders(ORG_ID, eventId);
  const { data: org } = useGetOrganization(1);

  const hasCampaign = (campaigns?.length ?? 0) > 0;
  const hasGuests = (guests?.length ?? 0) > 0;

  // On first load, honour ?step=xxx if provided, else resume from the
  // earliest incomplete step so users returning to a draft event pick up
  // where they left off.
  useEffect(() => {
    if (hasResumed) return;
    if (!event || !campaigns || !guests) return;
    const qsStep = new URLSearchParams(window.location.search).get("step") as StepKey | null;
    if (qsStep && STEPS.some((s) => s.key === qsStep)) {
      setCurrentStep(qsStep);
    } else {
      let resumeStep: StepKey = "campaign";
      if (!hasCampaign) resumeStep = "campaign";
      else if (!hasGuests) resumeStep = "guests";
      else resumeStep = "reminders";
      setCurrentStep(resumeStep);
    }
    setHasResumed(true);
  }, [event, campaigns, guests, hasCampaign, hasGuests, hasResumed]);

  // ── Navigation ────────────────────────────────────────────────────
  const goNext = () => {
    const idx = STEPS.findIndex((s) => s.key === currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].key);
  };
  const goBack = () => {
    const idx = STEPS.findIndex((s) => s.key === currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1].key);
  };

  // ── Loading ───────────────────────────────────────────────────────
  if (isEventLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold">Event not found</h2>
          <Link href="/events"><Button variant="link" className="mt-4">Back to events</Button></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/events/${eventId}`}>
            <Button variant="outline" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">Set up: {event.title}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Complete each step to launch your event.</p>
          </div>
          <Button
            variant="outline"
            className="text-sm"
            onClick={() => {
              toast({ title: "Saved for later", description: "You'll pick up where you left off next time." });
              setLocation(`/events/${eventId}`);
            }}
          >
            Save for later
          </Button>
        </div>

        {/* Event summary strip */}
        <Card className="border-border/60">
          <CardContent className="py-3 px-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                {format(parseISO(event.startDate), "MMM d, yyyy 'at' h:mm a")}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {event.type === "remote" || event.type === "hybrid" ? (
                  <Video className="h-4 w-4 text-accent" />
                ) : (
                  <MapPin className="h-4 w-4 text-accent" />
                )}
                {event.type === "remote" ? "Online Event" : event.location || "Location TBD"}
              </div>
              <Badge variant="outline" className="capitalize text-xs">{event.type}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Stepper */}
        <StepIndicator
          currentIndex={currentIndex}
          disabled={event.status === "published"}
          onJump={(i) => setCurrentStep(STEPS[i].key)}
        />

        {/* Step Content */}
        {currentStep === "campaign" && (
          <CampaignStep eventId={eventId} event={event} org={org} campaigns={campaigns} onComplete={goNext} />
        )}
        {currentStep === "test" && (
          <TestEmailStep eventId={eventId} campaigns={campaigns} onComplete={goNext} onBack={goBack} />
        )}
        {currentStep === "guests" && (
          <GuestsStep eventId={eventId} guests={guests} onComplete={goNext} onBack={goBack} />
        )}
        {currentStep === "reminders" && (
          <RemindersStep eventId={eventId} event={event} reminders={reminders} onComplete={goNext} onBack={goBack} />
        )}
        {currentStep === "review" && (
          <ReviewStep
            event={event}
            campaigns={campaigns}
            guests={guests}
            reminders={reminders}
            eventId={eventId}
            onBack={goBack}
          />
        )}
      </div>
    </AppLayout>
  );
}

// =====================================================================
// Step 1: Design Campaign
// =====================================================================

function CampaignStep({
  eventId,
  event,
  org,
  campaigns,
  onComplete,
}: {
  eventId: number;
  event: any;
  org: any;
  campaigns: any;
  onComplete: () => void;
}) {
  const hasCampaign = (campaigns?.length ?? 0) > 0;
  const { toast } = useToast();
  const generateCampaign = useAiGenerateCampaign();
  const createCampaign = useCreateCampaign();
  const queryClient = useQueryClient();

  const [campaignType, setCampaignType] = useState("invitation");
  const [tone, setTone] = useState("professional");
  const [context, setContext] = useState("");
  const [editMode, setEditMode] = useState<"preview" | "edit">("preview");
  const [generated, setGenerated] = useState<{
    subject: string;
    htmlContent: string;
    textContent: string;
    suggestions: string[];
  } | null>(null);

  const onGenerate = () => {
    generateCampaign.mutate(
      {
        orgId: ORG_ID,
        data: {
          eventId,
          campaignType: campaignType as any,
          tone: tone as any,
          additionalContext: context,
        },
      } as any,
      {
        onSuccess: (result) => {
          toast({ title: "Campaign generated!" });
          const branding = org
            ? { primaryColor: org.primaryColor, accentColor: org.accentColor, name: org.name, logoUrl: org.logoUrl, emailFooterText: org.emailFooterText, fromEmail: org.fromEmail }
            : { name: "HypeSpace Events" };
          setGenerated({
            ...result,
            htmlContent: applyBranding(result.htmlContent, branding),
          });
        },
        onError: (err) => {
          toast({ title: "Generation failed", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const onSave = () => {
    if (!generated) return;
    createCampaign.mutate(
      {
        orgId: ORG_ID,
        data: {
          eventId,
          name: `AI Generated: ${generated.subject.substring(0, 30)}...`,
          subject: generated.subject,
          type: campaignType as any,
          htmlContent: generated.htmlContent,
          textContent: generated.textContent,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Campaign saved!" });
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/campaigns`] });
          onComplete();
        },
        onError: (err) => {
          toast({ title: "Failed to save", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="h-3 w-3" />
            AI-Powered
          </div>
          <h2 className="text-xl font-bold mb-1">Design your campaign email</h2>
          <p className="text-muted-foreground text-sm">Our AI will create a polished email for your event. Just set the tone.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Form */}
        <Card className="lg:col-span-5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-4 w-4 text-primary" />
              Campaign Brief
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Campaign Type</label>
              <Select value={campaignType} onValueChange={setCampaignType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["invitation", "reminder", "followup", "announcement", "custom"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tone</label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["professional", "friendly", "formal", "casual", "urgent"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Additional Context</label>
              <Textarea
                placeholder="e.g. Mention surprise guest speaker, validated parking..."
                className="resize-none min-h-[80px]"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
              onClick={onGenerate}
              disabled={generateCampaign.isPending}
            >
              {generateCampaign.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Generate Campaign</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <div className="lg:col-span-7">
          {generated ? (
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <Sparkles className="h-3 w-3 mr-1" /> AI Generated
                  </Badge>
                  <div className="flex items-center gap-2">
                    {/* Preview / Edit toggle */}
                    <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
                      <button
                        onClick={() => setEditMode("preview")}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${editMode === "preview" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => setEditMode("edit")}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${editMode === "edit" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Edit HTML
                      </button>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setGenerated(null); setEditMode("preview"); }}>
                      <Loader2 className="h-3 w-3 mr-1" />
                      Regenerate
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mb-1.5 font-medium">Subject Line</div>
                <Input
                  className="text-base font-semibold bg-white/80 border-border"
                  value={generated.subject}
                  onChange={(e) => setGenerated({ ...generated, subject: e.target.value })}
                />
              </CardHeader>
              <CardContent className="p-0">
                {editMode === "preview" ? (
                  <div className="max-h-[440px] overflow-y-auto bg-[#f3f0ff]">
                    <iframe
                      srcDoc={generated.htmlContent}
                      title="Email preview"
                      className="w-full border-0"
                      style={{ height: "440px" }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-950">
                    <p className="text-xs text-zinc-400 mb-2 font-mono">Edit the HTML directly — changes update the preview in real time</p>
                    <textarea
                      className="w-full font-mono text-xs text-green-300 bg-zinc-950 border border-zinc-700 rounded-lg p-3 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                      style={{ minHeight: "380px" }}
                      value={generated.htmlContent}
                      onChange={(e) => setGenerated({ ...generated, htmlContent: e.target.value })}
                      spellCheck={false}
                    />
                  </div>
                )}
              </CardContent>

              {/* AI Suggestions */}
              {generated.suggestions && generated.suggestions.length > 0 && (
                <div className="bg-gradient-to-r from-primary/5 to-accent/5 border-t p-5">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-accent" />
                    Tips to improve your invite
                  </h4>
                  <ul className="space-y-2">
                    {generated.suggestions.map((suggestion, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start">
                        <Check className="h-3.5 w-3.5 mr-2 text-green-500 shrink-0 mt-0.5" />
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <CardFooter className="bg-muted/30 border-t flex justify-between p-4">
                <Button variant="outline" size="sm" onClick={() => { setGenerated(null); setEditMode("preview"); }}>
                  Discard
                </Button>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15"
                  onClick={onSave}
                  disabled={createCampaign.isPending}
                >
                  {createCampaign.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    <>Save & Continue<ArrowRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="h-full min-h-[400px] rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-primary/5 to-accent/5 relative overflow-hidden">
              {/* Decorative orbs */}
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-5 shadow-xl shadow-primary/25 mx-auto">
                  <Wand2 className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Let AI design your campaign</h3>
                <p className="max-w-md text-sm text-muted-foreground mb-4">
                  Set the tone, add context, and our AI writes a high-converting email for <strong className="text-foreground">{event.title}</strong>.
                </p>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                  {["Branded design", "Responsive HTML", "Smart CTA", "Personalized"].map((tag) => (
                    <span key={tag} className="px-2 py-1 rounded-full bg-background/60 border border-border">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div /> {/* no Back on step 1 */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-muted-foreground" onClick={onComplete}>
            Skip this step <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          {hasCampaign && (
            <Button className="bg-primary hover:bg-primary/90 text-white" onClick={onComplete}>
              Continue <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Step 2: Test Email
// =====================================================================

function TestEmailStep({
  eventId,
  campaigns,
  onComplete,
  onBack,
}: {
  eventId: number;
  campaigns: any;
  onComplete: () => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const campaign = campaigns?.[0];

  const onSendTest = async () => {
    if (!campaign || !testEmail.includes("@")) return;
    setIsSending(true);
    try {
      const res = await fetch(
        `${BASE}/api/organizations/${ORG_ID}/campaigns/${campaign.id}/test-send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: testEmail }),
        },
      );
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.previewUrl) {
          toast({
            title: "Test email sent (preview only)",
            description: `No SMTP configured — opening Ethereal preview.`,
          });
          try { window.open(data.previewUrl, "_blank", "noopener"); } catch { /* noop */ }
        } else {
          toast({ title: "Test email sent!", description: `Check ${testEmail}` });
        }
        setSent(true);
      } else {
        toast({ title: "Failed to send", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Send a test email</h2>
        <p className="text-muted-foreground text-sm">Preview how your campaign looks in a real inbox before sending to guests.</p>
      </div>

      <Card className="max-w-lg mx-auto">
        <CardContent className="py-8 px-6">
          <div className="flex flex-col items-center text-center">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-5 ${sent ? "bg-green-500/10" : "bg-primary/10"}`}>
              {sent ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <Send className="h-8 w-8 text-primary" />}
            </div>

            {sent ? (
              <>
                <h3 className="text-lg font-semibold text-green-600 mb-2">Test email sent!</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Check <strong>{testEmail}</strong> for the preview. If it looks good, continue to add your guests.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setSent(false)}>Send another test</Button>
                  <Button className="bg-primary hover:bg-primary/90 text-white" onClick={onComplete}>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-2">
                  {campaign ? `Campaign: ${campaign.subject}` : "No campaign found"}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Enter your email address to receive a test preview of the campaign.
                </p>
                <div className="flex gap-2 w-full max-w-sm">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="h-11"
                  />
                  <Button
                    className="bg-primary hover:bg-primary/90 text-white shrink-0"
                    disabled={isSending || !testEmail.includes("@") || !campaign}
                    onClick={onSendTest}
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Test"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <Button variant="ghost" className="text-muted-foreground" onClick={onComplete}>
          Skip this step <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// =====================================================================
// Step 3: Add Guests
// =====================================================================

function GuestsStep({
  eventId,
  guests,
  onComplete,
  onBack,
}: {
  eventId: number;
  guests: any;
  onComplete: () => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addGuest = useAddGuest();
  const removeGuest = useRemoveGuest();
  const [isCSVOpen, setIsCSVOpen] = useState(false);
  const [isGHLOpen, setIsGHLOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<AddGuestForm>({
    resolver: zodResolver(addGuestSchema),
    defaultValues: { name: "", email: "", company: "" },
  });

  const invalidateGuests = () => {
    const url = `/api/organizations/${ORG_ID}/events/${eventId}/guests`;
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key)) return false;
        const first = key[0];
        if (typeof first !== "string") return false;
        return first === url || first.startsWith(url);
      },
    });
    queryClient.refetchQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key)) return false;
        const first = key[0];
        if (typeof first !== "string") return false;
        return first === url || first.startsWith(url);
      },
    });
  };

  const onAddGuest = (data: AddGuestForm) => {
    addGuest.mutate(
      { orgId: ORG_ID, eventId, data },
      {
        onSuccess: () => {
          toast({ title: `${data.name} added` });
          form.reset();
          invalidateGuests();
        },
        onError: (err) => {
          toast({ title: "Failed to add guest", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const onRemoveGuest = (guestId: number) => {
    removeGuest.mutate(
      { orgId: ORG_ID, eventId, guestId },
      {
        onSuccess: () => {
          toast({ title: "Guest removed" });
          invalidateGuests();
        },
      },
    );
  };

  const filteredGuests = (guests ?? []).filter(
    (g: any) =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Add your guests</h2>
        <p className="text-muted-foreground text-sm">Add guests manually or import from a CSV file. You need at least one guest to launch.</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Add guest form */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Add Guest
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAddGuest)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input placeholder="jane@company.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company (optional)</FormLabel>
                      <FormControl><Input placeholder="Acme Inc" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={addGuest.isPending}>
                  {addGuest.isPending ? "Adding..." : "Add Guest"}
                </Button>
              </form>
            </Form>
            <div className="mt-4 pt-4 border-t space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Import guests</p>
              <Button variant="outline" className="w-full" onClick={() => setIsCSVOpen(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Import from CSV
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setIsGHLOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import from GoHighLevel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Guest list */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{(guests ?? []).length} guests</span>
            </div>
            {(guests ?? []).length > 0 && (
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            )}
          </div>

          {(guests ?? []).length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No guests yet. Add them using the form or import a CSV.</p>
            </div>
          ) : (
            <div className="border rounded-xl divide-y max-h-[400px] overflow-y-auto">
              {filteredGuests.map((guest: any) => (
                <div key={guest.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{guest.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{guest.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => onRemoveGuest(guest.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <div className="flex items-center gap-3">
          {(guests ?? []).length === 0 && (
            <Button variant="ghost" className="text-muted-foreground" onClick={onComplete}>
              Skip for now <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            disabled={(guests ?? []).length === 0}
            onClick={onComplete}
          >
            Continue to Review
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      <CSVImportModal
        open={isCSVOpen}
        onClose={() => {
          invalidateGuests();
          setIsCSVOpen(false);
        }}
        eventId={eventId}
        orgId={ORG_ID}
      />

      <GHLImportModal
        open={isGHLOpen}
        onClose={() => {
          invalidateGuests();
          setIsGHLOpen(false);
        }}
        orgId={ORG_ID}
        initialEventId={eventId}
      />
    </div>
  );
}

// =====================================================================
// Step 4: Set up Reminders
// =====================================================================

const REMINDER_PRESETS = [
  {
    label: "1 week before",
    offsetHours: 168,
    icon: "📅",
    defaultSubject: (title: string) => `Reminder: ${title} is next week`,
    defaultMessage: (title: string, date: string, location: string) =>
      `Hi there!\n\nJust a friendly reminder that ${title} is coming up next week.\n\n📅 ${date}\n📍 ${location}\n\nWe're looking forward to seeing you there! If you have any questions, reply to this email.\n\nSee you soon!`,
  },
  {
    label: "3 days before",
    offsetHours: 72,
    icon: "📣",
    defaultSubject: (title: string) => `${title} is in 3 days — see you there!`,
    defaultMessage: (title: string, date: string, location: string) =>
      `Hi there!\n\n${title} is just 3 days away. We can't wait to see you!\n\n📅 ${date}\n📍 ${location}\n\nHave any last-minute questions? Just reply to this email.\n\nSee you soon!`,
  },
  {
    label: "1 day before",
    offsetHours: 24,
    icon: "🔔",
    defaultSubject: (title: string) => `Tomorrow: ${title} — don't forget!`,
    defaultMessage: (title: string, date: string, location: string) =>
      `Hi there!\n\nThis is your reminder that ${title} is tomorrow!\n\n📅 ${date}\n📍 ${location}\n\nSee you tomorrow!`,
  },
  {
    label: "2 hours before",
    offsetHours: 2,
    icon: "⚡",
    defaultSubject: (title: string) => `${title} starts in 2 hours!`,
    defaultMessage: (title: string, date: string, location: string) =>
      `Hi there!\n\n${title} is starting in just 2 hours — we hope you're on your way!\n\n📅 ${date}\n📍 ${location}\n\nSee you soon!`,
  },
];

function RemindersStep({
  eventId,
  event,
  reminders,
  onComplete,
  onBack,
}: {
  eventId: number;
  event: any;
  reminders: any[] | undefined;
  onComplete: () => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createReminder = useCreateReminder();
  const [adding, setAdding] = useState<number | null>(null); // preset index being added
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const eventDate = event?.startDate
    ? format(parseISO(event.startDate), "MMM d, yyyy 'at' h:mm a")
    : "TBD";
  const eventLocation =
    event?.type === "remote" ? "Online" : event?.location || "TBD";

  const openPreset = (idx: number) => {
    const preset = REMINDER_PRESETS[idx];
    setSubject(preset.defaultSubject(event?.title || "the event"));
    setMessage(preset.defaultMessage(event?.title || "the event", eventDate, eventLocation));
    setAdding(idx);
  };

  const cancelAdd = () => {
    setAdding(null);
    setSubject("");
    setMessage("");
  };

  const saveReminder = () => {
    if (adding === null) return;
    const preset = REMINDER_PRESETS[adding];
    createReminder.mutate(
      {
        orgId: ORG_ID,
        eventId,
        createReminderBody: {
          type: "before_event",
          offsetHours: preset.offsetHours,
          subject: subject.trim() || preset.defaultSubject(event?.title || "the event"),
          message: message.trim() || preset.defaultMessage(event?.title || "the event", eventDate, eventLocation),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Reminder saved!" });
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/events/${eventId}/reminders`] });
          cancelAdd();
        },
        onError: (err) => {
          toast({ title: "Failed to save reminder", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const deleteReminder = async (reminderId: number) => {
    setIsDeleting(reminderId);
    try {
      await fetch(`${BASE}/api/organizations/${ORG_ID}/events/${eventId}/reminders/${reminderId}`, {
        method: "DELETE",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/events/${eventId}/reminders`] });
      toast({ title: "Reminder removed" });
    } catch {
      toast({ title: "Failed to remove reminder", variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  const existingOffsets = new Set((reminders ?? []).map((r: any) => r.offsetHours));

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-semibold uppercase tracking-wider mb-2">
          <BellRing className="h-3 w-3" />
          Automated Reminders
        </div>
        <h2 className="text-xl font-bold mb-1">Set up event reminders</h2>
        <p className="text-muted-foreground text-sm">
          Automatically email your guests before the event. Pick one or several — you can always send them manually too.
        </p>
      </div>

      {/* Existing reminders */}
      {(reminders ?? []).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Scheduled Reminders</h3>
          <div className="space-y-2">
            {(reminders ?? []).map((r: any) => {
              const preset = REMINDER_PRESETS.find((p) => p.offsetHours === r.offsetHours);
              return (
                <div key={r.id} className="flex items-center gap-3 p-4 rounded-xl border bg-card">
                  <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 text-lg">
                    {preset?.icon ?? "🔔"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.offsetHours >= 24
                        ? `${r.offsetHours / 24} day${r.offsetHours / 24 !== 1 ? "s" : ""} before event`
                        : `${r.offsetHours} hour${r.offsetHours !== 1 ? "s" : ""} before event`}
                      {r.status === "sent" && (
                        <span className="ml-2 text-green-600 font-medium">· Sent</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isDeleting === r.id}
                    onClick={() => deleteReminder(r.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                  >
                    {isDeleting === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preset picker */}
      {adding === null && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Add a Reminder</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {REMINDER_PRESETS.map((preset, idx) => {
              const already = existingOffsets.has(preset.offsetHours);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={already}
                  onClick={() => openPreset(idx)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                    already
                      ? "border-green-200 bg-green-50 text-green-700 cursor-not-allowed opacity-70"
                      : "border-border bg-card hover:border-accent hover:bg-accent/5 cursor-pointer"
                  }`}
                >
                  <span className="text-2xl">{preset.icon}</span>
                  <span className="text-xs font-semibold leading-tight">{preset.label}</span>
                  {already && (
                    <span className="text-[10px] text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />Added
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit form for selected preset */}
      {adding !== null && (
        <Card className="border-accent/30 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xl">{REMINDER_PRESETS[adding].icon}</span>
                {REMINDER_PRESETS[adding].label} reminder
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelAdd}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>Customize the subject and message before saving.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Message</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none min-h-[160px] font-mono text-sm"
                placeholder="Email body..."
              />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t flex justify-end gap-2 p-4">
            <Button variant="outline" size="sm" onClick={cancelAdd}>Cancel</Button>
            <Button
              size="sm"
              className="bg-accent hover:bg-accent/90 text-white"
              onClick={saveReminder}
              disabled={createReminder.isPending}
            >
              {createReminder.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Plus className="h-4 w-4 mr-1" />Add Reminder</>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Info note */}
      {adding === null && (
        <div className="p-4 bg-muted/40 rounded-xl text-sm text-muted-foreground flex items-start gap-2.5 border border-border/60">
          <Bell className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <span>
            Reminders are sent automatically based on the timing above. You can also trigger any reminder manually from the event detail page at any time.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-muted-foreground" onClick={onComplete}>
            Skip this step <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white" onClick={onComplete}>
            Continue <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Step 5: Review & Launch
// =====================================================================

function ReviewStep({
  event,
  campaigns,
  guests,
  reminders,
  eventId,
  onBack,
}: {
  event: any;
  campaigns: any;
  guests: any;
  reminders: any[] | undefined;
  eventId: number;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isLaunching, setIsLaunching] = useState(false);

  const campaign = campaigns?.[0];
  const guestCount = guests?.length ?? 0;
  const readyToLaunch = campaign && guestCount > 0;

  const onLaunch = async () => {
    setIsLaunching(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/events/${eventId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json();
      if (res.ok) {
        toast({ title: "Event launched!", description: `${body.guestsInvited} guests invited.` });
        queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/events/${eventId}`] });
        setLocation(`/events/${eventId}`);
      } else {
        toast({ title: "Launch failed", description: body.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Review & Launch</h2>
        <p className="text-muted-foreground text-sm">Make sure everything looks good before going live.</p>
      </div>

      <Card>
        <CardContent className="py-6 px-6 space-y-6">
          {/* Event summary */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Event</h3>
            <div className="p-4 bg-muted/30 rounded-xl space-y-2">
              <p className="font-semibold text-lg">{event.title}</p>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  {format(parseISO(event.startDate), "MMM d, yyyy 'at' h:mm a")}
                </span>
                <span className="flex items-center gap-1.5">
                  {event.type === "remote" ? <Video className="h-4 w-4 text-accent" /> : <MapPin className="h-4 w-4 text-accent" />}
                  {event.type === "remote" ? "Online" : event.location || "TBD"}
                </span>
              </div>
            </div>
          </div>

          {/* Campaign summary */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Campaign</h3>
            {campaign ? (
              <div className="p-4 bg-muted/30 rounded-xl flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{campaign.subject}</p>
                  <p className="text-xs text-muted-foreground capitalize">{campaign.type} campaign</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto shrink-0" />
              </div>
            ) : (
              <div className="p-4 bg-red-50 rounded-xl text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                No campaign created. Go back to create one.
              </div>
            )}
          </div>

          {/* Guests summary */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Guests</h3>
            <div className="p-4 bg-muted/30 rounded-xl flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-medium text-sm">{guestCount} guest{guestCount !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground">Will receive the campaign email on launch</p>
              </div>
              {guestCount > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 ml-auto shrink-0" />
              )}
            </div>
          </div>

          {/* Reminders summary */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Reminders</h3>
            {(reminders ?? []).length > 0 ? (
              <div className="space-y-2">
                {(reminders ?? []).map((r: any) => {
                  const preset = REMINDER_PRESETS.find((p) => p.offsetHours === r.offsetHours);
                  return (
                    <div key={r.id} className="p-3 bg-muted/30 rounded-xl flex items-center gap-3">
                      <span className="text-base">{preset?.icon ?? "🔔"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{r.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.offsetHours >= 24
                            ? `${r.offsetHours / 24} day${r.offsetHours / 24 !== 1 ? "s" : ""} before`
                            : `${r.offsetHours} hour${r.offsetHours !== 1 ? "s" : ""} before`}
                        </p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-muted/20 rounded-xl text-sm text-muted-foreground flex items-center gap-2">
                <Bell className="h-4 w-4" />
                No reminders set up — you can add them after launch from the event page.
              </div>
            )}
          </div>

          {/* What happens on launch */}
          <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              What happens when you launch:
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Campaign email sent to all {guestCount} guests
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Guest statuses updated to "invited"
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Event status changes to "published"
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Public RSVP page becomes active
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-3 flex-wrap">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-12 px-6"
            onClick={() => {
              toast({ title: "Saved as draft", description: "You can launch anytime from the event page." });
              setLocation(`/events/${eventId}`);
            }}
            disabled={isLaunching}
          >
            Save as Draft
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-12 px-8 text-base"
            disabled={!readyToLaunch || isLaunching}
            onClick={onLaunch}
          >
            {isLaunching ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" />Launching...</>
            ) : (
              <><Rocket className="h-5 w-5 mr-2" />Launch Event</>
            )}
          </Button>
        </div>
      </div>
      {!readyToLaunch && (
        <p className="text-xs text-muted-foreground text-center">
          Need a campaign and at least one guest to launch. You can save as draft and finish later.
        </p>
      )}
    </div>
  );
}
