import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useListEvents } from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
  isToday,
} from "date-fns";

const ORG_ID = 1;

type EventStatus = "draft" | "published" | "completed" | "cancelled";

interface CalendarEvent {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: events, isLoading } = useListEvents(ORG_ID);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (!events) return map;
    for (const event of events as CalendarEvent[]) {
      if (!event.startDate) continue;
      const key = format(parseISO(event.startDate), "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    }
    return map;
  }, [events]);

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
          <Link href="/events/new">
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </Link>
        </div>

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
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
            {(["published", "draft", "completed", "cancelled"] as EventStatus[]).map(
              (status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`}
                  />
                  <span className="capitalize">{status}</span>
                </div>
              )
            )}
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
                      {dayEvents.slice(0, 3).map((event) => (
                        <Link key={event.id} href={`/events/${event.id}`}>
                          <div
                            className={`group/pill cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] md:text-xs font-medium truncate transition-all duration-150 ${STATUS_STYLES[event.status]}`}
                            title={event.title}
                          >
                            <span className="hidden md:inline">
                              {event.title}
                            </span>
                            <span className="md:hidden flex items-center gap-1">
                              <span
                                className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[event.status]}`}
                              />
                              <span className="truncate">{event.title}</span>
                            </span>
                          </div>
                        </Link>
                      ))}
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
