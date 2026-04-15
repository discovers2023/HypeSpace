import { useRef, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetEvent,
  useUpdateEvent,
  useListGuests,
  useAddGuest,
  useRemoveGuest,
  useUpdateGuest,
  useListCampaigns,
  useListSocialPosts,
  useListReminders,
  useCreateReminder,
  useDeleteEvent,
  useGetRecentActivity,
  type ActivityItem,
} from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { format, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calendar,
  MapPin,
  Users,
  Mail,
  Share2,
  ArrowLeft,
  Plus,
  Clock,
  Video,
  Settings,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock3,
  Search,
  Activity,
  Upload,
  FileSpreadsheet,
  Download,
  UserPlus,
  Copy,
  Rocket,
  Send,
  TestTube,
  Loader2,
  ImagePlus,
  Tag,
  Repeat,
  Globe,
  BarChart2,
  ClipboardCheck,
  Layers,
  Lock,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
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
import { BulkEmailDialog, type BulkRecipientMode } from "@/components/events/bulk-email-dialog";
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
import { Progress } from "@/components/ui/progress";
import { CampaignCreationModal } from "@/components/campaigns/campaign-creation-modal";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const ORG_ID = 1;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const addGuestSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  company: z.string().optional(),
});

type AddGuestFormValues = z.infer<typeof addGuestSchema>;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  published: "bg-green-500/10 text-green-700 border-green-500/30",
  deleted: "bg-red-500/10 text-red-500 border-red-500/30",
};

const GUEST_STATUS_STYLES: Record<string, string> = {
  added: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  invited: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  confirmed: "bg-green-500/10 text-green-700 border-green-500/20",
  maybe: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  declined: "bg-red-500/10 text-red-700 border-red-200",
  attended: "bg-purple-500/10 text-purple-700 border-purple-500/20",
};

const GUEST_STATUS_LABELS: Record<string, string> = {
  added: "Pending",
  invited: "Invite Sent",
  confirmed: "RSVP — Yes",
  maybe: "RSVP — Maybe",
  declined: "RSVP — No",
  attended: "Attended",
  waitlisted: "Waitlisted",
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: "One-time",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  // ── Data fetching ──────────────────────────────────────────────────────
  const { data: event, isLoading: isEventLoading } = useGetEvent(ORG_ID, eventId, {
    query: { enabled: !!eventId },
  });
  const { data: guests, isLoading: isGuestsLoading } = useListGuests(
    ORG_ID,
    eventId,
    undefined,
    { query: { enabled: !!eventId } },
  );
  const { data: campaigns, isLoading: isCampaignsLoading } = useListCampaigns(
    ORG_ID,
    { eventId },
    { query: { enabled: !!eventId } },
  );
  const { data: socialPosts, isLoading: isSocialLoading } = useListSocialPosts(
    ORG_ID,
    { eventId },
    { query: { enabled: !!eventId } },
  );
  const { data: reminders, isLoading: isRemindersLoading } = useListReminders(
    ORG_ID,
    eventId,
    { query: { enabled: !!eventId } },
  );

  // ── Mutations ──────────────────────────────────────────────────────────
  const addGuest = useAddGuest();
  const removeGuest = useRemoveGuest();
  const updateGuest = useUpdateGuest();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const createReminder = useCreateReminder();

  // ── Local UI state ─────────────────────────────────────────────────────
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [guestToRemove, setGuestToRemove] = useState<{ id: number; name: string } | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<Set<number>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "yes" | "no" | "maybe" | "invited" | "not_responded" | "waitlisted">("all");
  const [bulkEmail, setBulkEmail] = useState<{ open: boolean; recipient: BulkRecipientMode; label: string; count: number } | null>(null);
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [isGHLImportOpen, setIsGHLImportOpen] = useState(false);
  const [isLaunchOpen, setIsLaunchOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);
  const [isDeleteEventOpen, setIsDeleteEventOpen] = useState(false);
  const [isNewReminderOpen, setIsNewReminderOpen] = useState(false);
  const [newReminderType, setNewReminderType] = useState<"before_event" | "after_event" | "custom">(
    "before_event",
  );
  const [newReminderOffset, setNewReminderOffset] = useState("24");
  const [newReminderSubject, setNewReminderSubject] = useState("");
  const [newReminderMessage, setNewReminderMessage] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [mainTab, setMainTab] = useState("guests");

  // ── Form ───────────────────────────────────────────────────────────────
  const guestForm = useForm<AddGuestFormValues>({
    resolver: zodResolver(addGuestSchema),
    defaultValues: { name: "", email: "", company: "" },
  });

  // ── Invalidation helpers ───────────────────────────────────────────────
  const invalidateGuests = () => {
    const url = `/api/organizations/${ORG_ID}/events/${eventId}/guests`;
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === url;
      },
    });
    queryClient.invalidateQueries({
      queryKey: [`/api/organizations/${ORG_ID}/events/${eventId}`],
    });
  };

  const invalidateEvent = () => {
    queryClient.invalidateQueries({
      queryKey: [`/api/organizations/${ORG_ID}/events/${eventId}`],
    });
  };

  // ── Guest selection ────────────────────────────────────────────────────
  const segmentMatches = (status: string, s: typeof statusFilter) => {
    if (s === "all") return true;
    if (s === "yes") return status === "confirmed";
    if (s === "no") return status === "declined";
    if (s === "maybe") return status === "maybe";
    if (s === "invited") return status === "invited";
    if (s === "not_responded") return status === "invited" || status === "added";
    if (s === "waitlisted") return status === "waitlisted";
    return true;
  };
  const filteredGuests = guests?.filter(
    (g) =>
      segmentMatches(g.status, statusFilter) &&
      (g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.email.toLowerCase().includes(searchTerm.toLowerCase())),
  );
  const segmentCounts = {
    all: guests?.length ?? 0,
    yes: guests?.filter((g) => g.status === "confirmed").length ?? 0,
    no: guests?.filter((g) => g.status === "declined").length ?? 0,
    maybe: guests?.filter((g) => g.status === "maybe").length ?? 0,
    invited: guests?.filter((g) => g.status === "invited").length ?? 0,
    not_responded: guests?.filter((g) => g.status === "invited" || g.status === "added").length ?? 0,
    waitlisted: guests?.filter((g) => g.status === "waitlisted").length ?? 0,
  };
  const segmentLabels: Record<typeof statusFilter, string> = {
    all: "All guests",
    yes: "RSVP — Yes",
    no: "RSVP — No",
    maybe: "RSVP — Maybe",
    invited: "Invited",
    not_responded: "Not responded",
    waitlisted: "Waitlisted",
  };

  const toggleGuestSelection = (guestId: number) => {
    setSelectedGuests((prev) => {
      const next = new Set(prev);
      next.has(guestId) ? next.delete(guestId) : next.add(guestId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filteredGuests) return;
    if (selectedGuests.size === filteredGuests.length) {
      setSelectedGuests(new Set());
    } else {
      setSelectedGuests(new Set(filteredGuests.map((g) => g.id)));
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────

  const onImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      toast({ title: "Image too large", description: "Max file size is 5 MB.", variant: "destructive" });
      return;
    }
    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateEvent.mutate(
        { orgId: ORG_ID, eventId, data: { coverImageUrl: dataUrl } },
        {
          onSuccess: () => {
            toast({ title: "Cover image updated" });
            invalidateEvent();
            setIsUploadingImage(false);
          },
          onError: (err) => {
            toast({ title: "Failed to update image", description: err.message, variant: "destructive" });
            setIsUploadingImage(false);
          },
        },
      );
    };
    reader.onerror = () => {
      toast({ title: "Failed to read file", variant: "destructive" });
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const onBulkDelete = async () => {
    setIsBulkDeleting(true);
    const ids = Array.from(selectedGuests);
    try {
      await Promise.all(
        ids.map(
          (guestId) =>
            new Promise<void>((resolve, reject) => {
              removeGuest.mutate(
                { orgId: ORG_ID, eventId, guestId },
                { onSuccess: () => resolve(), onError: reject },
              );
            }),
        ),
      );
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
    const isAtCapacity = event?.capacity != null && (event.guestCount ?? 0) >= event.capacity;
    addGuest.mutate(
      { orgId: ORG_ID, eventId, data },
      {
        onSuccess: (newGuest) => {
          if (isAtCapacity) {
            updateGuest.mutate(
              { orgId: ORG_ID, eventId, guestId: newGuest.id, data: { status: "waitlisted" } },
              {
                onSuccess: () => {
                  toast({ title: "Event is at capacity — guest added to waitlist" });
                  invalidateGuests();
                },
                onError: () => {
                  toast({ title: "Guest added" });
                  invalidateGuests();
                },
              },
            );
          } else {
            toast({ title: "Guest added" });
            invalidateGuests();
          }
          setIsAddGuestOpen(false);
          guestForm.reset();
        },
        onError: (err) => {
          toast({ title: "Failed to add guest", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const onRemoveGuest = () => {
    if (!guestToRemove) return;
    removeGuest.mutate(
      { orgId: ORG_ID, eventId, guestId: guestToRemove.id },
      {
        onSuccess: () => {
          toast({ title: `${guestToRemove.name} removed from guest list` });
          const firstWaitlisted = guests?.find((g) => g.status === "waitlisted" && g.id !== guestToRemove.id);
          if (firstWaitlisted) {
            updateGuest.mutate(
              { orgId: ORG_ID, eventId, guestId: firstWaitlisted.id, data: { status: "added" } },
              {
                onSuccess: () => {
                  toast({ title: `${firstWaitlisted.name} promoted from waitlist` });
                  invalidateGuests();
                },
                onError: () => invalidateGuests(),
              },
            );
          } else {
            invalidateGuests();
          }
          setGuestToRemove(null);
        },
        onError: (err) => {
          toast({ title: "Failed to remove guest", description: err.message, variant: "destructive" });
          setGuestToRemove(null);
        },
      },
    );
  };

  const onUpdateStatus = (
    guestId: number,
    status: "added" | "invited" | "confirmed" | "maybe" | "declined" | "waitlisted",
  ) => {
    updateGuest.mutate(
      { orgId: ORG_ID, eventId, guestId, data: { status } },
      {
        onSuccess: () => {
          toast({ title: `Guest marked as ${status}` });
          if (status === "declined") {
            const firstWaitlisted = guests?.find((g) => g.status === "waitlisted" && g.id !== guestId);
            if (firstWaitlisted) {
              updateGuest.mutate(
                { orgId: ORG_ID, eventId, guestId: firstWaitlisted.id, data: { status: "added" } },
                {
                  onSuccess: () => {
                    toast({ title: `${firstWaitlisted.name} promoted from waitlist` });
                    invalidateGuests();
                  },
                  onError: () => invalidateGuests(),
                },
              );
              return;
            }
          }
          invalidateGuests();
        },
        onError: (err) => {
          toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const onLaunch = async () => {
    setIsLaunching(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/events/${eventId}/launch`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Launch failed");
      toast({ title: "Event launched!", description: `${data.guestsInvited} guests invited` });
      setIsLaunchOpen(false);
      invalidateGuests();
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/events/${eventId}`] });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          typeof q.queryKey[0] === "string" &&
          q.queryKey[0].includes("campaigns"),
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          typeof q.queryKey[0] === "string" &&
          q.queryKey[0].includes("social"),
      });
    } catch (err) {
      toast({
        title: "Launch failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
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
      const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/campaigns/${campaign.id}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setTestEmailSent(true);
      if (data.previewUrl) {
        toast({
          title: "Test email sent (preview only)",
          description: `No SMTP configured — open the Ethereal preview: ${data.previewUrl}`,
        });
        try { window.open(data.previewUrl, "_blank", "noopener"); } catch { /* noop */ }
      } else {
        toast({ title: "Test email sent!", description: `Sent to ${testEmailTo}` });
      }
    } catch (err) {
      toast({
        title: "Failed to send test",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const onSendReminder = async (reminderId: number) => {
    setSendingReminderId(reminderId);
    try {
      const res = await fetch(
        `${BASE}/api/organizations/${ORG_ID}/events/${eventId}/reminders/${reminderId}/send`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      toast({ title: "Reminder sent!", description: `Sent to ${data.recipientCount} guests` });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          typeof q.queryKey[0] === "string" &&
          q.queryKey[0].includes("reminders"),
      });
    } catch (err) {
      toast({
        title: "Failed to send reminder",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSendingReminderId(null);
    }
  };

  const onCreateReminder = () => {
    const offsetHours = parseInt(newReminderOffset, 10);
    if (!newReminderSubject.trim() || !newReminderMessage.trim() || isNaN(offsetHours)) return;
    createReminder.mutate(
      {
        orgId: ORG_ID,
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
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              typeof q.queryKey[0] === "string" &&
              q.queryKey[0].includes("reminders"),
          });
        },
        onError: (err) => {
          toast({
            title: "Failed to create reminder",
            description: err.message,
            variant: "destructive",
          });
        },
      },
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

  const exportGuestCSV = () => {
    if (!guests?.length) {
      toast({ title: "No guests to export" });
      return;
    }
    const headers = ["Name", "Email", "Company", "Status", "Invited At"];
    const rows = guests.map((g) => [
      g.name,
      g.email,
      g.company || "",
      GUEST_STATUS_LABELS[g.status] ?? g.status,
      g.invitedAt ? format(parseISO(g.invitedAt), "MMM d, yyyy") : "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event?.title ?? "guests"}-guests.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Guest list exported", description: `${guests.length} guests saved to CSV` });
  };

  const onDuplicateEvent = async () => {
    setIsDuplicating(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/events/${eventId}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Duplication failed");
      toast({ title: "Event duplicated!", description: "A draft copy has been created." });
      setLocation(`/events/${data.id}`);
    } catch (err) {
      toast({
        title: "Failed to duplicate event",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  const onCheckInGuest = (guestId: number) => {
    updateGuest.mutate(
      { orgId: ORG_ID, eventId, guestId, data: { status: "attended" } },
      {
        onSuccess: () => {
          toast({ title: "Guest checked in!" });
          invalidateGuests();
        },
        onError: (err) => {
          toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const onBulkCheckIn = async () => {
    const ids = Array.from(selectedGuests);
    try {
      await Promise.all(
        ids.map(
          (gId) =>
            new Promise<void>((resolve, reject) => {
              updateGuest.mutate(
                { orgId: ORG_ID, eventId, guestId: gId, data: { status: "attended" } },
                { onSuccess: () => resolve(), onError: reject },
              );
            }),
        ),
      );
      toast({ title: `${ids.length} guest${ids.length === 1 ? "" : "s"} checked in` });
      setSelectedGuests(new Set());
      invalidateGuests();
    } catch {
      toast({ title: "Some check-ins failed", variant: "destructive" });
    }
  };

  // ── Stepper data ───────────────────────────────────────────────────────
  const hasCampaign = (campaigns?.length ?? 0) > 0;
  const hasGuests = (guests?.length ?? 0) > 0;
  const readyToLaunch = hasCampaign && hasGuests;
  const completedSteps = [
    true, // Create Event
    hasCampaign,
    testEmailSent,
    hasGuests,
    readyToLaunch,
    event?.status === "published",
  ].filter(Boolean).length;

  const stepperItems = [
    {
      label: "Create Event",
      done: true,
      action: event?.status !== "published" ? () => window.location.assign(`${BASE}/events/${eventId}/edit`) : null,
      actionLabel: "Edit",
    },
    {
      label: "Design Campaign",
      done: hasCampaign,
      action: event?.status !== "published" ? () => setIsCreateCampaignOpen(true) : null,
      actionLabel: hasCampaign ? "Edit Campaign" : "Create Campaign",
    },
    {
      label: "Test Email",
      done: testEmailSent,
      action: hasCampaign ? () => setIsTestEmailOpen(true) : null,
      actionLabel: "Send Test",
    },
    {
      label: "Add Guests",
      done: hasGuests,
      action: event?.status !== "published" ? () => setMainTab("guests") : null,
      actionLabel: hasGuests ? "Manage Guests" : "Add Guests",
    },
    {
      label: "Review",
      done: readyToLaunch,
      action: readyToLaunch && event?.status !== "published" ? () => setIsLaunchOpen(true) : null,
      actionLabel: "Review",
    },
    { label: "Launch", done: event?.status === "published", action: null, actionLabel: "" },
  ];


  // ── Capacity progress ──────────────────────────────────────────────────
  const capacityPercent = event?.capacity
    ? Math.min(100, Math.round(((event.confirmedCount ?? 0) / event.capacity) * 100))
    : 0;

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (isEventLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-6xl mx-auto">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-48 md:col-span-2" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────
  if (!event) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold">Event not found</h2>
          <Link href="/events">
            <Button variant="link" className="mt-4">
              Back to events
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  // =====================================================================
  // RENDER
  // =====================================================================
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 pb-12 max-w-6xl mx-auto">
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/events">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight truncate">{event.title}</h1>
            <Badge
              variant="outline"
              className={`capitalize shrink-0 ${STATUS_STYLES[event.status] ?? ""}`}
            >
              {event.status}
            </Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={copyEventLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation(`/events/${eventId}/edit`)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Event
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDuplicateEvent}
                  disabled={isDuplicating}
                >
                  {isDuplicating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Layers className="mr-2 h-4 w-4" />
                  )}
                  Duplicate Event
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setIsDeleteEventOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Hero / cover image ───────────────────────────────────────── */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onImageUpload}
        />

        {event.coverImageUrl ? (
          <button
            type="button"
            className="relative w-full h-56 md:h-72 rounded-2xl overflow-hidden group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
          >
            <img
              src={event.coverImageUrl}
              alt={event.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {isUploadingImage ? (
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-white">
                  <ImagePlus className="h-8 w-8" />
                  <span className="text-sm font-medium">Change cover image</span>
                </div>
              )}
            </div>
            {/* Date & location pills on the image */}
            <div className="absolute bottom-5 left-5 right-5 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
                <Calendar className="h-4 w-4 text-primary" />
                {format(parseISO(event.startDate), "MMMM d, yyyy 'at' h:mm a")}
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-white bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
                {event.type === "remote" ? (
                  <Video className="h-4 w-4 text-blue-400" />
                ) : (
                  <MapPin className="h-4 w-4 text-red-400" />
                )}
                <span className="truncate max-w-[220px]">
                  {event.type === "remote"
                    ? event.onlineUrl || "Online"
                    : event.location || "Location TBD"}
                </span>
              </div>
            </div>
          </button>
        ) : (
          <button
            type="button"
            className="relative w-full h-48 md:h-64 rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-10 w-10 text-muted-foreground/50" />
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">
                    Click to upload a cover image
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG up to 5 MB</p>
                </div>
              </>
            )}
          </button>
        )}

        {/* ── Event info card (two-column) ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left column - details */}
          <Card className="md:col-span-2">
            <CardContent className="pt-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold">{event.title}</h2>
                {event.description && (
                  <p className="text-muted-foreground mt-2 leading-relaxed">{event.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date & time */}
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {format(parseISO(event.startDate), "EEEE, MMMM d, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(event.startDate), "h:mm a")}
                      {event.endDate && ` - ${format(parseISO(event.endDate), "h:mm a")}`}
                      {event.timezone && ` (${event.timezone})`}
                    </p>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-orange-500/10 p-2 shrink-0">
                    {event.type === "remote" ? (
                      <Video className="h-4 w-4 text-blue-600" />
                    ) : (
                      <MapPin className="h-4 w-4 text-orange-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {event.type === "remote"
                        ? "Online Event"
                        : event.location || "Location TBD"}
                    </p>
                    {event.type === "remote" && event.onlineUrl && (
                      <a
                        href={event.onlineUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-0.5 inline-block"
                      >
                        {event.onlineUrl}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="secondary" className="capitalize gap-1.5">
                  <Tag className="h-3 w-3" />
                  {event.type}
                </Badge>
                <Badge variant="secondary" className="capitalize gap-1.5">
                  <Globe className="h-3 w-3" />
                  {event.category.replace("_", " ")}
                </Badge>
                {event.recurrence && event.recurrence !== "none" && (
                  <Badge variant="outline" className="capitalize gap-1.5 border-violet-500/30 text-violet-700 bg-violet-500/10">
                    <Repeat className="h-3 w-3" />
                    {RECURRENCE_LABELS[event.recurrence] ?? event.recurrence}
                  </Badge>
                )}
                {(!event.recurrence || event.recurrence === "none") && (
                  <Badge variant="outline" className="capitalize gap-1.5 text-muted-foreground">
                    <Repeat className="h-3 w-3" />
                    One-time
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right column - quick stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{event.guestCount ?? 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Guests</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {event.confirmedCount ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Confirmed</div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="font-medium">
                    {event.confirmedCount ?? 0} / {event.capacity ?? "--"}
                  </span>
                </div>
                <Progress value={event.capacity ? capacityPercent : 0} className="h-2" />
                {event.capacity && capacityPercent >= 90 && (
                  <p className="text-xs text-amber-600 mt-1">Almost at capacity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Launch Checklist Stepper (draft only) ────────────────────── */}
        {event.status === "draft" && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="py-5 px-6">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h3 className="font-semibold text-sm">Launch Checklist</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {completedSteps} of 6 complete · pick up where you left off
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {readyToLaunch ? (
                    <Button size="sm" onClick={() => setIsLaunchOpen(true)} className="gap-1.5">
                      <Rocket className="h-3.5 w-3.5" />
                      Review &amp; Launch
                    </Button>
                  ) : (
                    <Button size="sm" className="gap-1.5" onClick={() => {
                      if (!hasCampaign) setIsCreateCampaignOpen(true);
                      else if (!hasGuests) setMainTab("guests");
                    }}>
                      Continue setup
                      <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0">
                {stepperItems.map((step, i, arr) => {
                  const clickable = !!step.action;
                  return (
                    <div key={i} className="flex items-center flex-1">
                      <div className="flex flex-col items-center gap-1.5 flex-1">
                        <button
                          type="button"
                          onClick={clickable ? step.action! : undefined}
                          disabled={!clickable}
                          title={clickable ? step.actionLabel : step.label}
                          className={`flex flex-col items-center gap-1.5 rounded-lg p-1 -m-1 transition-colors ${
                            clickable ? "cursor-pointer hover:bg-muted" : "cursor-default"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              step.done
                                ? "bg-green-500 text-white"
                                : "bg-muted text-muted-foreground border-2 border-muted-foreground/20"
                            }`}
                          >
                            {step.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                          </div>
                          <span
                            className={`text-[11px] font-medium text-center leading-tight ${
                              step.done ? "text-green-600" : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </span>
                        </button>
                      </div>
                      {i < arr.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 mx-1 rounded-full ${
                            step.done ? "bg-green-500" : "bg-muted"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Inline back / preview / next row */}
              <div className="flex items-center justify-between mt-4 gap-2">
                {(() => {
                  const actionable = stepperItems.filter((s) => s.action);
                  const firstIdx = stepperItems.findIndex((s) => !s.done && s.action);
                  const activeIdx = firstIdx === -1 ? stepperItems.findIndex((s) => s.action) : firstIdx;
                  const active = stepperItems[activeIdx];
                  const inActionable = actionable.findIndex((s) => s === active);
                  const prev = inActionable > 0 ? actionable[inActionable - 1] : null;
                  const next = inActionable >= 0 && inActionable < actionable.length - 1 ? actionable[inActionable + 1] : null;
                  return (
                    <>
                      <Button size="sm" variant="outline" onClick={prev?.action ?? undefined} disabled={!prev} className="gap-1.5">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        {prev ? prev.label : "Back"}
                      </Button>
                      <div className="flex items-center gap-2">
                        {hasCampaign && campaigns?.[0] && (
                          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setIsLaunchOpen(true)}>
                            <Mail className="h-3.5 w-3.5" />
                            Preview campaign
                          </Button>
                        )}
                        {active?.action && (
                          <Button size="sm" variant="default" onClick={active.action} className="gap-1.5">
                            {active.actionLabel}
                          </Button>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={next?.action ?? undefined} disabled={!next} className="gap-1.5">
                        {next ? next.label : "Next"}
                        <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                      </Button>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Live Banner ─────────────────────────────────────────────── */}
        {event.status === "published" && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="h-9 w-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
              <Rocket className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-green-800 text-sm">This event is live</h3>
                <Badge className="bg-green-500 text-white text-xs border-0">Live</Badge>
              </div>
              <p className="text-xs text-green-700">
                Invitations have been sent. You can still: <strong>add/remove guests</strong>, <strong>update location or meeting link</strong>, <strong>send reminders</strong>, or <strong>cancel the event</strong>. Campaign email content is locked.
              </p>
            </div>
          </div>
        )}

        {/* ── Tabbed content ───────────────────────────────────────────── */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="w-full md:w-auto flex flex-wrap h-auto p-1 mb-6">
            <TabsTrigger value="guests" className="flex-1 md:flex-none py-2.5">
              <Users className="h-4 w-4 mr-2" />
              Guests
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex-1 md:flex-none py-2.5">
              <Mail className="h-4 w-4 mr-2" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="social" className="flex-1 md:flex-none py-2.5">
              <Share2 className="h-4 w-4 mr-2" />
              Social
            </TabsTrigger>
            <TabsTrigger value="reminders" className="flex-1 md:flex-none py-2.5">
              <Clock className="h-4 w-4 mr-2" />
              Reminders
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1 md:flex-none py-2.5">
              <BarChart2 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 md:flex-none py-2.5">
              <Activity className="h-4 w-4 mr-2" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* ── Guests Tab ─────────────────────────────────────────────── */}
          <TabsContent value="guests" className="space-y-4">
            {/* Toolbar */}
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
                <Button variant="outline" className="w-full sm:w-auto" onClick={exportGuestCSV} disabled={!guests?.length}>
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                  Export CSV
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                      <Download className="mr-2 h-4 w-4" />
                      Import
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
                      <Plus className="mr-2 h-4 w-4" />
                      Add Guest
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Guest</DialogTitle>
                      <DialogDescription>
                        Add a guest manually to your event list.
                      </DialogDescription>
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

            {/* Segment pills */}
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "yes", "maybe", "no", "invited", "not_responded", "waitlisted"] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={statusFilter === s ? "default" : "outline"}
                  className="h-8 text-xs gap-1.5"
                  onClick={() => { setStatusFilter(s); setSelectedGuests(new Set()); }}
                >
                  {segmentLabels[s]}
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{segmentCounts[s]}</Badge>
                </Button>
              ))}
              <div className="ml-auto">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  disabled={segmentCounts[statusFilter] === 0}
                  onClick={() => setBulkEmail({
                    open: true,
                    recipient: { mode: "segment", segment: statusFilter },
                    label: segmentLabels[statusFilter],
                    count: segmentCounts[statusFilter],
                  })}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email {segmentLabels[statusFilter].toLowerCase()}
                </Button>
              </div>
            </div>

            {/* Bulk selection bar */}
            {selectedGuests.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                <span className="text-sm font-medium">
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
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50"
                    onClick={onBulkCheckIn}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Check In {selectedGuests.size} selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setBulkEmail({
                      open: true,
                      recipient: { mode: "ids", guestIds: Array.from(selectedGuests) },
                      label: `${selectedGuests.size} selected`,
                      count: selectedGuests.size,
                    })}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email {selectedGuests.size} selected
                  </Button>
                  <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5">
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete {selectedGuests.size} selected
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete {selectedGuests.size} guest
                          {selectedGuests.size === 1 ? "" : "s"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove{" "}
                          {selectedGuests.size === 1
                            ? "this guest"
                            : `these ${selectedGuests.size} guests`}{" "}
                          from the event. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={onBulkDelete}
                          disabled={isBulkDeleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isBulkDeleting
                            ? "Deleting..."
                            : `Delete ${selectedGuests.size} guest${selectedGuests.size === 1 ? "" : "s"}`}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* Guest table */}
            <div className="rounded-xl border bg-card overflow-hidden">
              {isGuestsLoading ? (
                <div className="p-8 text-center">
                  <Skeleton className="h-8 w-full mb-4" />
                  <Skeleton className="h-8 w-full" />
                </div>
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
                            checked={
                              !!filteredGuests?.length &&
                              selectedGuests.size === filteredGuests.length
                            }
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all guests"
                          />
                        </th>
                        <th className="px-4 py-4 font-medium text-muted-foreground">Guest</th>
                        <th className="px-6 py-4 font-medium text-muted-foreground">Company</th>
                        <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                        <th className="px-6 py-4 font-medium text-muted-foreground">
                          Invited At
                        </th>
                        <th className="px-6 py-4 font-medium text-muted-foreground text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredGuests?.map((guest) => (
                        <tr
                          key={guest.id}
                          className={`hover:bg-muted/30 transition-colors group ${
                            selectedGuests.has(guest.id) ? "bg-primary/5" : ""
                          }`}
                        >
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
                          <td className="px-6 py-4 text-muted-foreground text-sm">
                            {guest.company || "--"}
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant="outline"
                              className={`text-xs ${GUEST_STATUS_STYLES[guest.status] ?? ""}`}
                            >
                              {guest.status === "added" && (
                                <UserPlus className="h-3 w-3 mr-1 inline" />
                              )}
                              {guest.status === "confirmed" && (
                                <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                              )}
                              {guest.status === "declined" && (
                                <XCircle className="h-3 w-3 mr-1 inline" />
                              )}
                              {guest.status === "invited" && (
                                <Mail className="h-3 w-3 mr-1 inline" />
                              )}
                              {guest.status === "maybe" && (
                                <Clock3 className="h-3 w-3 mr-1 inline" />
                              )}
                              {GUEST_STATUS_LABELS[guest.status] ?? guest.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground text-xs">
                            {guest.status === "added"
                              ? "--"
                              : guest.invitedAt
                                ? format(parseISO(guest.invitedAt), "MMM d, yyyy")
                                : "--"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                {(guest.status === "invited" || guest.status === "maybe") && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onUpdateStatus(guest.id, "invited");
                                      toast({ title: `Invite resent to ${guest.name}` });
                                    }}
                                  >
                                    <Send className="mr-2 h-4 w-4 text-blue-600" />
                                    Resend Invite
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                  Update Response
                                </div>
                                {guest.status !== "confirmed" && (
                                  <DropdownMenuItem
                                    onClick={() => onUpdateStatus(guest.id, "confirmed")}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                    RSVP -- Yes
                                  </DropdownMenuItem>
                                )}
                                {guest.status !== "maybe" && (
                                  <DropdownMenuItem
                                    onClick={() => onUpdateStatus(guest.id, "maybe")}
                                  >
                                    <Clock3 className="mr-2 h-4 w-4 text-amber-600" />
                                    RSVP -- Maybe
                                  </DropdownMenuItem>
                                )}
                                {guest.status !== "declined" && (
                                  <DropdownMenuItem
                                    onClick={() => onUpdateStatus(guest.id, "declined")}
                                  >
                                    <XCircle className="mr-2 h-4 w-4 text-red-500" />
                                    RSVP -- No
                                  </DropdownMenuItem>
                                )}
                                {guest.status !== "attended" && (
                                  <DropdownMenuItem
                                    onClick={() => onCheckInGuest(guest.id)}
                                  >
                                    <ClipboardCheck className="mr-2 h-4 w-4 text-purple-600" />
                                    Mark as Attended
                                  </DropdownMenuItem>
                                )}
                                {guest.status !== "waitlisted" && event?.capacity && (event.confirmedCount ?? 0) >= event.capacity && (
                                  <DropdownMenuItem
                                    onClick={() => onUpdateStatus(guest.id, "waitlisted")}
                                  >
                                    <Clock className="mr-2 h-4 w-4 text-orange-500" />
                                    Move to Waitlist
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    setGuestToRemove({ id: guest.id, name: guest.name })
                                  }
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

          {/* ── Campaigns Tab ──────────────────────────────────────────── */}
          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Email Campaigns</CardTitle>
                    <CardDescription>Manage communications for this event</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsCreateCampaignOpen(true)}
                    disabled={event?.status === "published"}
                    title={event?.status === "published" ? "Event is live — new campaigns are locked" : undefined}
                  >
                    {event?.status === "published" ? (
                      <Lock className="h-4 w-4 mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    New Campaign
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isCampaignsLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : campaigns?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-10 w-10 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium text-foreground mb-1">No campaigns yet</p>
                    <p>Generate an AI campaign to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {campaigns?.map((campaign) => {
                      const isSent = campaign.status === "sent";
                      return (
                        <div
                          key={campaign.id}
                          className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${isSent ? "bg-muted/30 border-muted" : "hover:bg-muted/50"}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium flex items-center gap-2 truncate">
                              {campaign.subject}
                              {isSent && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" title="Campaign sent — content is locked" />}
                            </div>
                            <div className="text-sm text-muted-foreground capitalize flex gap-2 mt-1">
                              <Badge variant="secondary" className="text-[10px]">
                                {campaign.type}
                              </Badge>
                              <Badge variant={isSent ? "outline" : "secondary"} className={`text-[10px] ${isSent ? "border-green-300 text-green-700 bg-green-50" : ""}`}>
                                {campaign.status}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => setLocation(`/campaigns/${campaign.id}/edit`)}
                          >
                            {isSent ? <><Lock className="h-3.5 w-3.5 mr-1" />View</> : "Edit"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Social Tab ─────────────────────────────────────────────── */}
          <TabsContent value="social">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Social Media Posts</CardTitle>
                    <CardDescription>Schedule content to promote this event</CardDescription>
                  </div>
                  <Link href="/social">
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      New Post
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {isSocialLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : socialPosts?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Share2 className="h-10 w-10 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium text-foreground mb-1">No social posts</p>
                    <p>Start promoting your event on social media.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {socialPosts?.map((post) => (
                      <div
                        key={post.id}
                        className="p-4 border rounded-lg flex flex-col justify-between"
                      >
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="capitalize">
                              {post.platform}
                            </Badge>
                            <span className="text-xs text-muted-foreground capitalize">
                              {post.status}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-3">{post.content}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="w-full justify-center">
                          View Post
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Reminders Tab ──────────────────────────────────────────── */}
          <TabsContent value="reminders">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Automated Reminders</CardTitle>
                    <CardDescription>
                      Schedule emails to keep your guests informed before and after the event
                    </CardDescription>
                  </div>
                  <Dialog open={isNewReminderOpen} onOpenChange={setIsNewReminderOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New Reminder
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Create Reminder</DialogTitle>
                        <DialogDescription>
                          Set up an automated email to send to your guests.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">When to send</label>
                            <Select
                              value={newReminderType}
                              onValueChange={(v) =>
                                setNewReminderType(v as typeof newReminderType)
                              }
                            >
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
                            <Select
                              value={newReminderOffset}
                              onValueChange={setNewReminderOffset}
                            >
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
                              : `This reminder will be sent ${newReminderOffset} hours from when you manually trigger it.`}
                        </div>

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
                          <Button
                            variant="outline"
                            onClick={() => setIsNewReminderOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={onCreateReminder}
                            disabled={
                              createReminder.isPending ||
                              !newReminderSubject.trim() ||
                              !newReminderMessage.trim()
                            }
                          >
                            {createReminder.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Creating...
                              </>
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
                    {reminders?.map((reminder) => (
                      <div
                        key={reminder.id}
                        className="p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{reminder.subject}</div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {reminder.message}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {reminder.offsetHours >= 24
                                  ? `${Math.floor(reminder.offsetHours / 24)} day${Math.floor(reminder.offsetHours / 24) !== 1 ? "s" : ""}`
                                  : `${reminder.offsetHours} hour${reminder.offsetHours !== 1 ? "s" : ""}`}{" "}
                                {reminder.type.replace("_", " ")}
                              </span>
                              {reminder.sentAt && (
                                <span>
                                  Sent {format(parseISO(reminder.sentAt), "MMM d, yyyy h:mm a")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={reminder.status === "sent" ? "default" : "outline"}
                              className="capitalize"
                            >
                              {reminder.status}
                            </Badge>
                            {reminder.status !== "sent" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={sendingReminderId === reminder.id}
                                onClick={() => onSendReminder(reminder.id)}
                              >
                                {sendingReminderId === reminder.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-3 w-3 mr-1" />
                                    Send Now
                                  </>
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

          {/* ── Analytics Tab ──────────────────────────────────────────── */}
          <TabsContent value="analytics" className="space-y-6">
            {(() => {
              const total = guests?.length ?? 0;
              const confirmed = guests?.filter((g) => g.status === "confirmed").length ?? 0;
              const maybe = guests?.filter((g) => g.status === "maybe").length ?? 0;
              const declined = guests?.filter((g) => g.status === "declined").length ?? 0;
              const invited = guests?.filter((g) => g.status === "invited").length ?? 0;
              const added = guests?.filter((g) => g.status === "added").length ?? 0;
              const attended = guests?.filter((g) => g.status === "attended").length ?? 0;
              const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;
              const rsvpRate = total > 0 ? Math.round(((confirmed + maybe + declined) / total) * 100) : 0;

              const pieData = [
                { name: "Confirmed", value: confirmed, color: "#22c55e" },
                { name: "Attended", value: attended, color: "#a855f7" },
                { name: "Maybe", value: maybe, color: "#f59e0b" },
                { name: "Declined", value: declined, color: "#ef4444" },
                { name: "Invite Sent", value: invited, color: "#3b82f6" },
                { name: "Pending", value: added, color: "#94a3b8" },
              ].filter((d) => d.value > 0);

              const funnelData = [
                { stage: "Added", count: total, fill: "#94a3b8" },
                { stage: "Invited", count: invited + confirmed + maybe + declined + attended, fill: "#3b82f6" },
                { stage: "Responded", count: confirmed + maybe + declined, fill: "#f59e0b" },
                { stage: "Confirmed", count: confirmed + attended, fill: "#22c55e" },
                { stage: "Attended", count: attended, fill: "#a855f7" },
              ];

              const campaignStats = campaigns?.map((c) => ({
                name: c.type ? c.type.charAt(0).toUpperCase() + c.type.slice(1) : "Campaign",
                subject: c.subject ?? "—",
                status: c.status,
                openRate: typeof c.openRate === "number" ? c.openRate : null,
                sentAt: c.sentAt,
              }));

              return (
                <>
                  {/* KPI cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Total Guests", value: total, icon: Users, color: "text-blue-600", bg: "bg-blue-500/10" },
                      { label: "Confirmed", value: confirmed, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-500/10" },
                      { label: "RSVP Rate", value: `${rsvpRate}%`, icon: Activity, color: "text-amber-600", bg: "bg-amber-500/10" },
                      { label: "Attended", value: attended, icon: ClipboardCheck, color: "text-purple-600", bg: "bg-purple-500/10" },
                    ].map((kpi) => (
                      <Card key={kpi.label}>
                        <CardContent className="py-5 px-5">
                          <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
                            <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                          </div>
                          <div className="text-2xl font-bold">{kpi.value}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* RSVP breakdown pie */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">RSVP Breakdown</CardTitle>
                        <CardDescription>Guest status distribution</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {total === 0 ? (
                          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                            No guests yet
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={90}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {pieData.map((entry, i) => (
                                  <Cell key={i} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(val: number, name: string) => [`${val} guests`, name]}
                              />
                              <Legend wrapperStyle={{ fontSize: "12px" }} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>

                    {/* Attendance funnel */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Attendance Funnel</CardTitle>
                        <CardDescription>From added → attended</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {total === 0 ? (
                          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                            No guests yet
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                              <XAxis type="number" hide />
                              <YAxis type="category" dataKey="stage" width={72} tick={{ fontSize: 12 }} />
                              <Tooltip formatter={(val: number) => [`${val} guests`]} />
                              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                {funnelData.map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Campaign performance */}
                  {(campaignStats?.length ?? 0) > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Campaign Performance</CardTitle>
                        <CardDescription>Email campaigns linked to this event</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {campaignStats?.map((c, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border">
                              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Mail className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{c.subject}</p>
                                <p className="text-xs text-muted-foreground capitalize">{c.name} campaign</p>
                              </div>
                              <div className="text-right shrink-0">
                                {c.status === "sent" ? (
                                  <>
                                    {c.openRate != null ? (
                                      <div className="text-sm font-semibold text-green-600">{c.openRate}% open</div>
                                    ) : (
                                      <div className="text-sm font-medium text-green-600">Sent</div>
                                    )}
                                    {c.sentAt && (
                                      <div className="text-xs text-muted-foreground">
                                        {format(parseISO(c.sentAt), "MMM d")}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <Badge variant="outline" className="capitalize text-xs">{c.status}</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Attendance rate bar */}
                  {attended > 0 && (
                    <Card>
                      <CardContent className="py-5 px-5">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-sm">Attendance Rate</p>
                            <p className="text-xs text-muted-foreground">{attended} of {total} guests attended</p>
                          </div>
                          <span className="text-2xl font-bold text-purple-600">{attendanceRate}%</span>
                        </div>
                        <Progress value={attendanceRate} className="h-3" />
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </TabsContent>

          {/* ── Activity Feed Tab ───────────────────────────────────────── */}
          <TabsContent value="activity" className="space-y-4">
            <ActivityFeedTab orgId={ORG_ID} eventId={eventId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ================================================================ */}
      {/* DIALOGS & MODALS                                                 */}
      {/* ================================================================ */}

      {/* Remove single guest confirmation */}
      <AlertDialog open={!!guestToRemove} onOpenChange={(open) => !open && setGuestToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove guest?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{guestToRemove?.name}</strong> will be removed from this event's guest list.
              This cannot be undone.
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

      {/* CSV Import */}
      <CSVImportModal
        orgId={ORG_ID}
        eventId={eventId}
        open={isCSVImportOpen}
        onClose={() => setIsCSVImportOpen(false)}
      />

      {/* GHL Import */}
      <GHLImportModal
        orgId={ORG_ID}
        open={isGHLImportOpen}
        onClose={() => setIsGHLImportOpen(false)}
        initialEventId={eventId}
      />

      {/* Review & Launch Dialog */}
      <Dialog open={isLaunchOpen} onOpenChange={setIsLaunchOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Review &amp; Launch
            </DialogTitle>
            <DialogDescription>
              Review everything that will happen when you launch. Nothing is sent until you hit Launch.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="preview">Email preview</TabsTrigger>
              <TabsTrigger value="recipients">
                Recipients ({guests?.filter((g) => g.status === "added").length ?? 0})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pt-3 pr-1">
              <TabsContent value="overview" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Event</div>
                    <div className="font-medium text-sm truncate">{event?.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{event?.status}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Date</div>
                    <div className="font-medium text-sm">
                      {event?.startDate ? format(parseISO(event.startDate), "MMM d, yyyy") : "--"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {event?.startDate ? format(parseISO(event.startDate), "h:mm a") : ""}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Location</div>
                    <div className="font-medium text-sm truncate">
                      {event?.type === "remote" ? "Online" : event?.location || "--"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 capitalize">{event?.type}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Capacity</div>
                    <div className="font-medium text-sm">
                      {guests?.length ?? 0}{event?.capacity ? ` / ${event.capacity}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {guests?.filter((g) => g.status === "added").length ?? 0} pending invites
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">Campaign</div>
                      <div className="font-medium text-sm">{campaigns?.[0]?.subject ?? "No campaign set"}</div>
                      <div className="text-xs text-muted-foreground">
                        {campaigns?.[0]?.name ?? "—"} · {campaigns?.[0]?.status ?? "draft"}
                      </div>
                    </div>
                    {campaigns?.[0] && (
                      <Link href={`/campaigns/${campaigns[0].id}/edit`}>
                        <Button variant="outline" size="sm">Edit campaign</Button>
                      </Link>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">What happens on launch</div>
                  <ul className="text-sm space-y-1">
                    <li className="flex items-start gap-2">
                      <Send className="h-4 w-4 text-primary mt-0.5" />
                      <span>Campaign email sent to <strong>{guests?.filter((g) => g.status === "added").length ?? 0}</strong> pending guests, each with a personalized RSVP link.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-primary mt-0.5" />
                      <span>Guests with status <code className="text-xs px-1 rounded bg-muted">added</code> move to <code className="text-xs px-1 rounded bg-muted">invited</code>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Share2 className="h-4 w-4 text-primary mt-0.5" />
                      <span>A LinkedIn announcement post is auto-created in the Social tab.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Globe className="h-4 w-4 text-primary mt-0.5" />
                      <span>Event status flips to <code className="text-xs px-1 rounded bg-muted">published</code>; the public RSVP page goes live at <code className="text-xs px-1 rounded bg-muted">/e/{event?.slug}</code>.</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <span className="font-medium">Heads up:</span>
                  <span>If no SMTP is configured in <code>.env</code>, emails will go to an Ethereal preview inbox (not delivered to real recipients). Configure SMTP_HOST / SMTP_USER / SMTP_PASS before a live launch.</span>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-0">
                {campaigns?.[0]?.htmlContent ? (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Subject: <strong className="text-foreground">{campaigns[0].subject}</strong>
                    </div>
                    <div className="rounded-lg border bg-card overflow-hidden">
                      <iframe
                        title="Campaign preview"
                        srcDoc={campaigns[0].htmlContent ?? ""}
                        className="w-full min-h-[500px] border-0 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        placeholder="you@example.com"
                        value={testEmailTo}
                        onChange={(e) => setTestEmailTo(e.target.value)}
                        className="max-w-xs h-9"
                      />
                      <Button variant="outline" size="sm" onClick={onTestEmail} disabled={isSendingTest || !testEmailTo.includes("@")}>
                        {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <TestTube className="h-3.5 w-3.5 mr-1.5" />}
                        Send me a test
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
                    No campaign HTML yet.{" "}
                    <button type="button" className="text-primary underline" onClick={() => setIsCreateCampaignOpen(true)}>Create a campaign</button>{" "}
                    to preview it here.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="recipients" className="mt-0 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border p-2"><div className="text-muted-foreground">Will receive invite</div><div className="font-semibold text-base">{guests?.filter((g) => g.status === "added").length ?? 0}</div></div>
                  <div className="rounded-lg border p-2"><div className="text-muted-foreground">Already invited</div><div className="font-semibold text-base">{guests?.filter((g) => g.status === "invited").length ?? 0}</div></div>
                  <div className="rounded-lg border p-2"><div className="text-muted-foreground">Already responded</div><div className="font-semibold text-base">{(guests?.filter((g) => ["confirmed","declined","maybe"].includes(g.status)).length) ?? 0}</div></div>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Guest</th>
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y max-h-64">
                      {(guests?.filter((g) => g.status === "added") ?? []).slice(0, 50).map((g) => (
                        <tr key={g.id}>
                          <td className="px-3 py-2">{g.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{g.email}</td>
                          <td className="px-3 py-2"><Badge variant="outline" className="text-xs">will invite</Badge></td>
                        </tr>
                      ))}
                      {!guests?.some((g) => g.status === "added") && (
                        <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground text-sm">No pending invites. Add guests first.</td></tr>
                      )}
                    </tbody>
                  </table>
                  {(guests?.filter((g) => g.status === "added").length ?? 0) > 50 && (
                    <div className="px-3 py-2 bg-muted/30 text-xs text-muted-foreground border-t">
                      Showing first 50 of {guests?.filter((g) => g.status === "added").length}.
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setIsLaunchOpen(false)}>Go Back</Button>
            <Button
              onClick={onLaunch}
              disabled={isLaunching || !(guests?.some((g) => g.status === "added")) || !campaigns?.[0]}
              className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
            >
              {isLaunching ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Launching...</>
              ) : (
                <><Rocket className="h-4 w-4 mr-2" />Launch &amp; send {guests?.filter((g) => g.status === "added").length ?? 0}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog
        open={isTestEmailOpen}
        onOpenChange={(o) => {
          if (!o) {
            setIsTestEmailOpen(false);
            setTestEmailTo("");
          }
        }}
      >
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
              <Button
                variant="outline"
                onClick={() => {
                  setIsTestEmailOpen(false);
                  setTestEmailTo("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={onTestEmail}
                disabled={isSendingTest || !testEmailTo.includes("@")}
                className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
              >
                {isSendingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Event Confirmation */}
      <AlertDialog open={isDeleteEventOpen} onOpenChange={setIsDeleteEventOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{event?.title}</strong> and all its guests,
              campaigns, and reminders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteEvent.mutate(
                  { orgId: ORG_ID, eventId },
                  {
                    onSuccess: () => {
                      toast({ title: "Event deleted" });
                      setLocation("/events");
                    },
                    onError: (err) => {
                      toast({
                        title: "Failed to delete event",
                        description: err.message,
                        variant: "destructive",
                      });
                    },
                  },
                );
              }}
              disabled={deleteEvent.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEvent.isPending ? "Deleting..." : "Delete Event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {bulkEmail && (
        <BulkEmailDialog
          open={bulkEmail.open}
          onOpenChange={(o) => setBulkEmail((prev) => (prev ? { ...prev, open: o } : prev))}
          orgId={ORG_ID}
          eventId={eventId}
          recipientLabel={bulkEmail.label}
          recipientCount={bulkEmail.count}
          recipient={bulkEmail.recipient}
          templates={campaigns?.filter((c) => c.eventId === eventId).map((c) => ({ id: c.id, name: c.name, subject: c.subject, htmlContent: c.htmlContent, textContent: c.textContent })) ?? []}
          onSent={() => {
            setSelectedGuests(new Set());
            queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/campaigns`] });
            queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/activity`] });
          }}
        />
      )}

      <CampaignCreationModal
        open={isCreateCampaignOpen}
        onClose={() => {
          setIsCreateCampaignOpen(false);
          queryClient.invalidateQueries({ queryKey: [`/api/organizations/${ORG_ID}/campaigns`] });
        }}
        eventId={eventId}
      />
    </AppLayout>
  );
}

// ── Activity Feed Component ─────────────────────────────────────────────────
const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  event_created: <Plus className="h-3.5 w-3.5 text-primary" />,
  event_updated: <Settings className="h-3.5 w-3.5 text-blue-500" />,
  event_launched: <Rocket className="h-3.5 w-3.5 text-green-600" />,
  event_cancelled: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  guest_added: <UserPlus className="h-3.5 w-3.5 text-violet-500" />,
  guest_removed: <Trash2 className="h-3.5 w-3.5 text-red-400" />,
  guest_status_updated: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  campaign_created: <Mail className="h-3.5 w-3.5 text-orange-500" />,
  campaign_sent: <Send className="h-3.5 w-3.5 text-green-500" />,
  campaign_updated: <Mail className="h-3.5 w-3.5 text-blue-400" />,
  social_post_created: <Share2 className="h-3.5 w-3.5 text-pink-500" />,
  reminder_sent: <Clock className="h-3.5 w-3.5 text-amber-500" />,
};

function ActivityFeedTab({ orgId, eventId }: { orgId: number; eventId: number }) {
  const { data: activity, isLoading } = useGetRecentActivity(orgId, { limit: 50 });

  const eventActivity: ActivityItem[] = activity?.filter(
    (a) => a.entityId === eventId || !a.entityId
  ) ?? [];

  const sorted = [...eventActivity].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl border">
            <div className="h-7 w-7 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
              <div className="h-2.5 bg-muted rounded animate-pulse w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
        <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Activity className="h-7 w-7 opacity-40" />
        </div>
        <p className="font-medium">No activity yet</p>
        <p className="text-sm mt-1">Changes to this event will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/20">
        <h3 className="text-sm font-semibold">Event Activity</h3>
        <p className="text-xs text-muted-foreground">{sorted.length} event{sorted.length !== 1 ? "s" : ""} logged</p>
      </div>
      <div className="divide-y">
        {sorted.map((item, i) => {
          const icon = ACTIVITY_ICONS[item.type] ?? <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
          return (
            <div key={item.id ?? i} className="flex items-start gap-3 p-4 hover:bg-muted/20 transition-colors">
              <div className="h-7 w-7 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.description || item.type.replace(/_/g, " ")}</p>
                {item.entityType && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {item.entityType}: {item.entityId}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {format(parseISO(item.createdAt), "MMM d, h:mm a")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
