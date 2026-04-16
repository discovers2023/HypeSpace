import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateEvent } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Clock,
  UploadCloud,
  MapPin,
  Video,
  Users,
  FileText,
  Check,
  Sparkles,
  Globe,
  Building2,
} from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TimezonePicker } from "@/components/timezone-picker";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { AIDescriptionButton } from "@/components/ai-description-button";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const eventSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["onsite", "remote", "hybrid"]),
  category: z.enum(["conference", "study_club", "workshop", "webinar", "networking", "seminar", "other"]),
  startDate: z.date({ required_error: "A start date is required." }),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.date({ required_error: "An end date is required." }),
  endTime: z.string().min(1, "End time is required"),
  timezone: z.string().min(1, "Timezone is required").refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid timezone" },
  ),
  location: z.string().optional(),
  onlineUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1").optional(),
  coverImageUrl: z.string().optional(),
}).refine(
  (data) => {
    if (data.endDate < data.startDate) return false;
    if (data.endDate.getTime() === data.startDate.getTime()) {
      // same day — endTime must be after startTime
      return data.endTime > data.startTime;
    }
    return true;
  },
  { message: "End must be after start", path: ["endDate"] },
).refine(
  (data) => {
    // require location for onsite/hybrid
    if ((data.type === "onsite" || data.type === "hybrid") && !data.location?.trim()) return false;
    return true;
  },
  { message: "Location is required for in-person/hybrid events", path: ["location"] },
).refine(
  (data) => {
    // require onlineUrl for remote/hybrid
    if ((data.type === "remote" || data.type === "hybrid") && !data.onlineUrl?.trim()) return false;
    return true;
  },
  { message: "Meeting URL is required for virtual/hybrid events", path: ["onlineUrl"] },
);

type EventFormValues = z.infer<typeof eventSchema>;

const STEPS = [
  { key: "basics", label: "Basics", icon: Sparkles, fields: ["title", "type", "category"] },
  { key: "when", label: "When", icon: CalendarIcon, fields: ["startDate", "startTime", "endDate", "endTime"] },
  { key: "where", label: "Where", icon: MapPin, fields: ["location", "onlineUrl"] },
  { key: "details", label: "Details", icon: FileText, fields: ["description", "capacity", "coverImageUrl"] },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

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

// ═══════════════════════════════════════════════════════════════════
// Step Indicator
// ═══════════════════════════════════════════════════════════════════
function Stepper({ current, completed }: { current: number; completed: boolean[] }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done = completed[i];
        const active = i === current;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <motion.div
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                  done
                    ? "bg-green-500 text-white shadow-md shadow-green-500/20"
                    : active
                      ? "bg-primary text-white shadow-lg shadow-primary/30"
                      : "bg-muted text-muted-foreground border-2 border-border"
                }`}
                animate={active ? { scale: [1, 1.08, 1] } : {}}
                transition={active ? { duration: 2, repeat: Infinity } : {}}
              >
                {done ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
              </motion.div>
              <span className={`text-xs font-semibold ${done ? "text-green-600" : active ? "text-primary" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-px flex-1 mx-2 bg-border relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-green-500"
                  initial={{ width: 0 }}
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Wizard
// ═══════════════════════════════════════════════════════════════════
export default function EventNew() {
  const { activeOrgId } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createEvent = useCreateEvent();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      type: "onsite",
      category: "conference",
      startTime: "09:00",
      endTime: "17:00",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: "",
      onlineUrl: "",
      coverImageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070",
    },
  });

  const eventType = form.watch("type");
  const currentStep = STEPS[stepIndex];
  const completed = STEPS.map((_, i) => i < stepIndex);

  // Validate fields for current step before advancing
  const isStepValid = async (): Promise<boolean> => {
    const fields = currentStep.fields as readonly (keyof EventFormValues)[];
    const result = await form.trigger(fields as any);
    return result;
  };

  const goNext = async () => {
    const valid = await isStepValid();
    if (!valid) {
      toast({ title: "Please complete required fields", variant: "destructive" });
      return;
    }
    if (stepIndex < STEPS.length - 1) {
      setDirection(1);
      setStepIndex(stepIndex + 1);
    } else {
      submitEvent("continue");
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setDirection(-1);
      setStepIndex(stepIndex - 1);
    }
  };

  const submitEvent = (mode: "draft" | "continue") => {
    form.handleSubmit((data) => onSubmit(data, mode))();
  };

  const onSubmit = async (data: EventFormValues, mode: "draft" | "continue" = "continue") => {
    setIsSubmitting(true);

    const combineDateTime = (date: Date, time: string) => {
      const [hours, minutes] = time.split(":").map(Number);
      const combined = new Date(date);
      combined.setHours(hours, minutes, 0, 0);
      return combined.toISOString();
    };

    const formattedData = {
      ...data,
      startDate: combineDateTime(data.startDate, data.startTime),
      endDate: combineDateTime(data.endDate, data.endTime),
      capacity: data.capacity ? Number(data.capacity) : undefined,
    };

    createEvent.mutate(
      { orgId: activeOrgId ?? 1, data: formattedData },
      {
        onSuccess: (newEvent) => {
          queryClient.invalidateQueries({ queryKey: ["/api/events"] });
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${activeOrgId ?? 1}/dashboard`] });
          if (mode === "draft") {
            toast({ title: "Draft saved!", description: "You can finish setup anytime." });
            setLocation(`/events/${newEvent.id}`);
          } else {
            toast({ title: "Event created!", description: "Now let's design your campaign." });
            setLocation(`/events/${newEvent.id}/setup`);
          }
        },
        onError: (error) => {
          setIsSubmitting(false);
          toast({
            title: "Failed to create event",
            description: error.message || "Something went wrong",
            variant: "destructive",
          });
        },
      },
    );
  };

  const stepVariants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/events">
            <Button variant="outline" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New Event</h1>
            <p className="text-muted-foreground mt-1 text-sm">Step {stepIndex + 1} of {STEPS.length} — {currentStep.label}</p>
          </div>
        </div>

        {/* Stepper */}
        <Stepper current={stepIndex} completed={completed} />

        {/* Form Card */}
        <div className="glass-card p-6 md:p-8">
          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()}>
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentStep.key}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  {currentStep.key === "basics" && <BasicsStep form={form} />}
                  {currentStep.key === "when" && <WhenStep form={form} />}
                  {currentStep.key === "where" && <WhereStep form={form} eventType={eventType} />}
                  {currentStep.key === "details" && <DetailsStep form={form} />}
                </motion.div>
              </AnimatePresence>
            </form>
          </Form>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={stepIndex === 0}
            className="min-w-[100px]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex ? "w-8 bg-primary" : i < stepIndex ? "w-1.5 bg-green-500" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {stepIndex === STEPS.length - 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => submitEvent("draft")}
                disabled={isSubmitting}
                className="min-w-[130px]"
              >
                {isSubmitting ? "Saving..." : "Save as Draft"}
              </Button>
            )}
          <Button
            type="button"
            onClick={stepIndex === STEPS.length - 1 ? () => submitEvent("continue") : goNext}
            disabled={isSubmitting}
            className="min-w-[160px] bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15"
          >
            {stepIndex === STEPS.length - 1 ? (
              isSubmitting ? "Creating..." : (
                <>
                  Create & Continue
                  <Sparkles className="h-4 w-4 ml-2" />
                </>
              )
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 1: Basics
// ═══════════════════════════════════════════════════════════════════
function BasicsStep({ form }: { form: any }) {
  const selectedType = form.watch("type");
  const selectedCategory = form.watch("category");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Let's start with the basics</h2>
        <p className="text-sm text-muted-foreground">What are you hosting?</p>
      </div>

      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold">Event Title</FormLabel>
            <FormControl>
              <Input
                placeholder="Annual Tech Conference 2026"
                className="text-lg h-14 font-medium"
                autoFocus
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div>
        <label className="text-sm font-semibold mb-3 block">Event Type</label>
        <div className="grid grid-cols-3 gap-3">
          {TYPES.map((type) => {
            const Icon = type.icon;
            const isActive = selectedType === type.value;
            return (
              <motion.button
                key={type.value}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => form.setValue("type", type.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border hover:border-primary/30 bg-card"
                }`}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${
                  isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="font-semibold text-sm">{type.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold mb-3 block">Category</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.value;
            return (
              <motion.button
                key={cat.value}
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => form.setValue("category", cat.value)}
                className={`px-4 py-2 rounded-full border text-sm font-medium transition-all flex items-center gap-2 ${
                  isActive
                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                    : "bg-card border-border hover:border-primary/40"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 2: When
// ═══════════════════════════════════════════════════════════════════
function WhenStep({ form }: { form: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">When is it happening?</h2>
        <p className="text-sm text-muted-foreground">Set your start and end times.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Start */}
        <div className="p-5 rounded-xl bg-primary/5 border border-primary/10">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <CalendarIcon className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Starts</h3>
          </div>
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="mb-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal bg-card", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {field.value ? format(field.value, "EEE, MMM d, yyyy") : "Pick a date"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
            <Input type="time" className="pl-9 bg-card" {...form.register("startTime")} />
          </div>
        </div>

        {/* End */}
        <div className="p-5 rounded-xl bg-accent/5 border border-accent/10">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <CalendarIcon className="h-4 w-4 text-accent" />
            </div>
            <h3 className="font-semibold text-sm">Ends</h3>
          </div>
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="mb-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal bg-card", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-accent" />
                        {field.value ? format(field.value, "EEE, MMM d, yyyy") : "Pick a date"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < (form.watch("startDate") || new Date(new Date().setHours(0, 0, 0, 0)))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent pointer-events-none" />
            <Input type="time" className="pl-9 bg-card" {...form.register("endTime")} />
          </div>
        </div>
      </div>

      <FormField
        control={form.control}
        name="timezone"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Timezone
            </FormLabel>
            <FormControl>
              <TimezonePicker value={field.value} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 3: Where
// ═══════════════════════════════════════════════════════════════════
function WhereStep({ form, eventType }: { form: any; eventType: string }) {
  const showLocation = eventType === "onsite" || eventType === "hybrid";
  const showUrl = eventType === "remote" || eventType === "hybrid";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Where is it happening?</h2>
        <p className="text-sm text-muted-foreground">
          {eventType === "remote" ? "Add your meeting URL." : eventType === "hybrid" ? "Add both a venue and meeting URL." : "Add your venue details."}
        </p>
      </div>

      {showLocation && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  Physical Venue
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="123 Convention Center Dr, City, State"
                    className="h-12 text-base"
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground mt-1">Include the full address so guests can find it easily.</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>
      )}

      {showUrl && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <FormField
            control={form.control}
            name="onlineUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" />
                  Meeting URL
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://zoom.us/j/..."
                    type="url"
                    className="h-12 text-base"
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground mt-1">Zoom, Google Meet, Microsoft Teams, etc.</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>
      )}

      {eventType === "remote" && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
          <Video className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Virtual event</p>
            <p className="text-muted-foreground mt-0.5">Your guests will receive the meeting link when they RSVP.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 4: Details
// ═══════════════════════════════════════════════════════════════════
function DetailsStep({ form }: { form: any }) {
  const coverUrl = form.watch("coverImageUrl");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Final touches</h2>
        <p className="text-sm text-muted-foreground">Add a description, cover image, and capacity.</p>
      </div>

      {/* Cover image */}
      <div>
        <label className="text-sm font-semibold mb-2 block">Cover Image</label>
        <CoverImagePicker
          value={coverUrl}
          onChange={(url) => form.setValue("coverImageUrl", url, { shouldDirty: true })}
        />
      </div>

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between mb-1.5">
              <FormLabel className="text-sm font-semibold">Description</FormLabel>
              <AIDescriptionButton
                context={{
                  title: form.watch("title"),
                  type: form.watch("type"),
                  category: form.watch("category"),
                  location: form.watch("location"),
                  startDate: form.watch("startDate"),
                }}
                onGenerated={(desc) => form.setValue("description", desc, { shouldDirty: true })}
              />
            </div>
            <FormControl>
              <Textarea
                placeholder="What's this event about? Who's it for? Why should people come?"
                className="min-h-[120px] resize-none"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="capacity"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Capacity
            </FormLabel>
            <FormControl>
              <Input
                placeholder="Leave blank for unlimited"
                type="number"
                className="h-12"
                {...field}
              />
            </FormControl>
            <p className="text-xs text-muted-foreground mt-1">Maximum number of guests. Leave blank for unlimited.</p>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">Next up: Design your campaign</p>
          <p className="text-muted-foreground mt-0.5">After creating, we'll help you design an AI-powered email campaign, test it, add guests, and launch.</p>
        </div>
      </div>
    </div>
  );
}
