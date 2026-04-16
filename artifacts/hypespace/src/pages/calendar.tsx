import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { useListEvents, useListCampaigns } from "@workspace/api-client-react";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle,
  Plus, LayoutList, Grid3x3, Columns,
  MapPin, Users, Eye, UserPlus, Edit,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format,
  isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek,
  parseISO, isToday, isSameDay, eachWeekOfInterval, addWeeks,
  startOfDay, endOfDay, eachHourOfInterval,
} from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Globe, Settings as SettingsIcon } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { EventCreationModal } from "@/components/events/event-creation-modal";
import { useAuth } from "@/components/auth-provider";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type EventStatus = "draft" | "published" | "completed" | "cancelled";
type CalendarView = "month" | "week" | "list";

interface CalendarEvent {
  id: string | number;
  title: string;
  startDate: string;
  endDate?: string;
  status: EventStatus;
  type?: "hypespace" | "google" | "outlook" | "apple" | "ical";
  color?: string;
  source?: string;
  confirmedCount?: number;
  capacity?: number;
  location?: string;
  eventType?: string;
}

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: "bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 border border-slate-500/20",
  published: "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20",
  completed: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20",
  cancelled: "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20",
};

const STATUS_DOT: Record<EventStatus, string> = {
  draft: "bg-slate-400",
  published: "bg-primary",
  completed: "bg-emerald-400",
  cancelled: "bg-red-400",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CALENDAR_PLATFORMS = ["google_calendar", "outlook_calendar", "apple_calendar", "other_calendar"];

function EventPopover({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const [, setLocation] = useLocation();
  return (
    <div className="w-64 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-sm leading-snug">{event.title}</h4>
        <Badge variant="outline" className="capitalize text-xs shrink-0">{event.status}</Badge>
      </div>
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          {event.startDate ? format(parseISO(event.startDate), "MMM d, yyyy 'at' h:mm a") : "Date TBD"}
        </div>
        {event.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
            {event.location}
          </div>
        )}
        {event.confirmedCount !== undefined && (
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" />
            {event.confirmedCount}{event.capacity ? ` / ${event.capacity}` : ""} guests
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setLocation(`/events/${event.id}`)}>
          <Eye className="h-3 w-3 mr-1" />View
        </Button>
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setLocation(`/events/${event.id}/edit`)}>
          <Edit className="h-3 w-3 mr-1" />Edit
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setLocation(`/events/${event.id}?tab=guests`)}>
          <UserPlus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { activeOrgId } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [showExternal, setShowExternal] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<Date | undefined>(undefined);
  const [popoverEvent, setPopoverEvent] = useState<CalendarEvent | null>(null);

  const { data: events, isLoading: eventsLoading } = useListEvents(activeOrgId);
  const { data: campaigns } = useListCampaigns(activeOrgId);

  const { data: integrations } = useQuery<any[]>({
    queryKey: ["integrations", activeOrgId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/organizations/${activeOrgId}/integrations`);
      return res.json();
    },
  });

  const connectedCalendars = useMemo(() => {
    return integrations?.filter((i) => CALENDAR_PLATFORMS.includes(i.platform)) || [];
  }, [integrations]);

  const { data: externalData, isLoading: externalLoading } = useQuery<{ events: CalendarEvent[]; errors: any[] }>({
    queryKey: ["calendar-events", activeOrgId, currentDate.getFullYear(), currentDate.getMonth() + 1],
    enabled: connectedCalendars.length > 0 && showExternal,
    queryFn: async () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const res = await fetch(`${BASE}/api/organizations/${activeOrgId}/calendar/events?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch calendar events");
      const data = await res.json();
      return {
        events: (data.events || []).map((e: any) => ({ ...e, type: e.sourceType, status: "published" as EventStatus })),
        errors: data.errors || [],
      };
    },
  });

  const externalEvents = externalData?.events || [];
  const calendarErrors = externalData?.errors || [];
  const isLoading = eventsLoading || (externalLoading && showExternal);

  const allEvents: CalendarEvent[] = useMemo(() => {
    return [
      ...(events || []).map((e: any) => ({ ...e, type: "hypespace" as const })),
      ...(showExternal ? externalEvents : []),
    ];
  }, [events, externalEvents, showExternal]);

  // Campaign scheduled dates
  const campaignDates = useMemo(() => {
    const map = new Map<string, any[]>();
    (campaigns || []).forEach((c: any) => {
      if (c.scheduledAt) {
        const key = format(parseISO(c.scheduledAt), "yyyy-MM-dd");
        const existing = map.get(key) ?? [];
        existing.push(c);
        map.set(key, existing);
      }
    });
    return map;
  }, [campaigns]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of allEvents) {
      if (!event.startDate) continue;
      const key = format(parseISO(event.startDate), "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    }
    return map;
  }, [allEvents]);

  // Navigation
  const goToPrev = () => {
    if (view === "month") setCurrentDate((d) => subMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd; });
  };
  const goToNext = () => {
    if (view === "month") setCurrentDate((d) => addMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd; });
  };
  const goToToday = () => setCurrentDate(new Date());

  const headerLabel = view === "month"
    ? format(currentDate, "MMMM yyyy")
    : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`;

  const handleDateClick = (date: Date) => {
    setPrefillDate(date);
    setIsCreateModalOpen(true);
  };

  const openEventPopover = (event: CalendarEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (event.type !== "hypespace") return;
    setPopoverEvent(event);
  };

  const totalEvents = events?.length ?? 0;

  // Month view days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  // Week view days
  const weekDays = useMemo(() => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    const we = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: ws, end: we });
  }, [currentDate]);

  // List view events sorted
  const listEvents = useMemo(() => {
    return [...allEvents].sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  }, [allEvents]);

  const EventPill = ({ event, className = "" }: { event: CalendarEvent; className?: string }) => {
    const isExternal = event.type !== "hypespace";
    const [, setLocation] = useLocation();

    const pill = (
      <Popover open={popoverEvent?.id === event.id} onOpenChange={(open) => !open && setPopoverEvent(null)}>
        <PopoverTrigger asChild>
          <div
            onClick={(e) => {
              if (isExternal) return;
              openEventPopover(event, e);
            }}
            className={`cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] md:text-xs font-medium truncate transition-all ${
              isExternal ? "hover:opacity-80 border" : STATUS_STYLES[event.status]
            } ${className}`}
            title={event.title}
          >
            <span className="flex items-center gap-1">
              <span className={`hidden md:inline-block h-1.5 w-1.5 rounded-full shrink-0 ${!isExternal ? STATUS_DOT[event.status] : "bg-blue-400"}`} />
              <span className="truncate">{event.title}</span>
            </span>
          </div>
        </PopoverTrigger>
        {!isExternal && (
          <PopoverContent className="w-64 p-0" align="start">
            <EventPopover event={event} onClose={() => setPopoverEvent(null)} />
          </PopoverContent>
        )}
      </Popover>
    );

    if (isExternal) return <div key={event.id}>{pill}</div>;
    return <div key={event.id}>{pill}</div>;
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground mt-1">
              {isLoading ? "Loading..." : `${totalEvents} event${totalEvents !== 1 ? "s" : ""} in your organization`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {connectedCalendars.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExternal(!showExternal)}
                className={`h-9 border-dashed ${showExternal ? "bg-primary/5 border-primary/50 text-primary" : "text-muted-foreground"}`}
              >
                <Globe className="mr-2 h-4 w-4" />
                {showExternal ? `External (${connectedCalendars.length})` : "External Off"}
              </Button>
            )}
            <Button
              className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0 h-9"
              onClick={() => { setPrefillDate(undefined); setIsCreateModalOpen(true); }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
            <Link href="/settings?tab=integrations">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Connect prompt */}
        {!isLoading && connectedCalendars.length === 0 && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed bg-muted/30">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Connect your calendar</p>
              <p className="text-xs text-muted-foreground">Pull in events from Google Calendar, Outlook, Apple Calendar, or any iCal-compatible calendar.</p>
            </div>
            <Link href="/settings">
              <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs">Connect Calendar</Button>
            </Link>
          </div>
        )}

        {calendarErrors.length > 0 && showExternal && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-xs">
              <span className="font-medium">Some calendars failed to load: </span>
              {calendarErrors.map((e) => e.platform.replace(/_/g, " ")).join(", ")}
            </div>
          </div>
        )}

        {/* Navigation + View Toggle */}
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPrev} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNext} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday} className="h-8">Today</Button>
          </div>
          <h2 className="text-base font-semibold">{headerLabel}</h2>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border bg-background overflow-hidden">
              <button
                onClick={() => setView("month")}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "month" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Grid3x3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Month</span>
              </button>
              <button
                onClick={() => setView("week")}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "week" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Columns className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Week</span>
              </button>
              <button
                onClick={() => setView("list")}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "list" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
            {/* Status legend (month view) */}
            {view === "month" && (
              <div className="hidden lg:flex items-center gap-3 text-[11px] text-muted-foreground">
                {(["published", "draft", "completed", "cancelled"] as EventStatus[]).map((status) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                    <span className="capitalize">{status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Calendar Content */}
        {view === "month" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="grid grid-cols-7 border-b">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            {isLoading ? (
              <div className="grid grid-cols-7">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="min-h-[100px] border-b border-r p-2">
                    <Skeleton className="h-5 w-5 rounded-full mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDate.get(dateKey) ?? [];
                  const dayCampaigns = campaignDates.get(dateKey) ?? [];
                  const inCurrentMonth = isSameMonth(day, currentDate);
                  const today = isToday(day);

                  return (
                    <div
                      key={dateKey}
                      onClick={() => handleDateClick(day)}
                      className={`min-h-[100px] md:min-h-[120px] border-b border-r p-1.5 md:p-2 transition-colors cursor-pointer ${
                        !inCurrentMonth ? "bg-muted/30" : today ? "bg-primary/5" : "hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center justify-center h-7 w-7 text-sm rounded-full ${
                          today ? "bg-primary text-primary-foreground font-bold" : inCurrentMonth ? "text-foreground font-medium" : "text-muted-foreground/50"
                        }`}>
                          {format(day, "d")}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] text-muted-foreground md:hidden">{dayEvents.length}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                        {dayEvents.slice(0, 3).map((event) => (
                          <EventPill key={event.id} event={event} />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground pl-1.5">+{dayEvents.length - 3} more</span>
                        )}
                        {/* Campaign indicators */}
                        {dayCampaigns.slice(0, 2).map((c: any) => (
                          <div key={c.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-blue-600 bg-blue-50 border border-blue-100">
                            <span className="h-1 w-1 rounded-full bg-blue-400 shrink-0" />
                            <span className="truncate">📧 {c.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === "week" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="grid grid-cols-7 border-b">
              {weekDays.map((day) => (
                <div
                  key={format(day, "yyyy-MM-dd")}
                  onClick={() => handleDateClick(day)}
                  className={`px-2 py-3 text-center cursor-pointer hover:bg-muted/20 transition-colors ${isToday(day) ? "bg-primary/5" : ""}`}
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{format(day, "EEE")}</p>
                  <span className={`inline-flex items-center justify-center h-7 w-7 text-sm rounded-full mt-1 mx-auto ${
                    isToday(day) ? "bg-primary text-white font-bold" : "text-foreground"
                  }`}>
                    {format(day, "d")}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {weekDays.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDate.get(dateKey) ?? [];
                const dayCampaigns = campaignDates.get(dateKey) ?? [];
                return (
                  <div
                    key={dateKey}
                    onClick={() => handleDateClick(day)}
                    className={`min-h-[200px] p-2 border-r cursor-pointer hover:bg-muted/10 transition-colors ${isToday(day) ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                      {dayEvents.map((event) => <EventPill key={event.id} event={event} />)}
                      {dayCampaigns.map((c: any) => (
                        <div key={c.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-blue-600 bg-blue-50 border border-blue-100">
                          <span className="truncate">📧 {c.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "list" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : listEvents.length === 0 ? (
              <div className="p-16 text-center">
                <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">No events yet.</p>
                <Button variant="outline" className="mt-4" onClick={() => setIsCreateModalOpen(true)}>Create Event</Button>
              </div>
            ) : (
              <div className="divide-y">
                {listEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors group">
                    <div className="text-center shrink-0 w-12">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">
                        {event.startDate ? format(parseISO(event.startDate), "MMM") : "—"}
                      </p>
                      <p className="text-xl font-bold text-primary leading-none">
                        {event.startDate ? format(parseISO(event.startDate), "d") : "—"}
                      </p>
                    </div>
                    <div className={`h-10 w-1 rounded-full shrink-0 ${STATUS_DOT[event.status as EventStatus] || "bg-primary"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.startDate ? format(parseISO(event.startDate), "h:mm a") : ""}{event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                    {event.type === "hypespace" && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Link href={`/events/${event.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs"><Eye className="h-3 w-3 mr-1" />View</Button>
                        </Link>
                        <Link href={`/events/${event.id}?tab=guests`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs"><UserPlus className="h-3 w-3 mr-1" />Guests</Button>
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isLoading && totalEvents === 0 && view !== "list" && (
          <div className="text-center py-12 bg-card rounded-xl border border-dashed">
            <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No events yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">Create your first event to see it on the calendar.</p>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>Create Event</Button>
          </div>
        )}
      </div>

      <EventCreationModal
        open={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setPrefillDate(undefined); }}
        prefillDate={prefillDate}
      />
    </AppLayout>
  );
}
