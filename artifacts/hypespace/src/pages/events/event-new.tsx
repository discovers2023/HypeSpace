import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateEvent } from "@workspace/api-client-react";
import { ArrowLeft, Calendar as CalendarIcon, Clock, UploadCloud } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  startDate: z.date({
    required_error: "A start date is required.",
  }),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.date({
    required_error: "An end date is required.",
  }),
  endTime: z.string().min(1, "End time is required"),
  timezone: z.string().min(1, "Timezone is required"),
  location: z.string().optional(),
  onlineUrl: z.string().optional(),
  capacity: z.coerce.number().min(1).optional(),
  coverImageUrl: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

export default function EventNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createEvent = useCreateEvent();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      coverImageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070", // Default mockup cover
    },
  });

  const eventType = form.watch("type");

  const onSubmit = async (data: EventFormValues) => {
    setIsSubmitting(true);
    
    // Combine date + time into ISO strings
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
      { data: formattedData },
      {
        onSuccess: (newEvent) => {
          toast({ title: "Event created successfully!" });
          queryClient.invalidateQueries({ queryKey: ["/api/events"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          setLocation(`/events/${newEvent.id}`);
        },
        onError: (error) => {
          setIsSubmitting(false);
          toast({
            title: "Failed to create event",
            description: error.message || "Something went wrong",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-12">
        <div className="flex items-center gap-4">
          <Link href="/events">
            <Button variant="outline" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New Event</h1>
            <p className="text-muted-foreground mt-1">Set up your next great experience.</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6 md:p-8 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Cover Image Mockup */}
              <div className="w-full h-48 md:h-64 bg-muted rounded-xl overflow-hidden relative group border border-dashed hover:border-primary/50 transition-colors">
                <img 
                  src={form.watch("coverImageUrl")} 
                  alt="Cover" 
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button type="button" variant="secondary" className="gap-2">
                    <UploadCloud className="h-4 w-4" />
                    Change Cover Image
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Event Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Annual Tech Conference 2024" className="text-lg py-6" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="onsite">In-Person (Onsite)</SelectItem>
                          <SelectItem value="remote">Virtual (Remote)</SelectItem>
                          <SelectItem value="hybrid">Hybrid (Both)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(["conference", "study_club", "workshop", "webinar", "networking", "seminar", "other"] as const).map((cat) => (
                            <SelectItem key={cat} value={cat} className="capitalize">
                              {cat.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col gap-2">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date & Time</FormLabel>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "flex-1 pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < new Date(new Date().setHours(0, 0, 0, 0))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormField
                            control={form.control}
                            name="startTime"
                            render={({ field: timeField }) => (
                              <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  type="time"
                                  className="w-[130px] pl-9"
                                  {...timeField}
                                />
                              </div>
                            )}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date & Time</FormLabel>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "flex-1 pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < (form.watch("startDate") || new Date(new Date().setHours(0, 0, 0, 0)))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormField
                            control={form.control}
                            name="endTime"
                            render={({ field: timeField }) => (
                              <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  type="time"
                                  className="w-[130px] pl-9"
                                  {...timeField}
                                />
                              </div>
                            )}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {(eventType === "onsite" || eventType === "hybrid") && (
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Physical Location</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Convention Center Dr..." {...field} />
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
                      <FormItem className="md:col-span-2">
                        <FormLabel>Meeting URL (Zoom, Google Meet, etc)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://zoom.us/j/..." type="url" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 500" type="number" {...field} />
                      </FormControl>
                      <FormDescription>Leave blank for unlimited</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly className="bg-muted" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe what this event is about..." 
                          className="min-h-[120px] resize-none" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/events">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
                <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-primary to-accent border-0 text-white min-w-[150px]">
                  {isSubmitting ? "Creating..." : "Create Event"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </AppLayout>
  );
}
