import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Users, Building2, Calendar, Mail, UserCheck, LogOut,
  Loader2, Eye, Crown, CheckCircle2, BarChart2, UserPlus,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type AdminStats = { users: number; organizations: number; events: number; campaigns: number; guests: number };
type AdminOrg = { id: number; name: string; slug: string; plan: string; memberCount: number; eventCount: number; owner: { name: string; email: string } | null; createdAt: string };
type AdminUser = { id: number; email: string; name: string; emailVerified: boolean; createdAt: string };

export default function AdminDashboard() {
  const { toast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tab, setTab] = useState<"overview" | "orgs" | "users">("overview");
  const [impersonating, setImpersonating] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/admin/me`).then(r => {
      if (r.ok) { setIsLoggedIn(true); loadData(); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadData = async () => {
    const [s, o, u] = await Promise.all([
      fetch(`${BASE}/api/admin/stats`).then(r => r.json()).catch(() => null),
      fetch(`${BASE}/api/admin/organizations`).then(r => r.json()).catch(() => []),
      fetch(`${BASE}/api/admin/users`).then(r => r.json()).catch(() => []),
    ]);
    setStats(s);
    setOrgs(o);
    setUsers(u);
  };

  const onLogin = async () => {
    setLoggingIn(true);
    try {
      const res = await fetch(`${BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        setIsLoggedIn(true);
        loadData();
      } else {
        toast({ title: "Invalid credentials", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  const onLogout = async () => {
    await fetch(`${BASE}/api/admin/logout`, { method: "POST" });
    setIsLoggedIn(false);
  };

  const onImpersonate = async (userId: number, userName: string) => {
    const res = await fetch(`${BASE}/api/admin/impersonate/${userId}`, { method: "POST" });
    if (res.ok) {
      setImpersonating(userName);
      toast({ title: `Now impersonating ${userName}`, description: "Navigate to /dashboard to see their view." });
    } else {
      toast({ title: "Failed to impersonate", variant: "destructive" });
    }
  };

  const onStopImpersonating = async () => {
    await fetch(`${BASE}/api/admin/stop-impersonating`, { method: "POST" });
    setImpersonating(null);
    toast({ title: "Stopped impersonating" });
  };

  const onChangePlan = async (orgId: number, plan: string) => {
    const res = await fetch(`${BASE}/api/admin/organizations/${orgId}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (res.ok) {
      toast({ title: "Plan updated" });
      loadData();
    } else {
      const data = await res.json();
      toast({ title: "Failed", description: data.error, variant: "destructive" });
    }
  };

  const onVerifyUser = async (userId: number) => {
    const res = await fetch(`${BASE}/api/admin/users/${userId}/verify`, { method: "PATCH" });
    if (res.ok) {
      toast({ title: "Email verified" });
      loadData();
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>HypeSpace Admin</CardTitle>
            <CardDescription>Support team access portal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Admin email" value={email} onChange={e => setEmail(e.target.value)} />
            <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && onLogin()} />
            <Button onClick={onLogin} disabled={loggingIn} className="w-full bg-primary text-white">
              {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const planColors: Record<string, string> = {
    free: "bg-gray-100 text-gray-700",
    starter: "bg-blue-100 text-blue-700",
    growth: "bg-purple-100 text-purple-700",
    agency: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg">HypeSpace Admin</span>
          {impersonating && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
              <Eye className="h-3 w-3 mr-1" /> Impersonating: {impersonating}
              <button onClick={onStopImpersonating} className="ml-2 underline text-xs">Stop</button>
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout}><LogOut className="h-4 w-4 mr-2" /> Logout</Button>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: "overview" as const, label: "Overview", icon: BarChart2 },
            { key: "orgs" as const, label: "Organizations", icon: Building2 },
            { key: "users" as const, label: "Users", icon: Users },
          ].map(t => (
            <Button key={t.key} variant={tab === t.key ? "default" : "outline"} size="sm" onClick={() => setTab(t.key)}>
              <t.icon className="h-4 w-4 mr-1.5" /> {t.label}
            </Button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Users", value: stats.users, icon: Users, color: "text-blue-600" },
              { label: "Organizations", value: stats.organizations, icon: Building2, color: "text-purple-600" },
              { label: "Events", value: stats.events, icon: Calendar, color: "text-green-600" },
              { label: "Campaigns", value: stats.campaigns, icon: Mail, color: "text-amber-600" },
              { label: "Guests", value: stats.guests, icon: UserPlus, color: "text-pink-600" },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-6 text-center">
                  <s.icon className={`h-8 w-8 mx-auto mb-2 ${s.color}`} />
                  <p className="text-3xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Organizations */}
        {tab === "orgs" && (
          <Card>
            <CardHeader>
              <CardTitle>All Organizations</CardTitle>
              <CardDescription>{orgs.length} organizations registered</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {orgs.map(org => (
                  <div key={org.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{org.name}</p>
                        <Badge variant="outline" className={planColors[org.plan] ?? ""}>{org.plan}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {org.owner ? `Owner: ${org.owner.name} (${org.owner.email})` : "No owner"} | {org.memberCount} members | {org.eventCount} events
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select defaultValue={org.plan} onValueChange={(v) => onChangePlan(org.id, v)}>
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="growth">Growth</SelectItem>
                          <SelectItem value="agency">Agency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users */}
        {tab === "users" && (
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>{users.length} users registered</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {users.map(u => (
                  <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{u.name}</p>
                        {u.emailVerified ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">Unverified</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email} | Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!u.emailVerified && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onVerifyUser(u.id)}>
                          <UserCheck className="h-3 w-3 mr-1" /> Verify
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onImpersonate(u.id, u.name)}>
                        <Eye className="h-3 w-3 mr-1" /> Impersonate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
