import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useListEvents } from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
  isToday,
} from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Globe, Settings as SettingsIcon } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const ORG_ID = 1;

type EventStatus = "draft" | "published" | "completed" | "cancelled";

interface CalendarEvent {
  id: string | number;
  title: string;
  startDate: string;
  endDate?: string;
  status: EventStatus;
  type?: "hypespace" | "google" | "outlook" | "apple" | "ical";
  color?: string;
  source?: string;
}

const STATUS_STYLES: Record<EventStatus, string> = {
  draft:
    "bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 border border-slate-500/20",
  published:
    "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20",
  completed:
    "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20",
  cancelled:
    "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20",
};

const STATUS_DOT: Record<EventStatus, string> = {
  draft: "bg-slate-400",
  published: "bg-primary",
  completed: "bg-emerald-400",
  cancelled: "bg-red-400",
};

const SOURCE_ICON: Record<string, string> = {
  google: "G",
  outlook: "O",
  apple: "A",
  ical: "i",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CALENDAR_PLATFORMS = ["google_calendar", "outlook_calendar", "apple_calendar", "other_calendar"];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showExternal, setShowExternal] = useState(true);
  
  const { data: events, isLoading: eventsLoading } = useListEvents(ORG_ID);

  // Fetch integrations to check for connected calendars
  const { data: integrations } = useQuery<any[]>({
    queryKey: ["integrations", ORG_ID],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/integrations`);
      return res.json();
    },
  });

  const connectedCalendars = useMemo(() => {
    return integrations?.filter(i => CALENDAR_PLATFORMS.includes(i.platform)) || [];
  }, [integrations]);

  // Fetch external calendar events from backend
  const { data: externalData, isLoading: externalLoading } = useQuery<{ events: CalendarEvent[]; errors: any[] }>({
    queryKey: ["calendar-events", ORG_ID, currentMonth.getFullYear(), currentMonth.getMonth() + 1],
    enabled: connectedCalendars.length > 0 && showExternal,
    queryFn: async () => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const res = await fetch(`${BASE}/api/organizations/${ORG_ID}/calendar/events?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch calendar events");
      const data = await res.json();
      return {
        events: (data.events || []).map((e: any) => ({
          ...e,
          type: e.sourceType,
          status: "published" as EventStatus,
        })),
        errors: data.errors || [],
      };
    },
  });

  const externalEvents = externalData?.events || [];
  const calendarErrors = externalData?.errors || [];
  const isLoading = eventsLoading || (externalLoading && showExternal);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const allEvents = [
      ...(events || []).map((e: any) => ({ ...e, type: "hypespace" as const })),
      ...(showExternal ? (externalEvents || []) : [])
    ];

    for (const event of allEvents as CalendarEvent[]) {
      if (!event.startDate) continue;
      const key = format(parseISO(event.startDate), "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    }
    return map;
  }, [events, externalEvents, showExternal]);

  const goToPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const totalEvents = events?.length ?? 0;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground mt-1">
              {isLoading
                ? "Loading..."
                : `${totalEvents} event${totalEvents !== 1 ? "s" : ""} in your organization`}
            </p>
          </div>
          <div className="flex items-center gap-3">
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
            <Link href="/events/new">
              <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0 h-9">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </Link>
            <Link href="/settings?tab=integrations">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" title="Calendar integrations">
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Connect calendar prompt */}
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
              <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs">
                Connect Calendar
              </Button>
            </Link>
          </div>
        )}

        {/* Calendar fetch errors */}
        {calendarErrors.length > 0 && showExternal && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-xs">
              <span className="font-medium">Some calendars failed to load: </span>
              {calendarErrors.map(e => e.platform.replace(/_/g, " ")).join(", ")}. Check your iCal URLs in{" "}
              <Link href="/settings" className="underline">Settings → Integrations</Link>.
            </div>
          </div>
        )}

        {/* Month Navigation */}
        <div className="flex items-center justify-between rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPrevMonth}
              className="h-9 w-9"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goToNextMonth}
              className="h-9 w-9"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="ml-1 h-9"
            >
              Today
            </Button>
          </div>
          <h2 className="text-xl font-semibold">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          {/* Status legend */}
          <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-4 mr-4 border-r pr-4">
              {(["published", "draft", "completed", "cancelled"] as EventStatus[]).map(
                (status) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                    <span className="capitalize">{status}</span>
                  </div>
                )
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-primary/20 border border-primary/20" />
                <span>HypeSpace</span>
              </div>
              {connectedCalendars.map(cal => (
                <div key={cal.platform} className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded border" style={{
                    backgroundColor: cal.platform === "google_calendar" ? "#4285F433" : cal.platform === "outlook_calendar" ? "#0078D433" : cal.platform === "apple_calendar" ? "#1C1C1E33" : "#6366f133",
                    borderColor: cal.platform === "google_calendar" ? "#4285F4" : cal.platform === "outlook_calendar" ? "#0078D4" : cal.platform === "apple_calendar" ? "#555" : "#6366f1",
                  }} />
                  <span>{cal.accountName || cal.platform.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          {isLoading ? (
            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="min-h-[100px] md:min-h-[120px] border-b border-r p-2 last:border-r-0"
                >
                  <Skeleton className="h-5 w-5 rounded-full mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDate.get(dateKey) ?? [];
                const inCurrentMonth = isSameMonth(day, currentMonth);
                const today = isToday(day);

                return (
                  <div
                    key={dateKey}
                    className={`min-h-[100px] md:min-h-[120px] border-b border-r p-1.5 md:p-2 transition-colors ${
                      !inCurrentMonth
                        ? "bg-muted/30"
                        : today
                          ? "bg-primary/5"
                          : "hover:bg-muted/20"
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`inline-flex items-center justify-center h-7 w-7 text-sm rounded-full transition-colors ${
                          today
                            ? "bg-primary text-primary-foreground font-bold"
                            : inCurrentMonth
                              ? "text-foreground font-medium"
                              : "text-muted-foreground/50"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] text-muted-foreground md:hidden">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Event pills */}
                    <div className="flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map((event) => {
                        const isExternal = event.type !== "hypespace" && event.type != null;
                        const sourceIcon = event.type ? SOURCE_ICON[event.type] : null;

                        const content = (
                          <div
                            className={`group/pill cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] md:text-xs font-medium truncate transition-all duration-150 ${
                              isExternal
                                ? "hover:opacity-80 border"
                                : STATUS_STYLES[event.status]
                            }`}
                            style={isExternal && event.color ? {
                              backgroundColor: `${event.color}22`,
                              borderColor: `${event.color}55`,
                              color: event.color,
                            } : undefined}
                            title={`${event.title}${event.source ? ` (${event.source})` : ""}`}
                          >
                            <span className="flex items-center gap-1">
                              {isExternal && sourceIcon && (
                                <span className="text-[9px] font-bold shrink-0 opacity-80">{sourceIcon}</span>
                              )}
                              {!isExternal && (
                                <span className={`hidden md:inline-block h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[event.status]}`} />
                              )}
                              <span className="truncate">{event.title}</span>
                            </span>
                          </div>
                        );

                        return isExternal ? (
                          <div key={event.id}>{content}</div>
                        ) : (
                          <Link key={event.id} href={`/events/${event.id}`}>
                            {content}
                          </Link>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground pl-1.5 font-medium">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Empty state */}
        {!isLoading && totalEvents === 0 && (
          <div className="text-center py-16 bg-card rounded-xl border border-dashed">
            <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No events yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Create your first event to see it on the calendar.
            </p>
            <Link href="/events/new">
              <Button variant="outline">Create Event</Button>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
