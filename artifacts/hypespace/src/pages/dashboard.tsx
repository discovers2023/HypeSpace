import { AppLayout } from "@/components/layout/app-layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Mail, BarChart, ArrowUpRight, Activity, CheckCircle, XCircle, HelpCircle, Clock, Plus, TrendingUp, Sparkles } from "lucide-react";
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
  yes: "#7C3AED",
  maybe: "#EA580C",
  no: "#DC2626",
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
  return str.length > max ? str.slice(0, max - 1) + "..." : str;
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
              contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", fontSize: "12px" }}
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
          <Button variant="link" size="sm" className="mt-2 text-primary">Create your first event</Button>
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
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={chartData.length > 4 ? -30 : 0}
            textAnchor={chartData.length > 4 ? "end" : "middle"}
            height={chartData.length > 4 ? 50 : 30}
          />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", fontSize: "12px" }}
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
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: bgColor }}>
      <div className="shrink-0" style={{ color }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold" style={{ color }}>{count}</p>
      </div>
    </div>
  );
}

function StatCard({ href, icon: Icon, title, value, subtitle, accentColor }: {
  href: string;
  icon: typeof Calendar;
  title: string;
  value: React.ReactNode;
  subtitle: string;
  accentColor: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover-elevate transition-all cursor-pointer group border-border/60 hover:border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${accentColor}`}>
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

import { useAuth } from "@/components/auth-provider";

export default function Dashboard() {
  const { activeOrgId } = useAuth();
  const { data: stats, isLoading: isStatsLoading } = useGetDashboardStats(activeOrgId);
  const { data: activity, isLoading: isActivityLoading } = useGetRecentActivity(activeOrgId, { limit: 5 });

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
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0">
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </Link>
        </div>

        {/* Integration Sync Alert */}
        <Card className="border-primary/20 bg-primary/5 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Calendar className="h-24 w-24 -rotate-12" />
          </div>
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 animate-pulse">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg">Connect Your External Calendars</CardTitle>
                <CardDescription className="text-muted-foreground/80 max-w-md mt-1">
                  Sync Google and Outlook events to avoid scheduling conflicts and manage your entire event lifecycle in one place.
                </CardDescription>
              </div>
            </div>
            <Link href="/settings?tab=integrations">
              <Button variant="outline" className="border-primary/20 hover:bg-primary/10 rounded-xl">
                Configure Integrations
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Top metric cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isStatsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border/60">
                <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-32 mt-2" /></CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatCard
                href="/events"
                icon={Calendar}
                title="Total Events"
                value={stats?.totalEvents || 0}
                subtitle={`${stats?.activeEvents || 0} active right now`}
                accentColor="bg-primary/10 text-primary"
              />
              <StatCard
                href="/events"
                icon={Users}
                title="Total Guests"
                value={stats?.totalGuests || 0}
                subtitle={`${stats?.confirmedGuests || 0} confirmed`}
                accentColor="bg-accent/10 text-accent"
              />
              <StatCard
                href="/campaigns"
                icon={Mail}
                title="Campaigns Sent"
                value={stats?.campaignsSent || 0}
                subtitle={stats?.avgOpenRate ? `${(stats.avgOpenRate * 100).toFixed(1)}% avg open rate` : "No data yet"}
                accentColor="bg-secondary/20 text-primary"
              />
              <StatCard
                href="/social"
                icon={TrendingUp}
                title="Engagement"
                value={`${stats?.totalGuests ? Math.round((stats.confirmedGuests / stats.totalGuests) * 100) : 0}%`}
                subtitle="RSVP conversion rate"
                accentColor="bg-green-500/10 text-green-600"
              />
            </>
          )}
        </div>

        {/* RSVP Stats Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 border-border/60">
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

          <Card className="col-span-3 border-border/60">
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
                      color="#7C3AED"
                      bgColor="rgba(124, 58, 237, 0.06)"
                    />
                    <RsvpStatRow
                      icon={<HelpCircle className="h-4 w-4" />}
                      label="Maybe"
                      count={stats?.guestsByStatus.maybe ?? 0}
                      color="#EA580C"
                      bgColor="rgba(234, 88, 12, 0.06)"
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
          <Card className="col-span-4 border-border/60">
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
                <div className="space-y-3">
                  {stats?.upcomingEvents?.slice(0, 4).map(event => (
                    <div key={event.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0">
                          <span className="text-[10px] font-semibold uppercase tracking-wide">{format(parseISO(event.startDate), "MMM")}</span>
                          <span className="text-lg font-bold leading-none">{format(parseISO(event.startDate), "d")}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{event.title}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span className="capitalize">{event.type}</span>
                            <span className="text-border">|</span>
                            <span>{event.confirmedCount} confirmed</span>
                          </p>
                        </div>
                      </div>
                      <Link href={`/events/${event.id}`}>
                        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 hover:bg-primary/10 hover:text-primary">
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-3 flex flex-col border-border/60">
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
                        <div className="absolute top-8 bottom-[-24px] left-[11px] w-[2px] bg-border/50" />
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
          <Card className="col-span-4 border-border/60">
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
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                      <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
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
