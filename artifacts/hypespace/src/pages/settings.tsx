import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetOrganization, useUpdateOrganization } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building, CreditCard, Link as LinkIcon, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const orgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  description: z.string().optional(),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});
type OrgFormValues = z.infer<typeof orgSchema>;

type TabId = "general" | "integrations" | "billing";

// --- Platform definitions ---
type Platform = {
  id: string;
  name: string;
  type: "social" | "crm";
  color: string;
  textColor: string;
  description: string;
  icon: string;
};

const SOCIAL_PLATFORMS: Platform[] = [
  { id: "instagram", name: "Instagram", type: "social", color: "#E1306C", textColor: "#fff", description: "Share event updates, stories, and reels with your audience.", icon: "📸" },
  { id: "tiktok", name: "TikTok", type: "social", color: "#010101", textColor: "#fff", description: "Create short-form video content to promote your events.", icon: "🎵" },
  { id: "facebook", name: "Facebook", type: "social", color: "#1877F2", textColor: "#fff", description: "Publish events, posts and reach your community.", icon: "👥" },
  { id: "twitter", name: "Twitter / X", type: "social", color: "#14171A", textColor: "#fff", description: "Engage with attendees in real-time and spread the word.", icon: "🐦" },
  { id: "linkedin", name: "LinkedIn", type: "social", color: "#0A66C2", textColor: "#fff", description: "Connect with professionals and promote B2B events.", icon: "💼" },
  { id: "youtube", name: "YouTube", type: "social", color: "#FF0000", textColor: "#fff", description: "Live stream events and post highlight reels.", icon: "▶️" },
];

const CRM_PLATFORMS: Platform[] = [
  { id: "hubspot", name: "HubSpot", type: "crm", color: "#FF7A59", textColor: "#fff", description: "Sync contacts, track deals, and manage event pipelines.", icon: "🟠" },
  { id: "salesforce", name: "Salesforce", type: "crm", color: "#00A1E0", textColor: "#fff", description: "Sync event registrations and guest data with Salesforce.", icon: "☁️" },
  { id: "mailchimp", name: "Mailchimp", type: "crm", color: "#FFE01B", textColor: "#333", description: "Export guest lists and sync with Mailchimp audiences.", icon: "🐒" },
  { id: "activecampaign", name: "ActiveCampaign", type: "crm", color: "#356AE6", textColor: "#fff", description: "Automate email sequences and manage contacts.", icon: "⚡" },
  { id: "zoho", name: "Zoho CRM", type: "crm", color: "#E42527", textColor: "#fff", description: "Manage leads and contacts from your events.", icon: "📊" },
  { id: "klaviyo", name: "Klaviyo", type: "crm", color: "#1A1A1A", textColor: "#fff", description: "Power data-driven email and SMS campaigns for events.", icon: "📧" },
];

type Integration = {
  id: number;
  platform: string;
  platformType: string;
  status: string;
  accountName: string | null;
  connectedAt: string;
};

function useIntegrations(orgId: number) {
  return useQuery<Integration[]>({
    queryKey: ["integrations", orgId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/integrations`);
      if (!res.ok) throw new Error("Failed to fetch integrations");
      return res.json();
    },
  });
}

function useConnectIntegration(orgId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { platform: string; platformType: string; accountName: string }) => {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to connect");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations", orgId] }),
  });
}

function useDisconnectIntegration(orgId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (platform: string) => {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/integrations/${platform}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations", orgId] }),
  });
}

function PlatformCard({ platform, connected, onConnect, onDisconnect, isLoading }: {
  platform: Platform;
  connected: Integration | undefined;
  onConnect: (p: Platform) => void;
  onDisconnect: (p: Platform) => void;
  isLoading: boolean;
}) {
  return (
    <Card className="flex flex-col">
      <CardContent className="p-5 flex flex-col gap-4 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
              style={{ backgroundColor: platform.color, color: platform.textColor }}
            >
              {platform.icon}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{platform.name}</h3>
              {connected ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-600 font-medium">
                    {connected.accountName || "Connected"}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Not connected</span>
              )}
            </div>
          </div>
          {connected ? (
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs shrink-0">
              Active
            </Badge>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground flex-1">{platform.description}</p>

        <div className="flex gap-2">
          {connected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => onDisconnect(platform)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs px-2" asChild>
                <a href="#" className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="flex-1 text-xs bg-gradient-to-r from-primary to-accent border-0 text-white"
              onClick={() => onConnect(platform)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationsTab({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const { data: integrations, isLoading } = useIntegrations(orgId);
  const connectMutation = useConnectIntegration(orgId);
  const disconnectMutation = useDisconnectIntegration(orgId);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  const getConnected = (platformId: string) =>
    integrations?.find((i) => i.platform === platformId);

  const handleConnect = async (platform: Platform) => {
    setConnectingPlatform(platform.id);
    // Simulate OAuth handshake delay
    await new Promise((r) => setTimeout(r, 900));
    connectMutation.mutate(
      {
        platform: platform.id,
        platformType: platform.type,
        accountName: `@yourorg_${platform.id}`,
      },
      {
        onSuccess: () => {
          toast({ title: `${platform.name} connected successfully!`, description: "Your account is now linked." });
          setConnectingPlatform(null);
        },
        onError: () => {
          toast({ title: "Connection failed", variant: "destructive" });
          setConnectingPlatform(null);
        },
      }
    );
  };

  const handleDisconnect = (platform: Platform) => {
    setConnectingPlatform(platform.id);
    disconnectMutation.mutate(platform.id, {
      onSuccess: () => {
        toast({ title: `${platform.name} disconnected` });
        setConnectingPlatform(null);
      },
      onError: () => {
        toast({ title: "Disconnect failed", variant: "destructive" });
        setConnectingPlatform(null);
      },
    });
  };

  const connectedCount = integrations?.length ?? 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {connectedCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-700">
            <span className="font-semibold">{connectedCount} platform{connectedCount !== 1 ? "s" : ""} connected.</span>{" "}
            Your accounts are syncing with HypeSpace.
          </p>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-base mb-1">Social Media</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Schedule posts, auto-publish event updates, and engage your audience across platforms.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SOCIAL_PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              connected={getConnected(platform.id)}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              isLoading={connectingPlatform === platform.id}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-base mb-1">CRM Platforms</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Sync guest data, manage contacts, and automate follow-ups with your CRM.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CRM_PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              connected={getConnected(platform.id)}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              isLoading={connectingPlatform === platform.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const orgId = 1;
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const { data: org, isLoading } = useGetOrganization(orgId);
  const updateOrg = useUpdateOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: "", description: "", logoUrl: "" },
  });

  useEffect(() => {
    if (org) {
      form.reset({ name: org.name, description: org.description || "", logoUrl: org.logoUrl || "" });
    }
  }, [org, form]);

  const onSubmit = (data: OrgFormValues) => {
    updateOrg.mutate(
      { orgId, data },
      {
        onSuccess: () => {
          toast({ title: "Settings updated successfully" });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId] });
        },
        onError: (err) => {
          toast({ title: "Failed to update settings", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "general", label: "General", icon: Building },
    { id: "integrations", label: "Integrations", icon: LinkIcon },
    { id: "billing", label: "Billing & Plan", icon: CreditCard },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your organization preferences, integrations, and billing.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar nav */}
          <div className="flex flex-col gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                  activeTab === id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="md:col-span-3 space-y-6">

            {/* GENERAL TAB */}
            {activeTab === "general" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Organization Profile</CardTitle>
                    <CardDescription>This is how your organization will appear to your guests.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : (
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                          <div className="flex items-center gap-6 mb-6">
                            <div className="h-20 w-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center border">
                              {form.watch("logoUrl") ? (
                                <img src={form.watch("logoUrl")} alt="Logo" className="w-full h-full object-cover" />
                              ) : (
                                <Building className="h-8 w-8 text-muted-foreground opacity-50" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium mb-2">Organization Logo</p>
                              <Button type="button" variant="outline" size="sm">Upload new logo</Button>
                            </div>
                          </div>
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Organization Name</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Tell us about your organization..." className="resize-none" {...field} />
                                </FormControl>
                                <FormDescription>Displayed on your public event pages.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="pt-4 border-t flex justify-end">
                            <Button type="submit" disabled={updateOrg.isPending || !form.formState.isDirty} className="bg-primary text-primary-foreground">
                              {updateOrg.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-destructive/20 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>Irreversible actions for your organization.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">Delete Organization</h4>
                        <p className="text-xs text-muted-foreground mt-1">Permanently delete this organization and all its data.</p>
                      </div>
                      <Button variant="destructive">Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* INTEGRATIONS TAB */}
            {activeTab === "integrations" && (
              <Card>
                <CardHeader>
                  <CardTitle>Connected Platforms</CardTitle>
                  <CardDescription>
                    Connect your social media and CRM tools to automate posting, sync contacts, and amplify your events.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <IntegrationsTab orgId={orgId} />
                </CardContent>
              </Card>
            )}

            {/* BILLING TAB */}
            {activeTab === "billing" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Current Plan</CardTitle>
                    <CardDescription>Manage your subscription and limits.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-muted/30">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-lg capitalize">{org?.plan} Plan</span>
                            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">Active</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {org?.plan === "free" ? "Basic features for exploration." :
                             org?.plan === "starter" ? "Perfect for growing communities." :
                             org?.plan === "professional" ? "Advanced tools for serious organizers." : "Enterprise grade features."}
                          </p>
                        </div>
                        <Button variant="outline" className="mt-4 sm:mt-0">Manage Plan</Button>
                      </div>
                    )}
                    {!isLoading && org && (
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground mb-1">Active Events</div>
                          <div className="text-2xl font-bold">{org.eventCount} <span className="text-sm font-normal text-muted-foreground">/ {org.plan === "free" ? 1 : org.plan === "starter" ? 5 : "∞"}</span></div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground mb-1">Team Members</div>
                          <div className="text-2xl font-bold">{org.memberCount} <span className="text-sm font-normal text-muted-foreground">/ {org.plan === "professional" || org.plan === "enterprise" ? "∞" : 1}</span></div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Available Plans</CardTitle>
                    <CardDescription>Upgrade to unlock more events, team members, and advanced features.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      {[
                        { name: "Starter", price: "$29", events: "5 events", members: "3 members", highlight: false },
                        { name: "Professional", price: "$79", events: "Unlimited events", members: "10 members", highlight: true },
                        { name: "Enterprise", price: "Custom", events: "Unlimited", members: "Unlimited", highlight: false },
                      ].map((plan) => (
                        <div key={plan.name} className={`p-4 rounded-lg border ${plan.highlight ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-semibold">{plan.name}</span>
                            {plan.highlight && <Badge className="bg-primary text-white text-xs">Popular</Badge>}
                          </div>
                          <div className="text-2xl font-bold mb-1">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.price !== "Custom" ? "/mo" : ""}</span></div>
                          <ul className="text-xs text-muted-foreground space-y-1 mt-3 mb-4">
                            <li>✓ {plan.events}</li>
                            <li>✓ {plan.members}</li>
                            <li>✓ AI campaign generator</li>
                            <li>✓ Social media scheduling</li>
                          </ul>
                          <Button size="sm" variant={plan.highlight ? "default" : "outline"} className={`w-full ${plan.highlight ? "bg-gradient-to-r from-primary to-accent border-0 text-white" : ""}`}>
                            {plan.name === "Enterprise" ? "Contact Sales" : "Upgrade"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
