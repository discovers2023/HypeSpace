import { AppLayout } from "@/components/layout/app-layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Mail, BarChart, ArrowUpRight, Activity } from "lucide-react";
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
} from "recharts";

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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover-elevate transition-all border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{stats?.totalEvents || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.activeEvents || 0} active right now
                  </p>
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
              {isStatsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{stats?.totalGuests || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.confirmedGuests || 0} confirmed
                  </p>
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
              {isStatsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{stats?.campaignsSent || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.avgOpenRate ? `${(stats.avgOpenRate * 100).toFixed(1)}% avg open rate` : 'No data yet'}
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
              {isStatsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-3xl font-bold">
                    {stats?.totalGuests ? Math.round((stats.confirmedGuests / stats.totalGuests) * 100) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    RSVP conversion rate
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

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
                      {index !== activity.length - 1 && (
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
                      <XAxis 
                        dataKey="name" 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `${value}`} 
                      />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      />
                      <Bar 
                        dataKey="total" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]} 
                      />
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
