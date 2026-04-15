import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import {
  useListEvents, useDeleteEvent, useCreateEvent, useAddGuest, useListCampaigns,
  type Event, type CreateEventBodyType, type CreateEventBodyCategory,
} from "@workspace/api-client-react";
import {
  Calendar, MapPin, Search, Plus, Trash2, Edit, MoreHorizontal,
  Video, Users, LayoutGrid, List, Copy, BarChart2, UserPlus, Zap,
} from "lucide-react";
import { format, parseISO, isPast, isFuture } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { EventCreationModal } from "@/components/events/event-creation-modal";

const ORG_ID = 1;

type FilterTab = "all" | "upcoming" | "drafts" | "past";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All Events" },
  { key: "upcoming", label: "Upcoming" },
  { key: "drafts", label: "Drafts" },
  { key: "past", label: "Past" },
];

// Progress stepper based on event state
function EventProgress({ event, guests, campaigns }: { event: Event; guests?: { id: number }[]; campaigns?: { id: number }[] }) {
  const hasGuests = (guests?.length ?? event.confirmedCount ?? 0) > 0;
  const hasCampaign = (campaigns?.length ?? 0) > 0;
  const isLaunched = event.status === "published" || event.status === "completed";

  const steps = [
    { label: "Created", done: true },
    { label: "Guests Added", done: hasGuests },
    { label: "Campaign Ready", done: hasCampaign },
    { label: "Launched", done: isLaunched },
  ];

  const currentStep = steps.filter((s) => s.done).length - 1;

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className={`h-2 w-2 rounded-full ${step.done ? "bg-primary" : "bg-muted-foreground/30"}`} />
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px flex-1 ${steps[i + 1].done ? "bg-primary/40" : "bg-muted-foreground/20"}`} />
          )}
        </div>
      ))}
    </div>
  );
}


const statusStyle = (status: string) => {
  switch (status) {
    case "published": return "bg-green-500/10 text-green-700 border-green-500/20";
    case "draft": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    case "completed": return "bg-gray-500/10 text-gray-600 border-gray-300";
    case "cancelled": return "bg-red-500/10 text-red-700 border-red-200";
    default: return "";
  }
};

export default function EventList() {
  const { data: events, isLoading } = useListEvents(ORG_ID);
  const { data: allCampaigns } = useListCampaigns(ORG_ID);
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const deleteEvent = useDeleteEvent();
  const createEvent = useCreateEvent();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [addGuestEventId, setAddGuestEventId] = useState<number | null>(null);
  const [addGuestName, setAddGuestName] = useState("");
  const [addGuestEmail, setAddGuestEmail] = useState("");
  const [addGuestCompany, setAddGuestCompany] = useState("");
  const addGuest = useAddGuest();

  const filtered = (events ?? []).filter((event) => {
    const matchesSearch =
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    const start = event.startDate ? parseISO(event.startDate) : null;
    if (activeTab === "drafts") return event.status === "draft";
    if (activeTab === "upcoming") return event.status !== "draft" && (start ? isFuture(start) : true);
    if (activeTab === "past") return event.status === "completed" || (start ? isPast(start) : false);
    return true;
  });

  const counts = {
    all: (events ?? []).length,
    upcoming: (events ?? []).filter((e) => e.status !== "draft" && (e.startDate ? isFuture(parseISO(e.startDate)) : true)).length,
    drafts: (events ?? []).filter((e) => e.status === "draft").length,
    past: (events ?? []).filter((e) => e.status === "completed" || (e.startDate ? isPast(parseISO(e.startDate)) : false)).length,
  };

  const handleDelete = () => {
    if (!eventToDelete) return;
    deleteEvent.mutate(
      { orgId: ORG_ID, eventId: eventToDelete },
      {
        onSuccess: () => {
          toast({ title: "Event deleted" });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", ORG_ID, "events"] });
          setEventToDelete(null);
        },
        onError: (error) => {
          toast({ title: "Failed to delete event", description: error.message, variant: "destructive" });
          setEventToDelete(null);
        },
      },
    );
  };

  const handleClone = (event: Event) => {
    setCloningId(event.id);
    createEvent.mutate(
      {
        orgId: ORG_ID,
        data: {
          title: `${event.title} (Copy)`,
          description: event.description,
          type: event.type as CreateEventBodyType,
          category: event.category as CreateEventBodyCategory,
          startDate: event.startDate,
          endDate: event.endDate,
          timezone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          location: event.location,
          onlineUrl: event.onlineUrl,
          capacity: event.capacity,
          coverImageUrl: event.coverImageUrl,
        },
      },
      {
        onSuccess: (newEvent) => {
          toast({ title: "Event cloned!", description: "A draft copy has been created." });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", ORG_ID, "events"] });
          setCloningId(null);
          setLocation(`/events/${newEvent.id}`);
        },
        onError: (error) => {
          toast({ title: "Failed to clone event", description: error.message, variant: "destructive" });
          setCloningId(null);
        },
      },
    );
  };

  const handleAddGuest = () => {
    if (!addGuestEventId || !addGuestEmail || !addGuestName) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    addGuest.mutate(
      { orgId: ORG_ID, eventId: addGuestEventId, data: { name: addGuestName, email: addGuestEmail, company: addGuestCompany || null } },
      {
        onSuccess: () => {
          toast({ title: "Guest added!", description: `${addGuestName} added successfully.` });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", ORG_ID, "events"] });
          setAddGuestEventId(null);
          setAddGuestName("");
          setAddGuestEmail("");
          setAddGuestCompany("");
        },
        onError: (e) => {
          toast({ title: "Failed to add guest", description: e.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Events</h1>
            <p className="text-muted-foreground mt-1">
              {isLoading ? "Loading…" : `${counts.all} event${counts.all !== 1 ? "s" : ""} in your organization`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border bg-card overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-2 transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-2.5 py-2 transition-colors ${viewMode === "list" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </div>
        </div>

        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search events…"
              className="pl-9 bg-card h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                  activeTab === tab.key
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {tab.label}
                {counts[tab.key] > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Grid / List */}
        {isLoading ? (
          <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-card rounded-xl border border-dashed">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">
              {activeTab === "all" && searchTerm === "" ? "No events yet" : "No events match"}
            </h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              {activeTab === "all" && searchTerm === ""
                ? "Create your first event to get started."
                : "Try a different filter or search term."}
            </p>
            {activeTab === "all" && searchTerm === "" && (
              <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>Create Event</Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                campaigns={(allCampaigns ?? []).filter((c) => c.eventId === event.id)}
                onDelete={() => setEventToDelete(event.id)}
                onClone={() => handleClone(event)}
                onViewDetail={() => setLocation(`/events/${event.id}`)}
                onAddGuest={() => setAddGuestEventId(event.id)}
                isCloning={cloningId === event.id}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((event) => (
              <EventListRow
                key={event.id}
                event={event}
                onDelete={() => setEventToDelete(event.id)}
                onClone={() => handleClone(event)}
                onViewDetail={() => setLocation(`/events/${event.id}`)}
                onAddGuest={() => setAddGuestEventId(event.id)}
                isCloning={cloningId === event.id}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the event and all associated guest data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Guest Dialog */}
      <Dialog open={!!addGuestEventId} onOpenChange={(open) => { if (!open) { setAddGuestEventId(null); setAddGuestName(""); setAddGuestEmail(""); setAddGuestCompany(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Guest</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ag-name">Full Name *</Label>
              <Input id="ag-name" placeholder="Jane Smith" value={addGuestName} onChange={(e) => setAddGuestName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-email">Email Address *</Label>
              <Input id="ag-email" type="email" placeholder="jane@example.com" value={addGuestEmail} onChange={(e) => setAddGuestEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-company">Company</Label>
              <Input id="ag-company" placeholder="Acme Corp" value={addGuestCompany} onChange={(e) => setAddGuestCompany(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGuestEventId(null)}>Cancel</Button>
            <Button onClick={handleAddGuest} disabled={addGuest.isPending || !addGuestName || !addGuestEmail} className="bg-primary hover:bg-primary/90 text-white">
              {addGuest.isPending ? "Adding…" : "Add Guest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventCreationModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onEventCreated={(id) => {
          setIsCreateModalOpen(false);
          setLocation(`/events/${id}`);
        }}
      />
    </AppLayout>
  );
}

// ──────────────────────────────────────────────────
// Event Card (Grid View)
// ──────────────────────────────────────────────────
function EventCard({
  event,
  campaigns,
  onDelete,
  onClone,
  onViewDetail,
  onAddGuest,
  isCloning,
}: {
  event: Event;
  campaigns?: { id: number }[];
  onDelete: () => void;
  onClone: () => void;
  onViewDetail: () => void;
  onAddGuest: () => void;
  isCloning: boolean;
}) {
  const [, setLocation] = useLocation();

  // Derive progress stage
  const confirmedCount = event.confirmedCount ?? 0;
  const isLive = event.status === "published";
  const isDraft = event.status === "draft";

  const stageLabel = isLive ? "Live" : isDraft ? "Draft" : "Active";
  const stageBg = isLive ? "bg-green-500/10 text-green-700" : isDraft ? "bg-amber-500/10 text-amber-700" : "bg-blue-500/10 text-blue-700";

  return (
    <div className="group relative flex flex-col rounded-xl border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden">
      {event.coverImageUrl ? (
        <div className="h-32 w-full overflow-hidden relative">
          <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3">
            <Badge variant="outline" className={`capitalize text-xs border ${statusStyle(event.status)}`}>{event.status}</Badge>
          </div>
        </div>
      ) : (
        <div className={`h-1.5 w-full ${isLive ? "bg-green-500" : "bg-primary"}`} />
      )}

      <div className="p-4 flex-1 flex flex-col gap-3">
        {!event.coverImageUrl && (
          <Badge variant="outline" className={`capitalize text-xs border w-fit ${statusStyle(event.status)}`}>{event.status}</Badge>
        )}

        <div className="flex justify-between items-start gap-2">
          <button onClick={onViewDetail} className="text-left flex-1 min-w-0">
            <h3 className="text-sm font-bold line-clamp-2 group-hover:text-primary transition-colors">{event.title}</h3>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onViewDetail}><Edit className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation(`/events/${event.id}`)}><Zap className="mr-2 h-4 w-4" />Setup & Launch</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClone} disabled={isCloning}><Copy className="mr-2 h-4 w-4" />{isCloning ? "Cloning…" : "Clone Event"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1 flex-1 text-xs text-muted-foreground">
          {event.startDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-primary shrink-0" />
              {format(parseISO(event.startDate), "MMM d, yyyy · h:mm a")}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {event.type === "remote" ? <Video className="h-3 w-3 text-accent shrink-0" /> : <MapPin className="h-3 w-3 text-accent shrink-0" />}
            <span className="line-clamp-1">{event.type === "remote" ? "Online Event" : event.location || "Location TBD"}</span>
          </div>
        </div>

        {/* Lifecycle progress stepper */}
        <div className="space-y-1">
          <EventProgress event={event} campaigns={campaigns} />
          <div className="flex justify-between text-[10px] text-muted-foreground/70 px-0.5">
            <span>Created</span><span>Guests</span><span>Campaign</span><span>Live</span>
          </div>
        </div>

        {/* Capacity bar */}
        {event.capacity && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{confirmedCount} / {event.capacity} guests</span>
              <span>{Math.round((confirmedCount / event.capacity) * 100)}%</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${confirmedCount / event.capacity >= 0.8 ? "bg-orange-500" : "bg-primary"}`}
                style={{ width: `${Math.min(100, (confirmedCount / event.capacity) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="pt-2 border-t flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={onAddGuest}>
            <UserPlus className="h-3 w-3 mr-1" />Add Guest
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs flex-1">
                <BarChart2 className="h-3 w-3 mr-1" />Analytics
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="center">
              <p className="text-xs font-semibold mb-2">Event Analytics</p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Total guests</span><span className="font-medium text-foreground">{event.guestCount ?? 0}</span></div>
                <div className="flex justify-between"><span>Confirmed</span><span className="font-medium text-green-600">{confirmedCount}</span></div>
                {event.capacity && (
                  <div className="flex justify-between"><span>Capacity fill</span><span className="font-medium text-foreground">{Math.min(100, Math.round((confirmedCount / event.capacity) * 100))}%</span></div>
                )}
                <div className="flex justify-between"><span>Status</span><span className="capitalize font-medium text-foreground">{event.status}</span></div>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={onClone} disabled={isCloning}>
            <Copy className="h-3 w-3 mr-1" />{isCloning ? "…" : "Clone"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Event List Row (List View)
// ──────────────────────────────────────────────────
function EventListRow({
  event,
  onDelete,
  onClone,
  onViewDetail,
  onAddGuest,
  isCloning,
}: {
  event: Event;
  onDelete: () => void;
  onClone: () => void;
  onViewDetail: () => void;
  onAddGuest: () => void;
  isCloning: boolean;
}) {
  const [, setLocation] = useLocation();

  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all">
      {event.coverImageUrl ? (
        <img src={event.coverImageUrl} alt="" className="h-14 w-20 rounded-lg object-cover shrink-0" />
      ) : (
        <div className={`h-14 w-20 rounded-lg flex items-center justify-center shrink-0 ${event.status === "published" ? "bg-green-500/10" : "bg-primary/10"}`}>
          <Calendar className="h-6 w-6 text-primary/60" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <button onClick={onViewDetail} className="text-sm font-bold hover:text-primary transition-colors truncate">{event.title}</button>
          <Badge variant="outline" className={`capitalize text-xs border shrink-0 ${statusStyle(event.status)}`}>{event.status}</Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {event.startDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(event.startDate), "MMM d, yyyy")}
            </span>
          )}
          <span className="flex items-center gap-1">
            {event.type === "remote" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
            {event.type === "remote" ? "Online" : event.location || "TBD"}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {event.confirmedCount ?? 0}{event.capacity ? ` / ${event.capacity}` : ""} guests
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAddGuest}>
          <UserPlus className="h-3 w-3 mr-1" />Add Guest
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClone} disabled={isCloning}>
          <Copy className="h-3 w-3 mr-1" />{isCloning ? "Cloning…" : "Clone"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onViewDetail}>
          <Edit className="h-3 w-3 mr-1" />View
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onViewDetail}><Edit className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
