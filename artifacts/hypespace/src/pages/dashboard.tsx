import { AppLayout } from "@/components/layout/app-layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Mail, BarChart, ArrowUpRight, Activity, CheckCircle, XCircle, HelpCircle, Clock } from "lucide-react";
import { useGetDashboardStats, useGetRecentActivity } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const RSVP_COLORS = {
  yes: "#22c55e",
  maybe: "#f59e0b",
  no: "#ef4444",
  invited: "#94a3b8",
};

type PerEventRsvp = {
  eventId: number;
  title: string;
  yes: number;
  no: number;
  maybe: number;
  invited: number;
  total: number;
};

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function RsvpDonut({ guestsByStatus }: { guestsByStatus: { added?: number; confirmed: number; declined: number; maybe: number; invited: number; attended: number } }) {
  const data = [
    { name: "Yes", value: guestsByStatus.confirmed + guestsByStatus.attended, color: RSVP_COLORS.yes },
    { name: "Maybe", value: guestsByStatus.maybe, color: RSVP_COLORS.maybe },
    { name: "No", value: guestsByStatus.declined, color: RSVP_COLORS.no },
    { name: "Invited", value: guestsByStatus.invited, color: RSVP_COLORS.invited },
    { name: "Added", value: guestsByStatus.added ?? 0, color: "#94a3b8" },
  ].filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
        <Users className="h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm">No guests yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`${value} guests`, name]}
              contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "12px" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-xs text-muted-foreground">total guests</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full px-4 mt-1">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-muted-foreground">{d.name}</span>
            <span className="text-xs font-semibold ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerEventRsvpChart({ data }: { data: PerEventRsvp[] }) {
  const eventsWithGuests = data.filter(e => e.total > 0);

  if (eventsWithGuests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
        <Calendar className="h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm">No events with guests yet</p>
        <Link href="/events/new">
          <Button variant="link" size="sm" className="mt-2">Create your first event</Button>
        </Link>
      </div>
    );
  }

  const chartData = eventsWithGuests.map(e => ({
    name: truncate(e.title, 18),
    Yes: e.yes,
    Maybe: e.maybe,
    No: e.no,
    "No Reply": e.invited,
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={chartData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            stroke="#888"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={chartData.length > 4 ? -30 : 0}
            textAnchor={chartData.length > 4 ? "end" : "middle"}
            height={chartData.length > 4 ? 50 : 30}
          />
          <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "12px" }}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
          />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
          <Bar dataKey="Yes" stackId="rsvp" fill={RSVP_COLORS.yes} radius={[0, 0, 0, 0]} />
          <Bar dataKey="Maybe" stackId="rsvp" fill={RSVP_COLORS.maybe} />
          <Bar dataKey="No" stackId="rsvp" fill={RSVP_COLORS.no} />
          <Bar dataKey="No Reply" stackId="rsvp" fill={RSVP_COLORS.invited} radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RsvpStatRow({ icon, label, count, color, bgColor }: { icon: React.ReactNode; label: string; count: number; color: string; bgColor: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: bgColor }}>
      <div className="shrink-0" style={{ color }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold" style={{ color }}>{count}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetDashboardStats(1);
  const { data: activity, isLoading: isActivityLoading } = useGetRecentActivity(1, { limit: 5 });

  const chartData = stats ? [
    { name: "Onsite", total: stats.eventsByType.onsite },
    { name: "Remote", total: stats.eventsByType.remote },
    { name: "Hybrid", total: stats.eventsByType.hybrid },
  ] : [];

  return (
    <AppLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back. Here's what's happening across your events.</p>
          </div>
          <Link href="/events/new">
            <Button className="bg-gradient-to-r from-primary to-accent border-0 text-white">
              <Calendar className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </Link>
        </div>

        {/* Top metric cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover-elevate transition-all border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-3xl font-bold">{stats?.totalEvents || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stats?.activeEvents || 0} active right now</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="hover-elevate transition-all border-l-4 border-l-accent">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-3xl font-bold">{stats?.totalGuests || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stats?.confirmedGuests || 0} confirmed</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="hover-elevate transition-all border-l-4 border-l-secondary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Campaigns Sent</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-3xl font-bold">{stats?.campaignsSent || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.avgOpenRate ? `${(stats.avgOpenRate * 100).toFixed(1)}% avg open rate` : "No data yet"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="hover-elevate transition-all border-l-4 border-l-muted-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Engagement</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-3xl font-bold">
                    {stats?.totalGuests ? Math.round((stats.confirmedGuests / stats.totalGuests) * 100) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">RSVP conversion rate</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RSVP Stats Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Per-event RSVP bar chart */}
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>RSVP by Event</CardTitle>
              <CardDescription>Guest responses across all your events</CardDescription>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <PerEventRsvpChart data={stats?.perEventRsvp ?? []} />
              )}
            </CardContent>
          </Card>

          {/* RSVP donut + stat pills */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Overall RSVP Breakdown</CardTitle>
              <CardDescription>Response distribution across all events</CardDescription>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-[220px] w-full rounded-full mx-auto" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <>
                  <RsvpDonut guestsByStatus={stats?.guestsByStatus ?? { added: 0, confirmed: 0, declined: 0, maybe: 0, invited: 0, attended: 0 }} />
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <RsvpStatRow
                      icon={<CheckCircle className="h-4 w-4" />}
                      label="Attending (Yes)"
                      count={(stats?.guestsByStatus.confirmed ?? 0) + (stats?.guestsByStatus.attended ?? 0)}
                      color="#16a34a"
                      bgColor="#f0fdf4"
                    />
                    <RsvpStatRow
                      icon={<HelpCircle className="h-4 w-4" />}
                      label="Maybe"
                      count={stats?.guestsByStatus.maybe ?? 0}
                      color="#d97706"
                      bgColor="#fffbeb"
                    />
                    <RsvpStatRow
                      icon={<XCircle className="h-4 w-4" />}
                      label="Not Attending (No)"
                      count={stats?.guestsByStatus.declined ?? 0}
                      color="#dc2626"
                      bgColor="#fef2f2"
                    />
                    <RsvpStatRow
                      icon={<Clock className="h-4 w-4" />}
                      label="No Reply"
                      count={stats?.guestsByStatus.invited ?? 0}
                      color="#64748b"
                      bgColor="#f8fafc"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events + Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>Your next scheduled events</CardDescription>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : stats?.upcomingEvents?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>No upcoming events.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats?.upcomingEvents?.slice(0, 4).map(event => (
                    <div key={event.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0">
                          <span className="text-xs font-semibold uppercase">{format(parseISO(event.startDate), "MMM")}</span>
                          <span className="text-lg font-bold leading-none">{format(parseISO(event.startDate), "d")}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold">{event.title}</h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <span className="capitalize">{event.type}</span>
                            <span>•</span>
                            <span>{event.confirmedCount} confirmed</span>
                          </p>
                        </div>
                      </div>
                      <Link href={`/events/${event.id}`}>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-3 flex flex-col">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions across your workspace</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {isActivityLoading ? (
                <div className="space-y-6">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : activity?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground h-full flex flex-col items-center justify-center">
                  <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>No recent activity.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {activity?.map((item, index) => (
                    <div key={item.id} className="flex gap-4 relative">
                      {index !== (activity?.length ?? 0) - 1 && (
                        <div className="absolute top-8 bottom-[-24px] left-[11px] w-[2px] bg-border" />
                      )}
                      <div className="mt-1">
                        <div className="h-[24px] w-[24px] rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 z-10 relative">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(item.createdAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Events by Type */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Events by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={chartData}>
                      <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                      <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
