import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, Sparkles, Users, Send, Clock, Check,
  Mail, Loader2, Monitor, Smartphone, CheckCircle2, X, Calendar as CalendarIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAiGenerateCampaign, useCreateCampaign, useUpdateCampaign, useGetCampaign,
  useListGuests, useListEvents,
  type AiGenerateCampaignBodyCampaignType,
  type AiGenerateCampaignBodyTone,
  type CampaignType,
  type Event,
  type Guest,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";

const ORG_ID = 1;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STEPS = [
  { key: "design", label: "Email Design", icon: Mail },
  { key: "recipients", label: "Recipients", icon: Users },
  { key: "test", label: "Test Email", icon: Send },
  { key: "schedule", label: "Schedule & Send", icon: Clock },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  eventId?: number;
  eventTitle?: string;
}

export function CampaignCreationModal({ open, onClose, eventId, eventTitle }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | undefined>(eventId);

  // Design step state
  const [campaignType, setCampaignType] = useState<AiGenerateCampaignBodyCampaignType>("invitation");
  const [tone, setTone] = useState<AiGenerateCampaignBodyTone>("professional");
  const [context, setContext] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [generated, setGenerated] = useState<{ subject: string; htmlContent: string; textContent: string } | null>(null);

  // Recipients step state (lifted for send step wiring)
  const [recipientFilter, setRecipientFilter] = useState<"all" | "confirmed" | "invited" | "added">("all");

  const { data: events } = useListEvents(ORG_ID);
  const { data: guests } = useListGuests(ORG_ID, selectedEventId ?? 0);
  const generateCampaign = useAiGenerateCampaign();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();

  const currentStep = STEPS[stepIndex];

  const goNext = () => {
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const goBack = () => {
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleClose = () => {
    setStepIndex(0);
    setCampaignId(null);
    setGenerated(null);
    setSelectedEventId(eventId);
    onClose();
  };

  const onGenerate = () => {
    generateCampaign.mutate(
      { orgId: ORG_ID, data: { eventId: selectedEventId ?? null, campaignType, tone, additionalContext: context } },
      {
        onSuccess: (result) => {
          setGenerated({ subject: result.subject, htmlContent: result.htmlContent, textContent: result.textContent });
          toast({ title: "Campaign generated!" });
        },
        onError: (e) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  const onSaveDraft = async (): Promise<number | null> => {
    if (!generated) return null;
    return new Promise((resolve) => {
      createCampaign.mutate(
        {
          orgId: ORG_ID,
          data: {
            eventId: selectedEventId ?? null,
            name: `Campaign: ${generated.subject.substring(0, 40)}`,
            subject: generated.subject,
            type: campaignType as CampaignType,
            htmlContent: generated.htmlContent,
            textContent: generated.textContent,
          },
        },
        {
          onSuccess: (c) => {
            setCampaignId(c.id);
            queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/campaigns`] });
            resolve(c.id);
          },
          onError: (e) => {
            toast({ title: "Failed to save campaign", description: e.message, variant: "destructive" });
            resolve(null);
          },
        },
      );
    });
  };

  const handleNextFromDesign = async () => {
    if (!generated) {
      toast({ title: "Please generate a campaign first", variant: "destructive" });
      return;
    }
    if (!campaignId) {
      const savedId = await onSaveDraft();
      if (savedId === null) return;
    } else {
      await new Promise<void>((resolve) => {
        updateCampaign.mutate(
          { orgId: ORG_ID, campaignId, data: { subject: generated.subject, htmlContent: generated.htmlContent, textContent: generated.textContent } },
          { onSuccess: () => resolve(), onError: () => resolve() },
        );
      });
    }
    goNext();
  };

  const handleOpenInEditor = async () => {
    if (!generated) {
      toast({ title: "Please generate a campaign first", variant: "destructive" });
      return;
    }
    let id = campaignId;
    if (!id) {
      id = await onSaveDraft();
      if (!id) return;
    }
    handleClose();
    setLocation(`/campaigns/${id}/edit`);
  };

  const stepVariants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl w-full max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Create Campaign</DialogTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Step {stepIndex + 1} of {STEPS.length}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Stepper */}
          <div className="flex items-center gap-0 mt-4">
            {STEPS.map((step, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${done ? "bg-green-500 text-white" : active ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <span className={`text-[10px] font-medium text-center hidden sm:block ${done ? "text-green-600" : active ? "text-primary" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="h-px flex-1 mx-1 bg-border relative">
                      <div className={`absolute inset-y-0 left-0 bg-green-500 transition-all ${done ? "w-full" : "w-0"}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="p-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep.key}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {stepIndex === 0 && (
                <DesignStep
                  events={events}
                  selectedEventId={selectedEventId}
                  setSelectedEventId={setSelectedEventId}
                  campaignType={campaignType}
                  setCampaignType={setCampaignType}
                  tone={tone}
                  setTone={setTone}
                  context={context}
                  setContext={setContext}
                  previewMode={previewMode}
                  setPreviewMode={setPreviewMode}
                  generated={generated}
                  setGenerated={setGenerated}
                  onGenerate={onGenerate}
                  isGenerating={generateCampaign.isPending}
                />
              )}
              {stepIndex === 1 && (
                <RecipientsStep
                  eventId={selectedEventId}
                  guests={guests}
                  filter={recipientFilter}
                  onFilterChange={setRecipientFilter}
                />
              )}
              {stepIndex === 2 && (
                <TestEmailStep campaignId={campaignId} />
              )}
              {stepIndex === 3 && (
                <ScheduleSendStep
                  campaignId={campaignId}
                  eventId={selectedEventId}
                  recipientFilter={recipientFilter}
                  recipientCount={(guests ?? []).filter((g: Guest) => recipientFilter === "all" || g.status === recipientFilter).length}
                  onSent={handleClose}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-6 py-4 border-t flex justify-between items-center sticky bottom-0 bg-background">
          <Button variant="outline" onClick={stepIndex === 0 ? handleClose : goBack}>
            {stepIndex === 0 ? "Cancel" : <><ArrowLeft className="h-4 w-4 mr-1" />Back</>}
          </Button>
          {stepIndex === 0 && (
            <div className="flex items-center gap-2">
              {generated && (
                <Button
                  variant="outline"
                  onClick={handleOpenInEditor}
                  disabled={createCampaign.isPending}
                  title="Save draft and open in the full campaign editor"
                >
                  {createCampaign.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Open in Full Editor
                </Button>
              )}
              <Button onClick={handleNextFromDesign} disabled={generateCampaign.isPending || createCampaign.isPending} className="bg-primary hover:bg-primary/90 text-white">
                {createCampaign.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <>Next <ArrowRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </div>
          )}
          {stepIndex > 0 && stepIndex < STEPS.length - 1 && (
            <Button onClick={goNext} className="bg-primary hover:bg-primary/90 text-white">
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────
// Step 1: Design
// ──────────────────────────────────────────────────
type GeneratedContent = { subject: string; htmlContent: string; textContent: string };

function DesignStep({
  events, selectedEventId, setSelectedEventId, campaignType, setCampaignType,
  tone, setTone, context, setContext, previewMode, setPreviewMode,
  generated, setGenerated, onGenerate, isGenerating,
}: {
  events: Event[];
  selectedEventId: number | undefined;
  setSelectedEventId: (id: number | undefined) => void;
  campaignType: AiGenerateCampaignBodyCampaignType;
  setCampaignType: (type: AiGenerateCampaignBodyCampaignType) => void;
  tone: AiGenerateCampaignBodyTone;
  setTone: (tone: AiGenerateCampaignBodyTone) => void;
  context: string;
  setContext: (ctx: string) => void;
  previewMode: "desktop" | "mobile";
  setPreviewMode: (mode: "desktop" | "mobile") => void;
  generated: GeneratedContent | null;
  setGenerated: (gen: GeneratedContent | null) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold mb-1">Design your campaign email</h3>
        <p className="text-sm text-muted-foreground">Use AI to create a polished campaign email.</p>
      </div>

      <div>
        <label className="text-xs font-semibold mb-1 block">Linked Event</label>
        <select
          value={selectedEventId ?? ""}
          onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">No linked event</option>
          {(events || []).map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold mb-1 block">Campaign Type</label>
          <select value={campaignType} onChange={(e) => setCampaignType(e.target.value as AiGenerateCampaignBodyCampaignType)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {["invitation", "reminder", "followup", "announcement", "custom"].map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value as AiGenerateCampaignBodyTone)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {["professional", "friendly", "formal", "casual", "urgent"].map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold mb-1 block">Additional Context</label>
        <Textarea placeholder="e.g. Mention guest speaker, special offer..." value={context} onChange={(e) => setContext(e.target.value)} className="resize-none min-h-[60px]" />
      </div>

      <Button onClick={onGenerate} disabled={isGenerating} className="bg-primary hover:bg-primary/90 text-white">
        {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate with AI</>}
      </Button>

      {generated && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1 font-semibold">Subject Line</p>
              <Input
                value={generated.subject}
                onChange={(e) => setGenerated({ ...generated, subject: e.target.value })}
                className="text-sm font-semibold bg-white"
              />
            </div>
            <div className="flex items-center rounded-lg border bg-background overflow-hidden shrink-0">
              <button onClick={() => setPreviewMode("desktop")} className={`px-2 py-1.5 transition-colors ${previewMode === "desktop" ? "bg-primary text-white" : "text-muted-foreground"}`}>
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setPreviewMode("mobile")} className={`px-2 py-1.5 transition-colors ${previewMode === "mobile" ? "bg-primary text-white" : "text-muted-foreground"}`}>
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className={`bg-[#f3f0ff] flex justify-center ${previewMode === "mobile" ? "px-4 py-4" : ""}`}>
            <iframe
              srcDoc={generated.htmlContent}
              title="Email preview"
              className="border-0 rounded"
              style={{ width: previewMode === "mobile" ? "375px" : "100%", height: "320px" }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Step 2: Recipients
// ──────────────────────────────────────────────────
function RecipientsStep({
  eventId, guests, filter, onFilterChange,
}: {
  eventId?: number;
  guests?: Guest[];
  filter: "all" | "confirmed" | "invited" | "added";
  onFilterChange: (f: "all" | "confirmed" | "invited" | "added") => void;
}) {
  const filteredGuests = (guests || []).filter((g) => {
    if (filter === "all") return true;
    return g.status === filter;
  });

  const statusCounts = {
    all: guests?.length ?? 0,
    confirmed: guests?.filter((g) => g.status === "confirmed").length ?? 0,
    invited: guests?.filter((g) => g.status === "invited").length ?? 0,
    added: guests?.filter((g) => g.status === "added").length ?? 0,
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold mb-1">Select Recipients</h3>
        <p className="text-sm text-muted-foreground">Choose which guests will receive this campaign. Your selection is applied when the campaign is sent.</p>
      </div>

      {!eventId ? (
        <div className="p-8 text-center rounded-xl border border-dashed text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Link this campaign to an event to select recipients.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {(["all", "confirmed", "invited", "added"] as const).map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                  filter === f ? "bg-primary/10 text-primary border-primary/20" : "bg-background border-border text-muted-foreground"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1.5 text-xs opacity-70">{statusCounts[f]}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-2 bg-muted/30 border-b text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>{filteredGuests.length} recipients selected</span>
              {filter !== "all" && <span className="text-primary font-medium">Filter: {filter} only</span>}
            </div>
            {filteredGuests.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No guests match this filter.</div>
            ) : (
              <div className="divide-y max-h-[280px] overflow-y-auto">
                {filteredGuests.map((g) => (
                  <div key={g.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{g.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{g.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Step 3: Test Email
// ──────────────────────────────────────────────────
function TestEmailStep({ campaignId }: { campaignId: number | null }) {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSendTest = async () => {
    if (!campaignId || !testEmail.includes("@")) return;
    setIsSending(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/campaigns/${campaignId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.previewUrl) {
          try { window.open(data.previewUrl, "_blank", "noopener"); } catch { }
        }
        toast({ title: "Test email sent!" });
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
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold mb-1">Send a test email</h3>
        <p className="text-sm text-muted-foreground">Preview how your campaign looks in a real inbox.</p>
      </div>
      <div className="p-8 rounded-xl border bg-card flex flex-col items-center text-center">
        <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 ${sent ? "bg-green-500/10" : "bg-primary/10"}`}>
          {sent ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <Send className="h-8 w-8 text-primary" />}
        </div>
        {sent ? (
          <>
            <h4 className="text-lg font-semibold text-green-600 mb-2">Test sent!</h4>
            <p className="text-sm text-muted-foreground mb-4">Check <strong>{testEmail}</strong> to review the email.</p>
            <Button variant="outline" size="sm" onClick={() => setSent(false)}>Send another</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {campaignId ? "Enter an email to receive a test preview." : "Please save the campaign design first."}
            </p>
            <div className="flex gap-2 w-full max-w-sm">
              <Input type="email" placeholder="your@email.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} disabled={!campaignId} />
              <Button className="bg-primary hover:bg-primary/90 text-white shrink-0" disabled={isSending || !testEmail.includes("@") || !campaignId} onClick={onSendTest}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Step 4: Schedule & Send
// ──────────────────────────────────────────────────
// Map UI filter values to bulk-email API segment values
const FILTER_TO_SEGMENT: Record<"all" | "confirmed" | "invited" | "added", string> = {
  all: "all",
  confirmed: "yes",
  invited: "invited",
  added: "not_responded",
};

function ScheduleSendStep({
  campaignId, eventId, recipientFilter, recipientCount, onSent,
}: {
  campaignId: number | null;
  eventId?: number;
  recipientFilter: "all" | "confirmed" | "invited" | "added";
  recipientCount: number;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateCampaign = useUpdateCampaign();
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Fetch campaign to get subject/html/text for bulk-email
  const { data: campaign } = useGetCampaign(ORG_ID, campaignId ?? 0, {
    query: { enabled: !!campaignId },
  });

  const onSend = async () => {
    if (!campaignId) return;
    setIsSending(true);

    if (mode === "schedule" && scheduledDate) {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      updateCampaign.mutate(
        { orgId: ORG_ID, campaignId, data: { status: "scheduled", scheduledAt } },
        {
          onSuccess: () => {
            toast({ title: "Campaign scheduled!", description: `Will send on ${format(new Date(`${scheduledDate}T${scheduledTime}`), "MMM d 'at' h:mm a")}` });
            queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/campaigns`] });
            setSent(true);
            setIsSending(false);
          },
          onError: (e) => {
            toast({ title: "Failed", description: e.message, variant: "destructive" });
            setIsSending(false);
          },
        },
      );
    } else if (eventId && campaign?.htmlContent) {
      // Use bulk-email endpoint which correctly applies the recipient filter
      try {
        const segment = FILTER_TO_SEGMENT[recipientFilter];
        const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/events/${eventId}/bulk-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: campaign.subject,
            htmlContent: campaign.htmlContent,
            textContent: campaign.textContent ?? undefined,
            recipientFilter: { mode: "segment", segment },
            saveAsCampaign: false,
          }),
        });
        if (res.ok) {
          // Mark campaign as sent in the DB; surface failure so state stays consistent
          const markRes = await fetch(`${BASE}/api/organizations/${ORG_ID}/campaigns/${campaignId}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }).catch(() => null);
          if (!markRes?.ok) {
            toast({ title: "Emails sent, but status update failed", description: "Refresh the campaigns list to see the latest status.", variant: "destructive" });
          }
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/campaigns`] });
          toast({ title: "Campaign sent!", description: `Delivered to ${recipientCount} ${recipientFilter !== "all" ? recipientFilter + " " : ""}guest${recipientCount !== 1 ? "s" : ""}.` });
          setSent(true);
        } else {
          const body = await res.json().catch(() => ({}));
          toast({ title: "Failed to send", description: (body as { error?: string }).error ?? "Unknown error", variant: "destructive" });
        }
      } catch {
        toast({ title: "Network error", variant: "destructive" });
      } finally {
        setIsSending(false);
      }
    } else {
      // Fallback: use campaign send endpoint when no event is linked
      try {
        const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/campaigns/${campaignId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          toast({ title: "Campaign sent!" });
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/campaigns`] });
          setSent(true);
        } else {
          toast({ title: "Failed to send", variant: "destructive" });
        }
      } catch {
        toast({ title: "Network error", variant: "destructive" });
      } finally {
        setIsSending(false);
      }
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center py-8 space-y-4">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-green-600">{mode === "schedule" ? "Campaign Scheduled!" : "Campaign Sent!"}</h3>
        <p className="text-muted-foreground text-sm">
          {mode === "schedule"
            ? `Scheduled for ${format(new Date(`${scheduledDate}T${scheduledTime}`), "MMM d 'at' h:mm a")}.`
            : `Delivered to ${recipientCount} ${recipientFilter !== "all" ? recipientFilter + " " : ""}guest${recipientCount !== 1 ? "s" : ""}.`}
        </p>
        <Button onClick={onSent} className="bg-primary hover:bg-primary/90 text-white">Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold mb-1">Schedule & Send</h3>
        <p className="text-sm text-muted-foreground">Send your campaign now or schedule it for later.</p>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border text-sm">
        <Users className="h-4 w-4 text-primary shrink-0" />
        <div>
          <span className="font-medium">{recipientCount} recipient{recipientCount !== 1 ? "s" : ""}</span>
          {recipientFilter !== "all" && (
            <span className="text-muted-foreground"> &mdash; {recipientFilter} guests only</span>
          )}
          {recipientFilter === "all" && (
            <span className="text-muted-foreground"> &mdash; all guests</span>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <button
          onClick={() => setMode("now")}
          className={`p-4 rounded-xl border-2 text-left transition-all ${mode === "now" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
        >
          <Send className={`h-5 w-5 mb-2 ${mode === "now" ? "text-primary" : "text-muted-foreground"}`} />
          <p className="font-semibold text-sm">Send Now</p>
          <p className="text-xs text-muted-foreground mt-0.5">Immediately deliver to selected recipients</p>
        </button>
        <button
          onClick={() => setMode("schedule")}
          className={`p-4 rounded-xl border-2 text-left transition-all ${mode === "schedule" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
        >
          <Clock className={`h-5 w-5 mb-2 ${mode === "schedule" ? "text-primary" : "text-muted-foreground"}`} />
          <p className="font-semibold text-sm">Schedule</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pick a date and time</p>
        </button>
      </div>

      {mode === "schedule" && (
        <div className="space-y-2">
          <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl border bg-muted/20">
            <div>
              <label className="text-xs font-semibold mb-1 block">Date</label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Time</label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
          </div>
          {recipientFilter !== "all" && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Note: recipient filtering ({recipientFilter} guests) applies to Send Now sends. Scheduled campaigns send to all event guests when delivered by the server.
            </p>
          )}
        </div>
      )}

      <Button
        onClick={onSend}
        disabled={isSending || !campaignId || (mode === "schedule" && !scheduledDate)}
        className="w-full h-11 bg-primary hover:bg-primary/90 text-white"
      >
        {isSending
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
          : mode === "now"
          ? <><Send className="h-4 w-4 mr-2" />Send Now</>
          : <><Clock className="h-4 w-4 mr-2" />Schedule Campaign</>}
      </Button>
    </div>
  );
}
