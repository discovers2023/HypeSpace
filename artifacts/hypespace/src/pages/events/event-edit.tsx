import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetEvent, useUpdateEvent } from "@workspace/api-client-react";
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
  Save,
} from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TimezonePicker } from "@/components/timezone-picker";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { AIDescriptionButton } from "@/components/ai-description-button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ORG_ID = 1;

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
      return data.endTime > data.startTime;
    }
    return true;
  },
  { message: "End must be after start", path: ["endDate"] },
).refine(
  (data) => {
    if ((data.type === "onsite" || data.type === "hybrid") && !data.location?.trim()) return false;
    return true;
  },
  { message: "Location is required for in-person/hybrid events", path: ["location"] },
).refine(
  (data) => {
    if ((data.type === "remote" || data.type === "hybrid") && !data.onlineUrl?.trim()) return false;
    return true;
  },
  { message: "Meeting URL is required for virtual/hybrid events", path: ["onlineUrl"] },
);

type EventFormValues = z.infer<typeof eventSchema>;

const SECTIONS = [
  { key: "basics", label: "Basics", icon: Sparkles },
  { key: "when", label: "When", icon: CalendarIcon },
  { key: "where", label: "Where", icon: MapPin },
  { key: "details", label: "Details", icon: FileText },
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
  { value: "hybrid", label: "Hybrid", desc: "Both", icon: Globe },
] as const;

// ═══════════════════════════════════════════════════════════════════
// Main Edit Page
// ═══════════════════════════════════════════════════════════════════
export default function EventEdit() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const updateEvent = useUpdateEvent();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<(typeof SECTIONS)[number]["key"]>("basics");
  const [isSaving, setIsSaving] = useState(false);

  const { data: event, isLoading } = useGetEvent(ORG_ID, eventId);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
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
      coverImageUrl: "",
    },
  });

  // Populate form when event loads
  useEffect(() => {
    if (!event) return;
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);
    form.reset({
      title: event.title,
      description: event.description || "",
      type: event.type,
      category: event.category as any,
      startDate: start,
      startTime: format(start, "HH:mm"),
      endDate: end,
      endTime: format(end, "HH:mm"),
      timezone: event.timezone,
      location: event.location || "",
      onlineUrl: event.onlineUrl || "",
      capacity: event.capacity || undefined,
      coverImageUrl: event.coverImageUrl || "",
    });
  }, [event, form]);

  const eventType = form.watch("type");
  const isDirty = form.formState.isDirty;

  const onSave = async (data: EventFormValues) => {
    setIsSaving(true);
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

    updateEvent.mutate(
      { orgId: ORG_ID, eventId, data: formattedData } as any,
      {
        onSuccess: () => {
          toast({ title: "Event updated!" });
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/events/${eventId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/events`] });
          form.reset(data);
          setIsSaving(false);
        },
        onError: (err) => {
          toast({ title: "Failed to update", description: err.message, variant: "destructive" });
          setIsSaving(false);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-full" />
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href={`/events/${eventId}`}>
              <Button variant="outline" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">Edit: {event.title}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {isDirty ? (
                  <span className="text-amber-600 font-medium">Unsaved changes</span>
                ) : (
                  "All changes saved"
                )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={form.handleSubmit(onSave)}
            disabled={!isDirty || isSaving}
            className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0 min-w-[140px]"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-xl border border-border/50 w-fit">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.key;
            return (
              <motion.button
                key={section.key}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveSection(section.key)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isActive ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="edit-tab-bg"
                    className="absolute inset-0 bg-primary rounded-lg shadow-md shadow-primary/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="h-4 w-4 relative z-10" />
                <span className="relative z-10">{section.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Form Card */}
        <div className="glass-card p-6 md:p-8 min-h-[500px]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeSection === "basics" && <BasicsSection form={form} />}
                  {activeSection === "when" && <WhenSection form={form} />}
                  {activeSection === "where" && <WhereSection form={form} eventType={eventType} />}
                  {activeSection === "details" && <DetailsSection form={form} />}
                </motion.div>
              </AnimatePresence>
            </form>
          </Form>
        </div>

        {/* Sticky bottom save bar when dirty */}
        <AnimatePresence>
          {isDirty && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-card px-6 py-3 flex items-center gap-4 shadow-2xl"
            >
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-medium">You have unsaved changes</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => event && form.reset({
                  title: event.title,
                  description: event.description || "",
                  type: event.type,
                  category: event.category as any,
                  startDate: parseISO(event.startDate),
                  startTime: format(parseISO(event.startDate), "HH:mm"),
                  endDate: parseISO(event.endDate),
                  endTime: format(parseISO(event.endDate), "HH:mm"),
                  timezone: event.timezone,
                  location: event.location || "",
                  onlineUrl: event.onlineUrl || "",
                  capacity: event.capacity || undefined,
                  coverImageUrl: event.coverImageUrl || "",
                })}
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={form.handleSubmit(onSave)}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sections (reused from event-new but without validation navigation)
// ═══════════════════════════════════════════════════════════════════

function BasicsSection({ form }: { form: any }) {
  const selectedType = form.watch("type");
  const selectedCategory = form.watch("category");

  return (
    <div className="space-y-6">
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
                onClick={() => form.setValue("type", type.value, { shouldDirty: true })}
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
                onClick={() => form.setValue("category", cat.value, { shouldDirty: true })}
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

function WhenSection({ form }: { form: any }) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-5">
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
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
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
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
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
              <TimezonePicker
                value={field.value}
                onChange={(tz) => form.setValue("timezone", tz, { shouldDirty: true })}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function WhereSection({ form, eventType }: { form: any; eventType: string }) {
  const showLocation = eventType === "onsite" || eventType === "hybrid";
  const showUrl = eventType === "remote" || eventType === "hybrid";

  return (
    <div className="space-y-6">
      {showLocation && (
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
                <Input placeholder="123 Convention Center Dr" className="h-12 text-base" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {showUrl && (
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
                <Input placeholder="https://zoom.us/j/..." type="url" className="h-12 text-base" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}

function DetailsSection({ form }: { form: any }) {
  const coverUrl = form.watch("coverImageUrl");

  return (
    <div className="space-y-6">
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
              <Textarea placeholder="What's this event about?" className="min-h-[120px] resize-none" {...field} />
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
              <Input placeholder="Leave blank for unlimited" type="number" className="h-12" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
