import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetEvent, useListGuests, useAddGuest, useRemoveGuest, useUpdateGuest, useListCampaigns, useListSocialPosts, useListReminders, useCreateReminder } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users, Mail, Share2, ArrowLeft, Plus, Clock, Video, Settings, Trash2, MoreHorizontal, CheckCircle2, XCircle, Clock3, Search, Activity, Upload, FileSpreadsheet, Download, UserPlus, Copy, Rocket, Send, TestTube, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { GHLImportModal } from "@/components/ghl-import-modal";
import { CSVImportModal } from "@/components/csv-import-modal";

const addGuestSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  company: z.string().optional(),
});

type AddGuestFormValues = z.infer<typeof addGuestSchema>;

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: event, isLoading: isEventLoading } = useGetEvent(1, eventId, { query: { enabled: !!eventId } });
  const { data: guests, isLoading: isGuestsLoading } = useListGuests(1, eventId, undefined, { query: { enabled: !!eventId } });
  const { data: campaigns, isLoading: isCampaignsLoading } = useListCampaigns(1, { eventId }, { query: { enabled: !!eventId } });
  const { data: socialPosts, isLoading: isSocialLoading } = useListSocialPosts(1, { eventId }, { query: { enabled: !!eventId } });
  const { data: reminders, isLoading: isRemindersLoading } = useListReminders(1, eventId, { query: { enabled: !!eventId } });
  
  const addGuest = useAddGuest();
  const removeGuest = useRemoveGuest();
  const updateGuest = useUpdateGuest();
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [guestToRemove, setGuestToRemove] = useState<{ id: number; name: string } | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<Set<number>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [isGHLImportOpen, setIsGHLImportOpen] = useState(false);
  const [isLaunchOpen, setIsLaunchOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);
  const [isNewReminderOpen, setIsNewReminderOpen] = useState(false);
  const [newReminderType, setNewReminderType] = useState<"before_event" | "after_event" | "custom">("before_event");
  const [newReminderOffset, setNewReminderOffset] = useState("24");
  const [newReminderSubject, setNewReminderSubject] = useState("");
  const [newReminderMessage, setNewReminderMessage] = useState("");
  const createReminder = useCreateReminder();

  const guestForm = useForm<AddGuestFormValues>({
    resolver: zodResolver(addGuestSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
    }
  });

  const invalidateGuests = () => {
    // The generated client builds the guest-list query key as a single-element
    // array containing the full URL path. An array of parts like
    // ["/api/organizations", 1, "events", eventId, "guests"] never matches it,
    // so previous invalidations were silent no-ops (deletes succeeded on the
    // server but the UI kept its cached list). Use predicate matching so we
    // invalidate every query whose key's first element is the guests URL,
    // regardless of any extra query params the generated key may append.
    const url = `/api/organizations/1/events/${eventId}/guests`;
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === url;
      },
    });
    queryClient.invalidateQueries({ queryKey: ["/api/organizations", 1, "events", eventId] });
  };

  const toggleGuestSelection = (id: number) => {
    setSelectedGuests(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filteredGuests) return;
    if (selectedGuests.size === filteredGuests.length) {
      setSelectedGuests(new Set());
    } else {
      setSelectedGuests(new Set(filteredGuests.map(g => g.id)));
    }
  };

  const onBulkDelete = async () => {
    setIsBulkDeleting(true);
    const ids = Array.from(selectedGuests);
    try {
      await Promise.all(ids.map(guestId =>
        new Promise<void>((resolve, reject) => {
          removeGuest.mutate({ orgId: 1, eventId, guestId }, { onSuccess: () => resolve(), onError: reject });
        })
      ));
      toast({ title: `${ids.length} guest${ids.length === 1 ? "" : "s"} removed` });
      setSelectedGuests(new Set());
      invalidateGuests();
    } catch {
      toast({ title: "Some guests could not be removed", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteOpen(false);
    }
  };

  const onAddGuest = (data: AddGuestFormValues) => {
    addGuest.mutate(
      { orgId: 1, eventId, data },
      {
        onSuccess: () => {
          toast({ title: "Guest added" });
          invalidateGuests();
          setIsAddGuestOpen(false);
          guestForm.reset();
        },
        onError: (err) => {
          toast({ title: "Failed to add guest", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const onRemoveGuest = () => {
    if (!guestToRemove) return;
    removeGuest.mutate(
      { orgId: 1, eventId, guestId: guestToRemove.id },
      {
        onSuccess: () => {
          toast({ title: `${guestToRemove.name} removed from guest list` });
          invalidateGuests();
          setGuestToRemove(null);
        },
        onError: (err) => {
          toast({ title: "Failed to remove guest", description: err.message, variant: "destructive" });
          setGuestToRemove(null);
        },
      }
    );
  };

  const onUpdateStatus = (guestId: number, status: "added" | "invited" | "confirmed" | "declined") => {
    updateGuest.mutate(
      { orgId: 1, eventId, guestId, data: { status } },
      {
        onSuccess: () => {
          toast({ title: `Guest marked as ${status}` });
          invalidateGuests();
        },
        onError: (err) => {
          toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const onLaunch = async () => {
    setIsLaunching(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/1/events/${eventId}/launch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Launch failed");
      toast({ title: "Event launched!", description: `${data.guestsInvited} guests invited` });
      setIsLaunchOpen(false);
      // Invalidate everything
      invalidateGuests();
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/1/events/${eventId}`] });
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && q.queryKey[0].includes("campaigns") });
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && q.queryKey[0].includes("social") });
    } catch (err) {
      toast({ title: "Launch failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsLaunching(false);
    }
  };

  const onTestEmail = async () => {
    if (!testEmailTo.includes("@")) return;
    const campaign = campaigns?.[0];
    if (!campaign) return;
    setIsSendingTest(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/1/campaigns/${campaign.id}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setTestEmailSent(true);
      toast({ title: "Test email sent!", description: `Sent to ${testEmailTo}` });
    } catch (err) {
      toast({ title: "Failed to send test", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const onSendReminder = async (reminderId: number) => {
    setSendingReminderId(reminderId);
    try {
      const res = await fetch(`${BASE}/api/organizations/1/events/${eventId}/reminders/${reminderId}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      toast({ title: "Reminder sent!", description: `Sent to ${data.recipientCount} guests` });
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && q.queryKey[0].includes("reminders") });
    } catch (err) {
      toast({ title: "Failed to send reminder", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSendingReminderId(null);
    }
  };

  const onCreateReminder = () => {
    const offsetHours = parseInt(newReminderOffset, 10);
    if (!newReminderSubject.trim() || !newReminderMessage.trim() || isNaN(offsetHours)) return;

    createReminder.mutate(
      {
        orgId: 1,
        eventId,
        data: {
          type: newReminderType,
          offsetHours,
          subject: newReminderSubject.trim(),
          message: newReminderMessage.trim(),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Reminder created" });
          setIsNewReminderOpen(false);
          setNewReminderType("before_event");
          setNewReminderOffset("24");
          setNewReminderSubject("");
          setNewReminderMessage("");
          queryClient.invalidateQueries({
            predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && q.queryKey[0].includes("reminders"),
          });
        },
        onError: (err) => {
          toast({ title: "Failed to create reminder", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const copyEventLink = () => {
    const link = event?.slug
      ? `${window.location.origin}${BASE}/e/${event.slug}`
      : `${window.location.origin}${BASE}/events/${eventId}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: "Link copied!", description: link });
    });
  };

  // Workflow stepper state
  const stepperData = {
    eventCreated: true,
    hasCampaign: (campaigns?.length ?? 0) > 0,
    testSent: testEmailSent,
    hasGuests: (guests?.length ?? 0) > 0,
    launched: event?.status === "published",
  };

  if (isEventLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
          <div className="grid grid-cols-4 gap-6">
            <Skeleton className="h-40 col-span-3" />
            <Skeleton className="h-40 col-span-1" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold">Event not found</h2>
          <Link href="/events">
            <Button variant="link" className="mt-4">Back to events</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const filteredGuests = guests?.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-12">
        <div>
          <Link href="/events">
            <Button variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to events
            </Button>
          </Link>
          
          <div className="flex flex-col md:flex-row gap-6 md:items-end justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="capitalize bg-primary/10 text-primary border-primary/20">
                  {event.status}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {event.category.replace('_', ' ')}
                </Badge>
              </div>
              <h1 className="text-4xl font-bold tracking-tight">{event.title}</h1>
              <p className="text-muted-foreground text-lg">{event.description}</p>
            </div>
            
            <div className="flex gap-3 shrink-0">
              <Button variant="outline" onClick={copyEventLink}>
                <Copy className="mr-2 h-4 w-4" /> Copy Link
              </Button>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
            </div>
          </div>
        </div>

        {event.coverImageUrl && (
          <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden relative">
            <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 text-white">
              <div className="flex items-center gap-2 font-medium bg-black/40 backdrop-blur-md px-4 py-2 rounded-full">
                <Calendar className="h-5 w-5 text-primary" />
                {format(parseISO(event.startDate), "MMMM d, yyyy • h:mm a")}
              </div>
              <div className="flex items-center gap-2 font-medium bg-black/40 backdrop-blur-md px-4 py-2 rounded-full">
                {event.type === 'remote' ? <Video className="h-5 w-5 text-accent" /> : <MapPin className="h-5 w-5 text-accent" />}
                <span className="truncate max-w-[200px] md:max-w-md">
                  {event.type === 'remote' ? event.onlineUrl || 'Online' : event.location || 'Location TBD'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Launch Checklist Stepper ── */}
        {event.status !== "published" && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="py-5 px-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-foreground">Launch Checklist</h3>
                <span className="text-xs text-muted-foreground">
                  {[stepperData.eventCreated, stepperData.hasCampaign, stepperData.testSent, stepperData.hasGuests, stepperData.launched].filter(Boolean).length} of 5 complete
                </span>
              </div>
              <div className="flex items-center gap-0">
                {[
                  { label: "Create Event", done: stepperData.eventCreated, action: null },
                  { label: "Design Campaign", done: stepperData.hasCampaign, action: !stepperData.hasCampaign ? () => window.location.assign(`${BASE}/campaigns/ai`) : null, actionLabel: "Create Campaign" },
                  { label: "Test Email", done: stepperData.testSent, action: stepperData.hasCampaign && !stepperData.testSent ? () => setIsTestEmailOpen(true) : null, actionLabel: "Send Test" },
                  { label: "Add Guests", done: stepperData.hasGuests, action: null },
                  { label: "Launch", done: stepperData.launched, action: stepperData.hasCampaign && stepperData.hasGuests && !stepperData.launched ? () => setIsLaunchOpen(true) : null, actionLabel: "Launch Event" },
                ].map((step, i, arr) => (
                  <div key={i} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1.5 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        step.done
                          ? "bg-green-500 text-white"
                          : "bg-muted text-muted-foreground border-2 border-muted-foreground/20"
                      }`}>
                        {step.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </div>
                      <span className={`text-[11px] font-medium text-center leading-tight ${step.done ? "text-green-600" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                      {step.action && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 mt-0.5"
                          onClick={step.action}
                        >
                          {step.actionLabel}
                        </Button>
                      )}
                    </div>
                    {i < arr.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-1 rounded-full ${step.done ? "bg-green-500" : "bg-muted"}`} />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3">
            <Tabs defaultValue="guests" className="w-full">
              <TabsList className="w-full md:w-auto flex flex-wrap h-auto p-1 mb-6">
                <TabsTrigger value="guests" className="flex-1 md:flex-none py-2.5">
                  <Users className="h-4 w-4 mr-2" /> Guests
                </TabsTrigger>
                <TabsTrigger value="campaigns" className="flex-1 md:flex-none py-2.5">
                  <Mail className="h-4 w-4 mr-2" /> Campaigns
                </TabsTrigger>
                <TabsTrigger value="social" className="flex-1 md:flex-none py-2.5">
                  <Share2 className="h-4 w-4 mr-2" /> Social
                </TabsTrigger>
                <TabsTrigger value="reminders" className="flex-1 md:flex-none py-2.5">
                  <Clock className="h-4 w-4 mr-2" /> Reminders
                </TabsTrigger>
              </TabsList>

              <TabsContent value="guests" className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border">
                  <div className="relative w-full sm:max-w-sm">
                    <Input 
                      placeholder="Search guests..." 
                      className="pl-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                          <Download className="mr-2 h-4 w-4" /> Import
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => setIsCSVImportOpen(true)}>
                          <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                          Import from CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsGHLImportOpen(true)}>
                          <Upload className="mr-2 h-4 w-4 text-orange-500" />
                          Import from GoHighLevel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Dialog open={isAddGuestOpen} onOpenChange={setIsAddGuestOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full sm:w-auto">
                          <Plus className="mr-2 h-4 w-4" /> Add Guest
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Guest</DialogTitle>
                          <DialogDescription>Add a guest manually to your event list.</DialogDescription>
                        </DialogHeader>
                        <Form {...guestForm}>
                          <form onSubmit={guestForm.handleSubmit(onAddGuest)} className="space-y-4">
                            <FormField
                              control={guestForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Full Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="John Doe" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={guestForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email Address</FormLabel>
                                  <FormControl>
                                    <Input placeholder="john@example.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={guestForm.control}
                              name="company"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Company (Optional)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Acme Corp" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="pt-4 flex justify-end">
                              <Button type="submit" disabled={addGuest.isPending}>
                                {addGuest.isPending ? "Adding..." : "Add Guest"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {selectedGuests.size > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {selectedGuests.size} guest{selectedGuests.size === 1 ? "" : "s"} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setSelectedGuests(new Set())}
                    >
                      Clear
                    </Button>
                    <div className="ml-auto flex gap-2">
                      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5">
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete {selectedGuests.size} selected
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {selectedGuests.size} guest{selectedGuests.size === 1 ? "" : "s"}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove {selectedGuests.size === 1 ? "this guest" : `these ${selectedGuests.size} guests`} from the event. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={onBulkDelete}
                              disabled={isBulkDeleting}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isBulkDeleting ? "Deleting…" : `Delete ${selectedGuests.size} guest${selectedGuests.size === 1 ? "" : "s"}`}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border bg-card overflow-hidden">
                  {isGuestsLoading ? (
                    <div className="p-8 text-center"><Skeleton className="h-8 w-full mb-4" /><Skeleton className="h-8 w-full" /></div>
                  ) : filteredGuests?.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium text-foreground mb-1">No guests found</p>
                      <p>Add your first guest or import a CSV to build your list.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="px-4 py-4 w-10">
                              <Checkbox
                                checked={!!filteredGuests?.length && selectedGuests.size === filteredGuests.length}
                                onCheckedChange={toggleSelectAll}
                                aria-label="Select all guests"
                              />
                            </th>
                            <th className="px-4 py-4 font-medium text-muted-foreground">Guest</th>
                            <th className="px-6 py-4 font-medium text-muted-foreground">Company</th>
                            <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                            <th className="px-6 py-4 font-medium text-muted-foreground">Invited At</th>
                            <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredGuests?.map((guest) => (
                            <tr key={guest.id} className={`hover:bg-muted/30 transition-colors group ${selectedGuests.has(guest.id) ? "bg-primary/5" : ""}`}>
                              <td className="px-4 py-4 w-10">
                                <Checkbox
                                  checked={selectedGuests.has(guest.id)}
                                  onCheckedChange={() => toggleGuestSelection(guest.id)}
                                  aria-label={`Select ${guest.name}`}
                                />
                              </td>
                              <td className="px-4 py-4">
                                <div className="font-medium text-foreground">{guest.name}</div>
                                <div className="text-muted-foreground text-xs">{guest.email}</div>
                              </td>
                              <td className="px-6 py-4 text-muted-foreground text-sm">{guest.company || '—'}</td>
                              <td className="px-6 py-4">
                                <Badge variant="outline" className={`capitalize text-xs ${
                                  guest.status === 'added'     ? 'bg-slate-500/10 text-slate-600 border-slate-500/20' :
                                  guest.status === 'confirmed' ? 'bg-green-500/10 text-green-700 border-green-500/20' :
                                  guest.status === 'invited'   ? 'bg-blue-500/10 text-blue-700 border-blue-500/20' :
                                  guest.status === 'declined'  ? 'bg-red-500/10 text-red-700 border-red-200' : ''
                                }`}>
                                  {guest.status === 'added'     && <UserPlus className="h-3 w-3 mr-1 inline" />}
                                  {guest.status === 'confirmed' && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                                  {guest.status === 'declined'  && <XCircle className="h-3 w-3 mr-1 inline" />}
                                  {guest.status === 'invited'   && <Clock3 className="h-3 w-3 mr-1 inline" />}
                                  {guest.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-muted-foreground text-xs">
                                {guest.status === 'added'
                                  ? '—'
                                  : guest.invitedAt
                                    ? format(parseISO(guest.invitedAt), "MMM d, yyyy")
                                    : '—'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    {guest.status !== 'confirmed' && (
                                      <DropdownMenuItem onClick={() => onUpdateStatus(guest.id, 'confirmed')}>
                                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                        Mark Confirmed
                                      </DropdownMenuItem>
                                    )}
                                    {guest.status !== 'invited' && (
                                      <DropdownMenuItem onClick={() => onUpdateStatus(guest.id, 'invited')}>
                                        <Clock3 className="mr-2 h-4 w-4 text-blue-600" />
                                        Mark Invited
                                      </DropdownMenuItem>
                                    )}
                                    {guest.status !== 'declined' && (
                                      <DropdownMenuItem onClick={() => onUpdateStatus(guest.id, 'declined')}>
                                        <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                                        Mark Declined
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setGuestToRemove({ id: guest.id, name: guest.name })}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remove Guest
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="campaigns">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Email Campaigns</CardTitle>
                        <CardDescription>Manage communications for this event</CardDescription>
                      </div>
                      <Link href="/campaigns/ai">
                        <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isCampaignsLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : campaigns?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No campaigns yet. Generate an AI campaign to get started.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {campaigns?.map(campaign => (
                          <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div>
                              <div className="font-medium">{campaign.subject}</div>
                              <div className="text-sm text-muted-foreground capitalize flex gap-2 mt-1">
                                <Badge variant="secondary" className="text-[10px]">{campaign.type}</Badge>
                                <span>{campaign.status}</span>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">View</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="social">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Social Media Posts</CardTitle>
                        <CardDescription>Schedule content to promote this event</CardDescription>
                      </div>
                      <Link href="/social">
                        <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Post</Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isSocialLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : socialPosts?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No social posts scheduled. Start promoting your event.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {socialPosts?.map(post => (
                          <div key={post.id} className="p-4 border rounded-lg flex flex-col justify-between">
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className="capitalize">{post.platform}</Badge>
                                <span className="text-xs text-muted-foreground capitalize">{post.status}</span>
                              </div>
                              <p className="text-sm line-clamp-3">{post.content}</p>
                            </div>
                            <Button variant="ghost" size="sm" className="w-full justify-center">View Post</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="reminders">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Automated Reminders</CardTitle>
                        <CardDescription>Schedule emails to keep your guests informed before and after the event</CardDescription>
                      </div>
                      <Dialog open={isNewReminderOpen} onOpenChange={setIsNewReminderOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Reminder</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Create Reminder</DialogTitle>
                            <DialogDescription>Set up an automated email to send to your guests.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            {/* Timing: when to send */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-sm font-medium">When to send</label>
                                <Select value={newReminderType} onValueChange={(v) => setNewReminderType(v as typeof newReminderType)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="before_event">Before event</SelectItem>
                                    <SelectItem value="after_event">After event</SelectItem>
                                    <SelectItem value="custom">Custom time</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-sm font-medium">Hours offset</label>
                                <Select value={newReminderOffset} onValueChange={setNewReminderOffset}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1 hour</SelectItem>
                                    <SelectItem value="2">2 hours</SelectItem>
                                    <SelectItem value="4">4 hours</SelectItem>
                                    <SelectItem value="12">12 hours</SelectItem>
                                    <SelectItem value="24">1 day (24h)</SelectItem>
                                    <SelectItem value="48">2 days (48h)</SelectItem>
                                    <SelectItem value="72">3 days (72h)</SelectItem>
                                    <SelectItem value="168">1 week (168h)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                              {newReminderType === "before_event"
                                ? `This reminder will be sent ${newReminderOffset === "24" ? "1 day" : newReminderOffset === "48" ? "2 days" : newReminderOffset === "72" ? "3 days" : newReminderOffset === "168" ? "1 week" : `${newReminderOffset} hours`} before the event starts.`
                                : newReminderType === "after_event"
                                  ? `This reminder will be sent ${newReminderOffset === "24" ? "1 day" : newReminderOffset === "48" ? "2 days" : `${newReminderOffset} hours`} after the event ends.`
                                  : `This reminder will be sent ${newReminderOffset} hours from when you manually trigger it.`
                              }
                            </div>

                            {/* Email content */}
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Email subject</label>
                              <Input
                                placeholder="e.g. Reminder: Don't forget about the event tomorrow!"
                                value={newReminderSubject}
                                onChange={(e) => setNewReminderSubject(e.target.value)}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Email body</label>
                              <Textarea
                                placeholder="Write the message your guests will receive..."
                                value={newReminderMessage}
                                onChange={(e) => setNewReminderMessage(e.target.value)}
                                rows={6}
                                className="resize-none"
                              />
                              <p className="text-xs text-muted-foreground">
                                This will be sent to all invited and confirmed guests.
                              </p>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="outline" onClick={() => setIsNewReminderOpen(false)}>Cancel</Button>
                              <Button
                                onClick={onCreateReminder}
                                disabled={createReminder.isPending || !newReminderSubject.trim() || !newReminderMessage.trim()}
                              >
                                {createReminder.isPending ? (
                                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...</>
                                ) : (
                                  "Create Reminder"
                                )}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isRemindersLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : reminders?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-10 w-10 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium text-foreground mb-1">No reminders yet</p>
                        <p>Set up automated emails to keep your guests in the loop.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reminders?.map(reminder => (
                          <div key={reminder.id} className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">{reminder.subject}</div>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{reminder.message}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {reminder.offsetHours >= 24
                                      ? `${Math.floor(reminder.offsetHours / 24)} day${Math.floor(reminder.offsetHours / 24) !== 1 ? "s" : ""}`
                                      : `${reminder.offsetHours} hour${reminder.offsetHours !== 1 ? "s" : ""}`
                                    } {reminder.type.replace("_", " ")}
                                  </span>
                                  {reminder.sentAt && (
                                    <span>Sent {format(parseISO(reminder.sentAt), "MMM d, yyyy h:mm a")}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant={reminder.status === 'sent' ? 'default' : 'outline'} className="capitalize">
                                  {reminder.status}
                                </Badge>
                                {reminder.status !== 'sent' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    disabled={sendingReminderId === reminder.id}
                                    onClick={() => onSendReminder(reminder.id)}
                                  >
                                    {sendingReminderId === reminder.id ? (
                                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Sending...</>
                                    ) : (
                                      <><Send className="h-3 w-3 mr-1" /> Send Now</>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Event Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Confirmed Guests</span>
                    <span className="font-medium">{event.confirmedCount} / {event.capacity || '∞'}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: event.capacity ? `${Math.min(100, (event.confirmedCount / event.capacity) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <div className="text-2xl font-bold">{event.guestCount}</div>
                    <div className="text-xs text-muted-foreground">Total Invited</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">0</div>
                    <div className="text-xs text-muted-foreground">Waitlisted</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/campaigns/ai">
                  <Button variant="outline" className="w-full justify-start text-left">
                    <Mail className="h-4 w-4 mr-2 text-primary" />
                    Send Announcement
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start text-left">
                  <Share2 className="h-4 w-4 mr-2 text-accent" />
                  Promote on Social
                </Button>
                <Button variant="outline" className="w-full justify-start text-left">
                  <Activity className="h-4 w-4 mr-2 text-green-500" />
                  View Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={!!guestToRemove} onOpenChange={(open) => !open && setGuestToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove guest?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{guestToRemove?.name}</strong> will be removed from this event's guest list. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemoveGuest}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CSVImportModal
        orgId={1}
        eventId={eventId}
        open={isCSVImportOpen}
        onClose={() => setIsCSVImportOpen(false)}
      />

      <GHLImportModal
        orgId={1}
        open={isGHLImportOpen}
        onClose={() => setIsGHLImportOpen(false)}
        initialEventId={eventId}
      />

      {/* Launch Confirmation Dialog */}
      <AlertDialog open={isLaunchOpen} onOpenChange={setIsLaunchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Launch Event
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>This will:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Send the campaign email to all <strong>{guests?.length ?? 0}</strong> guests</li>
                  <li>Auto-create a LinkedIn announcement post</li>
                  <li>Mark the event as <strong>published</strong></li>
                  <li>Update all guest statuses to <strong>invited</strong></li>
                </ul>
                <p className="text-muted-foreground">This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onLaunch}
              disabled={isLaunching}
              className="bg-gradient-to-r from-primary to-accent border-0 text-white"
            >
              {isLaunching ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Launching...</>
              ) : (
                <><Rocket className="h-4 w-4 mr-2" /> Launch Event</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Email Dialog */}
      <Dialog open={isTestEmailOpen} onOpenChange={(o) => { if (!o) { setIsTestEmailOpen(false); setTestEmailTo(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-primary" />
              Send Test Email
            </DialogTitle>
            <DialogDescription>
              Send the campaign email to yourself to preview it before launching.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Send to</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setIsTestEmailOpen(false); setTestEmailTo(""); }}>
                Cancel
              </Button>
              <Button
                onClick={onTestEmail}
                disabled={isSendingTest || !testEmailTo.includes("@")}
                className="bg-gradient-to-r from-primary to-accent border-0 text-white"
              >
                {isSendingTest ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Send Test</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
