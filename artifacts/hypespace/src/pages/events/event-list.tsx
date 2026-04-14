import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { useListEvents, useDeleteEvent } from "@workspace/api-client-react";
import { Calendar, MapPin, Search, Plus, Trash2, Edit, MoreHorizontal, Video, Users } from "lucide-react";
import { format, parseISO, isPast, isFuture } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ORG_ID = 1;

type FilterTab = "all" | "upcoming" | "drafts" | "past";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All Events" },
  { key: "upcoming", label: "Upcoming" },
  { key: "drafts", label: "Drafts" },
  { key: "past", label: "Past" },
];

export default function EventList() {
  const { data: events, isLoading } = useListEvents(ORG_ID);
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const deleteEvent = useDeleteEvent();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);

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
    deleteEvent.mutate({ orgId: ORG_ID, eventId: eventToDelete }, {
      onSuccess: () => {
        toast({ title: "Event deleted" });
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", ORG_ID, "events"] });
        setEventToDelete(null);
      },
      onError: (error) => {
        toast({ title: "Failed to delete event", description: error.message, variant: "destructive" });
        setEventToDelete(null);
      },
    });
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case "published": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "draft": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "completed": return "bg-gray-500/10 text-gray-600 border-gray-300";
      case "cancelled": return "bg-red-500/10 text-red-700 border-red-200";
      default: return "";
    }
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
          <Link href="/events/new">
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0">
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </Link>
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

        {/* Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))
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
                <Link href="/events/new">
                  <Button variant="outline">Create Event</Button>
                </Link>
              )}
            </div>
          ) : (
            filtered.map((event) => (
              <div
                key={event.id}
                className="group relative flex flex-col rounded-xl border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {event.coverImageUrl ? (
                  <div className="h-36 w-full overflow-hidden relative">
                    <img
                      src={event.coverImageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <Badge variant="outline" className={`capitalize text-xs border ${statusStyle(event.status)}`}>
                        {event.status}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="h-2 w-full bg-primary" />
                )}

                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    {!event.coverImageUrl && (
                      <Badge variant="outline" className={`capitalize text-xs border ${statusStyle(event.status)}`}>
                        {event.status}
                      </Badge>
                    )}
                    <div className={event.coverImageUrl ? "ml-auto" : ""}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/events/${event.id}`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLocation(`/events/${event.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Event
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setEventToDelete(event.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <Link href={`/events/${event.id}`}>
                    <h3 className="text-base font-bold line-clamp-2 group-hover:text-primary transition-colors cursor-pointer leading-snug">
                      {event.title}
                    </h3>
                  </Link>

                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="mr-1.5 h-3.5 w-3.5 text-primary shrink-0" />
                      {event.startDate
                        ? format(parseISO(event.startDate), "MMM d, yyyy · h:mm a")
                        : "Date TBD"}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      {event.type === "remote" || event.type === "hybrid" ? (
                        <Video className="mr-1.5 h-3.5 w-3.5 text-accent shrink-0" />
                      ) : (
                        <MapPin className="mr-1.5 h-3.5 w-3.5 text-accent shrink-0" />
                      )}
                      <span className="line-clamp-1">
                        {event.type === "remote" ? "Online Event" : event.location || "Location TBD"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>
                        <span className="font-medium text-foreground">{event.confirmedCount ?? 0}</span>
                        {event.capacity ? ` / ${event.capacity}` : ""} guests
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {event.type}
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
    </AppLayout>
  );
}
