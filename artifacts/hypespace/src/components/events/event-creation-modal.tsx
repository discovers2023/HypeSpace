import { useState, useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ArrowRight, Sparkles, Mail, Users, Send, Rocket, Check,
  CheckCircle2, CalendarIcon, Clock, MapPin, Video, Globe, Building2,
  FileText, UserPlus, Upload, Loader2, Wand2, Monitor, Smartphone,
  Lock, X,
} from "lucide-react";
import { format } from "date-fns";
import {
  useCreateEvent, useAddGuest, useListGuests, useListCampaigns,
  useAiGenerateCampaign, useCreateCampaign, useUpdateEvent, useGetOrganization,
  type Organization, type AiGenerateCampaignBodyCampaignType,
  type AiGenerateCampaignBodyTone, type CampaignType,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { TimezonePicker } from "@/components/timezone-picker";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { CSVImportModal } from "@/components/csv-import-modal";

const ORG_ID = 1;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STEPS = [
  { key: "details", label: "Event Details", icon: CalendarIcon },
  { key: "campaign", label: "Design Campaign", icon: Mail },
  { key: "test", label: "Test Email", icon: Send },
  { key: "guests", label: "Add Guests", icon: Users },
  { key: "review", label: "Review & Launch", icon: Rocket },
] as const;

const CATEGORIES = [
  { value: "conference", label: "Conference", emoji: "🎤" },
  { value: "study_club", label: "Study Club", emoji: "📚" },
  { value: "workshop", label: "Workshop", emoji: "🛠️" },
  { value: "webinar", label: "Webinar", emoji: "💻" },
  { value: "networking", label: "Networking", emoji: "🤝" },
  { value: "seminar", label: "Seminar", emoji: "🎓" },
  { value: "other", label: "Other", emoji: "✨" },
] as const;

const TYPES = [
  { value: "onsite", label: "In-Person", desc: "Physical venue", icon: Building2 },
  { value: "remote", label: "Virtual", desc: "Online only", icon: Video },
  { value: "hybrid", label: "Hybrid", desc: "Both in-person & online", icon: Globe },
] as const;

const eventSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["onsite", "remote", "hybrid"]),
  category: z.enum(["conference", "study_club", "workshop", "webinar", "networking", "seminar", "other"]),
  startDate: z.date({ required_error: "A start date is required." }),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.date({ required_error: "An end date is required." }),
  endTime: z.string().min(1, "End time is required"),
  timezone: z.string().min(1),
  location: z.string().optional(),
  onlineUrl: z.string().optional(),
  capacity: z.coerce.number().optional(),
  coverImageUrl: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

const addGuestSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  company: z.string().optional(),
});
type AddGuestForm = z.infer<typeof addGuestSchema>;

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function applyBranding(html: string, branding: { name: string; primaryColor?: string; accentColor?: string }) {
  let out = html;
  const primary = (branding.primaryColor || "#7C3AED").replace(/[^#a-fA-F0-9]/g, "");
  const accent = (branding.accentColor || "#EA580C").replace(/[^#a-fA-F0-9]/g, "");
  out = out.replace(/#7C3AED/g, primary).replace(/#EA580C/g, accent);
  out = out.replace(/HypeSpace Events/g, escapeHtml(branding.name));
  return out;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prefillDate?: Date;
  onEventCreated?: (eventId: number) => void;
}

export function EventCreationModal({ open, onClose, prefillDate, onEventCreated }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const { data: org } = useGetOrganization(ORG_ID);

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [createdEventId, setCreatedEventId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      type: "onsite",
      category: "conference",
      startDate: tomorrow,
      startTime: "09:00",
      endDate: tomorrow,
      endTime: "17:00",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: "",
      onlineUrl: "",
      coverImageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070",
    },
  });

  useEffect(() => {
    if (prefillDate) {
      form.setValue("startDate", prefillDate);
      form.setValue("endDate", prefillDate);
    }
  }, [prefillDate, form]);

  const eventType = form.watch("type");
  const currentStep = STEPS[stepIndex];

  const combineDateTime = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

  const createOrUpdateDraft = async (data: EventFormValues): Promise<{ id: number | null; error?: Error }> => {
    const payload = {
      ...data,
      startDate: combineDateTime(data.startDate, data.startTime),
      endDate: combineDateTime(data.endDate, data.endTime),
      capacity: data.capacity ? Number(data.capacity) : undefined,
    };
    if (createdEventId) {
      return new Promise((resolve) => {
        updateEvent.mutate(
          { orgId: ORG_ID, eventId: createdEventId, data: payload },
          {
            onSuccess: () => resolve({ id: createdEventId }),
            onError: (err) => resolve({ id: null, error: err as Error }),
          },
        );
      });
    }
    return new Promise((resolve) => {
      createEvent.mutate(
        { orgId: ORG_ID, data: payload },
        {
          onSuccess: (ev) => {
            setCreatedEventId(ev.id);
            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
            queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/dashboard`] });
            resolve({ id: ev.id });
          },
          onError: (err) => resolve({ id: null, error: err as Error }),
        },
      );
    });
  };

  const goNext = async () => {
    if (stepIndex === 0) {
      const valid = await form.trigger();
      if (!valid) {
        toast({ title: "Please fill in all required fields", variant: "destructive" });
        return;
      }
      setIsSubmitting(true);
      const data = form.getValues();
      const result = await createOrUpdateDraft(data);
      setIsSubmitting(false);
      if (!result.id) {
        const err = result.error as (Error & { status?: number }) | undefined;
        const status = err?.status;
        if (status === 402) {
          toast({
            title: "Plan limit reached",
            description: "Your free plan allows 1 active event. Please upgrade your plan to create more events, or delete your existing event first.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Failed to save event", description: err?.message || "Please try again.", variant: "destructive" });
        }
        return;
      }
      toast({ title: "Draft saved!", description: "Your event details have been saved." });
    } else if (createdEventId && stepIndex < STEPS.length - 1) {
      const data = form.getValues();
      createOrUpdateDraft(data).catch(() => {});
    }
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleClose = () => {
    if (createdEventId && onEventCreated) {
      onEventCreated(createdEventId);
    }
    setStepIndex(0);
    setCreatedEventId(null);
    form.reset();
    onClose();
  };

  const stepVariants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[90vw] max-w-full max-h-[95vh] w-full overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">
              {currentStep.label}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Step {stepIndex + 1} of {STEPS.length}
              </span>
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
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all text-xs font-bold ${
                      done ? "bg-green-500 text-white" : active ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight hidden sm:block ${
                      done ? "text-green-600" : active ? "text-primary" : "text-muted-foreground"
                    }`}>{step.label}</span>
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

        {/* Step Content */}
        <div className="p-6 overflow-y-auto">
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
                <Form {...form}>
                  <form onSubmit={(e) => e.preventDefault()}>
                    <DetailsStep form={form} eventType={eventType} />
                  </form>
                </Form>
              )}
              {stepIndex === 1 && createdEventId && (
                <CampaignStep eventId={createdEventId} org={org} />
              )}
              {stepIndex === 2 && createdEventId && (
                <TestEmailStep eventId={createdEventId} />
              )}
              {stepIndex === 3 && createdEventId && (
                <GuestsStep eventId={createdEventId} />
              )}
              {stepIndex === 4 && createdEventId && (
                <ReviewStep
                  eventId={createdEventId}
                  form={form}
                  onLaunched={handleClose}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center sticky bottom-0 bg-background">
          <Button variant="outline" onClick={stepIndex === 0 ? handleClose : goBack}>
            {stepIndex === 0 ? "Cancel" : <><ArrowLeft className="h-4 w-4 mr-1" />Back</>}
          </Button>
          {stepIndex < STEPS.length - 1 && (
            <Button
              onClick={goNext}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <>Next <ArrowRight className="h-4 w-4 ml-2" /></>}
            </Button>
          )}
          {stepIndex === STEPS.length - 1 && (
            <Button variant="outline" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────
// Step 1: Event Details
// ──────────────────────────────────────────────────
function DetailsStep({ form, eventType }: { form: UseFormReturn<EventFormValues>; eventType: string }) {
  const selectedCategory = form.watch("category");

  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-semibold">Event Title *</FormLabel>
            <FormControl>
              <Input placeholder="Annual Tech Conference 2026" className="text-lg h-12" autoFocus {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div>
        <label className="text-sm font-semibold mb-2 block">Event Type *</label>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((type) => {
            const Icon = type.icon;
            const isActive = eventType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => form.setValue("type", type.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
              >
                <Icon className={`h-5 w-5 mb-1 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <p className="font-semibold text-sm">{type.label}</p>
                <p className="text-xs text-muted-foreground">{type.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold mb-2 block">Category</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => form.setValue("category", cat.value)}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium flex items-center gap-1.5 ${
                selectedCategory === cat.value
                  ? "bg-primary text-white border-primary"
                  : "bg-card border-border hover:border-primary/40"
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarIcon className="h-4 w-4 text-primary" />Starts
          </div>
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("w-full justify-start text-left text-sm", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input type="time" className="pl-9" {...form.register("startTime")} />
          </div>
        </div>
        <div className="p-4 rounded-xl bg-accent/5 border border-accent/10 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarIcon className="h-4 w-4 text-accent" />Ends
          </div>
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("w-full justify-start text-left text-sm", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
            <Input type="time" className="pl-9" {...form.register("endTime")} />
          </div>
        </div>
      </div>

      {(eventType === "onsite" || eventType === "hybrid") && (
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />Location *</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St, City, State" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {(eventType === "remote" || eventType === "hybrid") && (
        <FormField
          control={form.control}
          name="onlineUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold flex items-center gap-2"><Video className="h-4 w-4" />Meeting URL *</FormLabel>
              <FormControl>
                <Input placeholder="https://meet.google.com/..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" />Capacity</FormLabel>
              <FormControl>
                <Input type="number" placeholder="100" min={1} {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold flex items-center gap-2"><Globe className="h-4 w-4" />Timezone</FormLabel>
              <FormControl>
                <TimezonePicker value={field.value} onChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-semibold">Description</FormLabel>
            <FormControl>
              <Textarea placeholder="Tell people what to expect at your event..." className="resize-none min-h-[80px]" {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="coverImageUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-semibold">Cover Image</FormLabel>
            <FormControl>
              <CoverImagePicker value={field.value} onChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────
// Step 2: Add Guests
// ──────────────────────────────────────────────────
function GuestsStep({ eventId }: { eventId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addGuestMutation = useAddGuest();
  const { data: guests } = useListGuests(ORG_ID, eventId);
  const [isCSVOpen, setIsCSVOpen] = useState(false);

  const form = useForm<AddGuestForm>({ resolver: zodResolver(addGuestSchema), defaultValues: { name: "", email: "", company: "" } });

  const onAddGuest = (data: AddGuestForm) => {
    addGuestMutation.mutate(
      { orgId: ORG_ID, eventId, data },
      {
        onSuccess: () => {
          toast({ title: "Guest added!" });
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/events/${eventId}/guests`] });
          form.reset();
        },
        onError: (e) => toast({ title: "Failed to add guest", description: e.message, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold mb-1">Add your guests</h3>
        <p className="text-sm text-muted-foreground">You can add guests now or skip and do it later.</p>
      </div>

      <form onSubmit={form.handleSubmit(onAddGuest)} className="p-4 rounded-xl border bg-card space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold mb-1 block">Name *</label>
            <Input placeholder="Jane Smith" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block">Email *</label>
            <Input placeholder="jane@example.com" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block">Company</label>
            <Input placeholder="Acme Inc" {...form.register("company")} />
          </div>
        </div>
        <Button type="submit" disabled={addGuestMutation.isPending} size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          {addGuestMutation.isPending ? "Adding..." : "Add Guest"}
        </Button>
      </form>

      <Button variant="outline" className="w-full" onClick={() => setIsCSVOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Import from CSV
      </Button>

      {(guests?.length ?? 0) > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-2 bg-muted/30 border-b text-xs font-semibold text-muted-foreground">
            {guests!.length} guest{guests!.length !== 1 ? "s" : ""} added
          </div>
          <div className="divide-y max-h-[200px] overflow-y-auto">
            {guests!.map((g) => (
              <div key={g.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {g.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{g.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CSVImportModal
        open={isCSVOpen}
        onClose={() => setIsCSVOpen(false)}
        eventId={eventId}
        orgId={ORG_ID}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/events/${eventId}/guests`] });
          setIsCSVOpen(false);
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────
// Step 3: Design Campaign
// ──────────────────────────────────────────────────
function CampaignStep({ eventId, org }: { eventId: number; org: Organization | undefined }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const generateCampaign = useAiGenerateCampaign();
  const createCampaign = useCreateCampaign();
  const { data: allCampaigns } = useListCampaigns(ORG_ID);
  const campaigns = allCampaigns?.filter((c) => c.eventId === eventId);

  const [campaignType, setCampaignType] = useState<AiGenerateCampaignBodyCampaignType>("invitation");
  const [tone, setTone] = useState<AiGenerateCampaignBodyTone>("professional");
  const [context, setContext] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [editMode, setEditMode] = useState(false);
  const [generated, setGenerated] = useState<{
    subject: string; htmlContent: string; textContent: string; suggestions: string[];
  } | null>(null);

  const hasCampaign = (campaigns?.length ?? 0) > 0;

  const onGenerate = () => {
    generateCampaign.mutate(
      { orgId: ORG_ID, data: { eventId, campaignType, tone, additionalContext: context } },
      {
        onSuccess: (result) => {
          const branding = org ? { ...org } : { name: "HypeSpace Events" };
          const branded = applyBranding(result.htmlContent, branding);
          setGenerated({ ...result, htmlContent: branded });
          createCampaign.mutate(
            {
              orgId: ORG_ID,
              data: {
                eventId,
                name: `AI Campaign: ${result.subject.substring(0, 40)}`,
                subject: result.subject,
                type: campaignType as CampaignType,
                htmlContent: branded,
                textContent: result.textContent,
              },
            },
            {
              onSuccess: () => {
                toast({ title: "Campaign generated & saved!" });
                queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/campaigns`] });
              },
              onError: (e) => toast({ title: "Generated, but failed to save", description: e.message, variant: "destructive" }),
            },
          );
        },
        onError: (e) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
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
          name: `AI Campaign: ${generated.subject.substring(0, 40)}`,
          subject: generated.subject,
          type: campaignType as CampaignType,
          htmlContent: generated.htmlContent,
          textContent: generated.textContent,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Campaign saved!" });
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/campaigns`] });
        },
        onError: (e) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold mb-1">Design your campaign email</h3>
        <p className="text-sm text-muted-foreground">Use AI to create a polished email campaign for your event.</p>
      </div>

      {hasCampaign && (
        <div className="p-3 rounded-xl border border-green-200 bg-green-50 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>You already have a campaign for this event. You can skip this step or create another.</span>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold mb-1 block">Campaign Type</label>
          <select
            value={campaignType}
            onChange={(e) => setCampaignType(e.target.value as AiGenerateCampaignBodyCampaignType)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {["invitation", "reminder", "followup", "announcement", "custom"].map((t) => (
              <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as AiGenerateCampaignBodyTone)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {["professional", "friendly", "formal", "casual", "urgent"].map((t) => (
              <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold mb-1 block">Additional Context</label>
        <Textarea placeholder="e.g. Mention surprise speaker, validated parking..." value={context} onChange={(e) => setContext(e.target.value)} className="resize-none min-h-[60px]" />
      </div>

      <Button onClick={onGenerate} disabled={generateCampaign.isPending} className="bg-primary hover:bg-primary/90 text-white">
        {generateCampaign.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate with AI</>}
      </Button>

      {generated && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-semibold">Subject</p>
              <Input value={generated.subject} onChange={(e) => setGenerated({ ...generated, subject: e.target.value })} className="text-sm font-semibold bg-white" />
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <div className="flex items-center rounded-lg border bg-background overflow-hidden">
                <button onClick={() => setPreviewMode("desktop")} className={`px-2 py-1.5 transition-colors ${previewMode === "desktop" ? "bg-primary text-white" : "text-muted-foreground"}`}>
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setPreviewMode("mobile")} className={`px-2 py-1.5 transition-colors ${previewMode === "mobile" ? "bg-primary text-white" : "text-muted-foreground"}`}>
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          {editMode ? (
            <div className="p-3">
              <Textarea
                value={generated.htmlContent}
                onChange={(e) => setGenerated({ ...generated, htmlContent: e.target.value })}
                className="font-mono text-xs min-h-[300px] resize-y"
              />
            </div>
          ) : (
            <div className={`bg-[#f3f0ff] flex justify-center ${previewMode === "mobile" ? "px-4 py-4" : ""}`}>
              <iframe
                srcDoc={generated.htmlContent}
                title="Email preview"
                className="border-0 rounded"
                style={{ width: previewMode === "mobile" ? "375px" : "100%", height: "320px" }}
                sandbox="allow-same-origin"
              />
            </div>
          )}
          <div className="px-4 py-3 border-t flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setGenerated(null)}>Discard</Button>
              <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
                <FileText className="h-3.5 w-3.5 mr-1" />
                {editMode ? "Preview" : "Edit HTML"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onGenerate} disabled={generateCampaign.isPending}>
                {generateCampaign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="h-3.5 w-3.5 mr-1" />Regenerate</>}
              </Button>
              <Button size="sm" onClick={onSave} disabled={createCampaign.isPending} className="bg-primary hover:bg-primary/90 text-white">
                {createCampaign.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Campaign"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Step 4: Test Email
// ──────────────────────────────────────────────────
function TestEmailStep({ eventId }: { eventId: number }) {
  const { toast } = useToast();
  const { data: allCampaigns } = useListCampaigns(ORG_ID);
  const campaigns = allCampaigns?.filter((c) => c.eventId === eventId);
  const [testEmail, setTestEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const campaign = campaigns?.[0];

  const onSendTest = async () => {
    if (!campaign || !testEmail.includes("@")) return;
    setIsSending(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/campaigns/${campaign.id}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.previewUrl) {
          toast({ title: "Test email sent (preview only)", description: "No SMTP configured — opening Ethereal preview." });
          try { window.open(data.previewUrl, "_blank", "noopener"); } catch { }
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
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold mb-1">Send a test email</h3>
        <p className="text-sm text-muted-foreground">Preview how your campaign looks in a real inbox before launching.</p>
      </div>

      <div className="p-8 rounded-xl border bg-card flex flex-col items-center text-center">
        <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 ${sent ? "bg-green-500/10" : "bg-primary/10"}`}>
          {sent ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <Send className="h-8 w-8 text-primary" />}
        </div>
        {sent ? (
          <>
            <h4 className="text-lg font-semibold text-green-600 mb-2">Test sent!</h4>
            <p className="text-sm text-muted-foreground mb-4">Check <strong>{testEmail}</strong> to review the email.</p>
            <Button variant="outline" size="sm" onClick={() => setSent(false)}>Send another test</Button>
          </>
        ) : (
          <>
            <h4 className="text-base font-semibold mb-1">{campaign ? campaign.subject : "No campaign yet"}</h4>
            <p className="text-sm text-muted-foreground mb-4">
              {campaign ? "Enter an email to send a test preview." : "Create a campaign in the previous step first."}
            </p>
            <div className="flex gap-2 w-full max-w-sm">
              <Input
                type="email"
                placeholder="your@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <Button
                className="bg-primary hover:bg-primary/90 text-white shrink-0"
                disabled={isSending || !testEmail.includes("@") || !campaign}
                onClick={onSendTest}
              >
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
// Step 5: Review & Launch
// ──────────────────────────────────────────────────
function ReviewStep({ eventId, form, onLaunched }: { eventId: number; form: UseFormReturn<EventFormValues>; onLaunched: () => void }) {
  const { toast } = useToast();
  const { data: guests } = useListGuests(ORG_ID, eventId);
  const { data: allCampaigns } = useListCampaigns(ORG_ID);
  const campaigns = allCampaigns?.filter((c) => c.eventId === eventId);
  const updateEvent = useUpdateEvent();
  const [isLaunching, setIsLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);

  const values = form.getValues();
  const guestCount = guests?.length ?? 0;
  const campaignCount = campaigns?.length ?? 0;
  const previewCampaign = campaigns?.[0];
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  const onLaunch = async () => {
    setIsLaunching(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/events/${eventId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        updateEvent.mutate({ orgId: ORG_ID, eventId, data: { status: "published" } });
        toast({ title: "Event launched!", description: "Invitations are being sent." });
        setLaunched(true);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Launch failed", description: err.error || "Something went wrong", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsLaunching(false);
    }
  };

  if (launched) {
    return (
      <div className="flex flex-col items-center text-center py-8 space-y-4">
        <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <h3 className="text-2xl font-bold text-green-600">Event Launched!</h3>
        <p className="text-muted-foreground max-w-sm">Your event is now live and invitations are being sent to your guests.</p>
        <Button onClick={onLaunched} className="bg-primary hover:bg-primary/90 text-white">View Event</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold mb-1">Review & Launch</h3>
        <p className="text-sm text-muted-foreground">Review your event details before sending invitations to guests.</p>
      </div>

      <div className="rounded-xl border p-5 space-y-3">
        <h4 className="font-semibold text-base">{values.title || "Untitled Event"}</h4>
        <div className="grid sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
            {values.startDate ? format(values.startDate, "MMM d, yyyy") : "No date"} at {values.startTime || "09:00"}
          </div>
          {(values.location || values.type === "remote") && (
            <div className="flex items-center gap-2">
              {values.type === "remote" ? <Video className="h-4 w-4 text-accent" /> : <MapPin className="h-4 w-4 text-accent" />}
              {values.type === "remote" ? "Online Event" : values.location}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 pt-2 border-t text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className={guestCount > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
              {guestCount} guest{guestCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className={campaignCount > 0 ? "text-green-600 font-medium" : "text-amber-600"}>
              {campaignCount > 0 ? `${campaignCount} campaign ready` : "No campaign"}
            </span>
          </div>
        </div>
      </div>

      {previewCampaign && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-1 font-semibold">Invitation Preview</p>
              <p className="text-sm font-semibold truncate">{previewCampaign.subject}</p>
            </div>
            <div className="flex items-center rounded-lg border bg-background overflow-hidden shrink-0">
              <button type="button" onClick={() => setPreviewMode("desktop")} className={`px-2 py-1.5 transition-colors ${previewMode === "desktop" ? "bg-primary text-white" : "text-muted-foreground"}`}>
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setPreviewMode("mobile")} className={`px-2 py-1.5 transition-colors ${previewMode === "mobile" ? "bg-primary text-white" : "text-muted-foreground"}`}>
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className={`bg-[#f3f0ff] flex justify-center ${previewMode === "mobile" ? "px-4 py-4" : ""}`}>
            <iframe
              srcDoc={previewCampaign.htmlContent ?? ""}
              title="Invitation preview"
              className="border-0 rounded bg-white"
              style={{ width: previewMode === "mobile" ? "375px" : "100%", height: "480px" }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      {guestCount === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50">
          <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">No guests added yet. You can still launch but won't send any invitations until guests are added.</p>
        </div>
      )}

      <Button
        onClick={onLaunch}
        disabled={isLaunching}
        className="w-full bg-primary hover:bg-primary/90 text-white h-11"
      >
        {isLaunching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Launching...</> : <><Rocket className="h-4 w-4 mr-2" />Launch Event & Send Invitations</>}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        After launch, editing the email campaign content will be locked. You can still add/remove guests and update the location.
      </p>
    </div>
  );
}
