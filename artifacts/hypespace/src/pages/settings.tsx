import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetOrganization, useUpdateOrganization, useListEvents } from "@workspace/api-client-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building,
  CreditCard,
  Link as LinkIcon,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Webhook,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const orgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  description: z.string().optional(),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});
type OrgFormValues = z.infer<typeof orgSchema>;

type TabId = "general" | "integrations" | "billing";

// --- Platform field definitions ---
type FieldDef = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  hint?: string;
  required?: boolean;
  raw?: boolean; // store actual value even when type="password" (needed for API integrations that make calls)
};

type PlatformCredDef = {
  apiFields: FieldDef[];
  zapierFields: FieldDef[];
  accountNameKey: string;
  helpUrl: string;
  zapierHelpUrl: string;
  summary: string;
};

const PLATFORM_CREDS: Record<string, PlatformCredDef> = {
  instagram: {
    accountNameKey: "username",
    summary: "Connect via the Instagram Graph API to schedule posts and track engagement.",
    helpUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
    zapierHelpUrl: "https://zapier.com/apps/instagram/integrations",
    apiFields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "EAABsbCS...", required: true, hint: "Long-lived access token from Meta Developer Portal" },
      { key: "username", label: "Instagram Username", type: "text", placeholder: "@yourbrand", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true, hint: "Paste the webhook URL from your Zapier Instagram trigger" },
      { key: "username", label: "Instagram Username", type: "text", placeholder: "@yourbrand", required: true },
    ],
  },
  tiktok: {
    accountNameKey: "handle",
    summary: "Connect via TikTok for Business API to publish event videos and ads.",
    helpUrl: "https://ads.tiktok.com/marketing_api/docs",
    zapierHelpUrl: "https://zapier.com/apps/tiktok-lead-generation/integrations",
    apiFields: [
      { key: "appId", label: "App ID", type: "text", placeholder: "7xxxxxxxxxxxxxxxxx", required: true },
      { key: "appSecret", label: "App Secret", type: "password", placeholder: "Your app secret", required: true },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Bearer token from TikTok", required: true },
      { key: "handle", label: "TikTok Handle", type: "text", placeholder: "@yourbrand", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "handle", label: "TikTok Handle", type: "text", placeholder: "@yourbrand", required: true },
    ],
  },
  facebook: {
    accountNameKey: "pageName",
    summary: "Connect via Facebook Graph API to publish events and posts to your Page.",
    helpUrl: "https://developers.facebook.com/docs/graph-api/get-started",
    zapierHelpUrl: "https://zapier.com/apps/facebook-pages/integrations",
    apiFields: [
      { key: "pageAccessToken", label: "Page Access Token", type: "password", placeholder: "EAABsbCS...", required: true, hint: "From Meta Developer Portal > Your App > Access Tokens" },
      { key: "pageId", label: "Page ID", type: "text", placeholder: "123456789012345", required: true },
      { key: "pageName", label: "Page Name", type: "text", placeholder: "Your Brand Page", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "pageName", label: "Page Name", type: "text", placeholder: "Your Brand Page", required: true },
    ],
  },
  twitter: {
    accountNameKey: "handle",
    summary: "Connect via X (Twitter) API v2 to schedule tweets and engage attendees.",
    helpUrl: "https://developer.twitter.com/en/docs/twitter-api/getting-started/getting-access-to-the-twitter-api",
    zapierHelpUrl: "https://zapier.com/apps/twitter/integrations",
    apiFields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "Your consumer API key", required: true },
      { key: "apiSecret", label: "API Secret", type: "password", placeholder: "Your consumer API secret", required: true },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Your access token", required: true },
      { key: "accessTokenSecret", label: "Access Token Secret", type: "password", placeholder: "Your access token secret", required: true },
      { key: "handle", label: "X (Twitter) Handle", type: "text", placeholder: "@yourbrand", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "handle", label: "X Handle", type: "text", placeholder: "@yourbrand", required: true },
    ],
  },
  linkedin: {
    accountNameKey: "pageName",
    summary: "Connect via LinkedIn Marketing API to publish updates to your Company Page.",
    helpUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/getting-started",
    zapierHelpUrl: "https://zapier.com/apps/linkedin/integrations",
    apiFields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Your LinkedIn app Client ID", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Your LinkedIn app Client Secret", required: true },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "OAuth 2.0 access token", required: true, hint: "Generated from LinkedIn OAuth 2.0 flow" },
      { key: "pageName", label: "Company Page Name", type: "text", placeholder: "Your Company", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "pageName", label: "Company Page Name", type: "text", placeholder: "Your Company", required: true },
    ],
  },
  youtube: {
    accountNameKey: "channelName",
    summary: "Connect via YouTube Data API to manage your channel and stream events live.",
    helpUrl: "https://developers.google.com/youtube/v3/getting-started",
    zapierHelpUrl: "https://zapier.com/apps/youtube/integrations",
    apiFields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "AIzaSy...", required: true, hint: "From Google Cloud Console > Credentials" },
      { key: "channelId", label: "Channel ID", type: "text", placeholder: "UCxxxxxxxxxxxxxxxxxx", required: true },
      { key: "channelName", label: "Channel Name", type: "text", placeholder: "Your YouTube Channel", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "channelName", label: "Channel Name", type: "text", placeholder: "Your YouTube Channel", required: true },
    ],
  },
  hubspot: {
    accountNameKey: "portalId",
    summary: "Sync guest data, deals, and contacts with your HubSpot portal.",
    helpUrl: "https://developers.hubspot.com/docs/api/private-apps",
    zapierHelpUrl: "https://zapier.com/apps/hubspot/integrations",
    apiFields: [
      { key: "privateAppToken", label: "Private App Token", type: "password", placeholder: "pat-na1-...", required: true, hint: "Create under HubSpot > Settings > Integrations > Private Apps" },
      { key: "portalId", label: "Portal ID (Hub ID)", type: "text", placeholder: "12345678", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "portalId", label: "Portal ID", type: "text", placeholder: "12345678", required: true },
    ],
  },
  salesforce: {
    accountNameKey: "instanceUrl",
    summary: "Sync event registrations and guest data directly into Salesforce.",
    helpUrl: "https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm",
    zapierHelpUrl: "https://zapier.com/apps/salesforce/integrations",
    apiFields: [
      { key: "consumerKey", label: "Consumer Key", type: "text", placeholder: "3MVG9...", required: true, hint: "From Salesforce > Setup > App Manager > Connected App" },
      { key: "consumerSecret", label: "Consumer Secret", type: "password", placeholder: "Your consumer secret", required: true },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Salesforce access token", required: true },
      { key: "instanceUrl", label: "Instance URL", type: "text", placeholder: "https://yourorg.salesforce.com", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "instanceUrl", label: "Instance URL", type: "text", placeholder: "https://yourorg.salesforce.com", required: true },
    ],
  },
  mailchimp: {
    accountNameKey: "audienceId",
    summary: "Export guest lists and sync contacts with your Mailchimp audience.",
    helpUrl: "https://mailchimp.com/developer/marketing/guides/quick-start/",
    zapierHelpUrl: "https://zapier.com/apps/mailchimp/integrations",
    apiFields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "xxxxxxxxxxxxxxxxxxxx-us1", required: true, hint: "From Mailchimp > Account > Extras > API Keys" },
      { key: "serverPrefix", label: "Server Prefix", type: "text", placeholder: "us1", required: true, hint: "The prefix in your API key after the dash (e.g., us1)" },
      { key: "audienceId", label: "Audience (List) ID", type: "text", placeholder: "abc123def", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "audienceId", label: "Audience ID", type: "text", placeholder: "abc123def", required: true },
    ],
  },
  activecampaign: {
    accountNameKey: "apiUrl",
    summary: "Automate event follow-up emails and sync guest contacts with ActiveCampaign.",
    helpUrl: "https://developers.activecampaign.com/reference/authentication",
    zapierHelpUrl: "https://zapier.com/apps/activecampaign/integrations",
    apiFields: [
      { key: "apiUrl", label: "API URL", type: "text", placeholder: "https://youraccountname.api-us1.com", required: true, hint: "Found in ActiveCampaign > Settings > Developer" },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "Your ActiveCampaign API key", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "apiUrl", label: "Account URL", type: "text", placeholder: "https://youraccountname.api-us1.com", required: true },
    ],
  },
  zoho: {
    accountNameKey: "orgId",
    summary: "Manage leads and contacts from your events inside Zoho CRM.",
    helpUrl: "https://www.zoho.com/crm/developer/docs/api/v2/oauth-overview.html",
    zapierHelpUrl: "https://zapier.com/apps/zoho-crm/integrations",
    apiFields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "1000.XXXXXXXXXXXX", required: true, hint: "From Zoho API Console > OAuth Apps" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Your Zoho client secret", required: true },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Generated via OAuth", required: true },
      { key: "orgId", label: "Organization ID", type: "text", placeholder: "Your Zoho Org ID", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "orgId", label: "Organization ID", type: "text", placeholder: "Your Zoho Org ID", required: true },
    ],
  },
  klaviyo: {
    accountNameKey: "publicKey",
    summary: "Power event-driven email and SMS campaigns using Klaviyo's powerful flows.",
    helpUrl: "https://developers.klaviyo.com/en/docs/retrieve_api_credentials",
    zapierHelpUrl: "https://zapier.com/apps/klaviyo/integrations",
    apiFields: [
      { key: "privateKey", label: "Private API Key", type: "password", placeholder: "pk_xxxxxxxxxxxxxxxxxxxx", required: true, hint: "From Klaviyo > Settings > API Keys > Create Private API Key" },
      { key: "publicKey", label: "Public API Key (Site ID)", type: "text", placeholder: "XXXXXX", required: true },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "publicKey", label: "Public Key (Site ID)", type: "text", placeholder: "XXXXXX", required: true },
    ],
  },
  gohighlevel: {
    accountNameKey: "locationId",
    summary: "Import contacts tagged 'studyclub' directly from your Go HighLevel sub-account into any event guest list.",
    helpUrl: "https://help.gohighlevel.com/support/solutions/articles/155000002166",
    zapierHelpUrl: "https://zapier.com/apps/gohighlevel/integrations",
    apiFields: [
      { key: "apiKey", label: "Private Integration Token", type: "password", placeholder: "eyJhbGci...", required: true, raw: true, hint: "Go HighLevel > Settings > Integrations > Private Integrations > Create" },
      { key: "locationId", label: "Location / Sub-account ID", type: "text", placeholder: "abc123XYZxxx", required: true, raw: true, hint: "Go HighLevel > Settings > Business Info > Location ID" },
    ],
    zapierFields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", required: true },
      { key: "locationId", label: "Location ID", type: "text", placeholder: "abc123XYZxxx", required: true },
    ],
  },
};

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
  { id: "gohighlevel", name: "Go HighLevel", type: "crm", color: "#F97316", textColor: "#fff", description: "Import contacts with a tag (e.g. studyclub) directly into your event guest lists.", icon: "🚀" },
];

const ALL_PLATFORMS = [...SOCIAL_PLATFORMS, ...CRM_PLATFORMS];

type Integration = {
  id: number;
  platform: string;
  platformType: string;
  status: string;
  accountName: string | null;
  connectedAt: string;
  metadata?: Record<string, string> | null;
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
    mutationFn: async (payload: { platform: string; platformType: string; accountName: string; metadata: Record<string, string> }) => {
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

// --- Masked API key display helper ---
function maskSecret(val: string) {
  if (!val || val.length <= 8) return "••••••••";
  return val.slice(0, 4) + "••••••••" + val.slice(-4);
}

// --- Connect Modal ---
function ConnectModal({
  platform,
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  platform: Platform | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>, method: "api" | "zapier") => void;
  isSubmitting: boolean;
}) {
  const [method, setMethod] = useState<"api" | "zapier">("api");
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setMethod("api");
      setValues({});
      setErrors({});
      setShowFields({});
    }
  }, [open, platform]);

  if (!platform) return null;

  const cred = PLATFORM_CREDS[platform.id];
  const fields = method === "api" ? cred.apiFields : cred.zapierFields;

  const handleChange = (key: string, val: string) => {
    setValues(v => ({ ...v, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: "" }));
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        newErrors[f.key] = `${f.label} is required`;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(values, method);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: platform.color, color: platform.textColor }}
            >
              {platform.icon}
            </div>
            <div>
              <DialogTitle>Connect {platform.name}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">{cred.summary}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Method tabs */}
          <Tabs value={method} onValueChange={(v) => { setMethod(v as "api" | "zapier"); setValues({}); setErrors({}); }}>
            <TabsList className="w-full">
              <TabsTrigger value="api" className="flex-1 gap-1.5 text-xs">
                <Key className="h-3.5 w-3.5" />
                API / Token
              </TabsTrigger>
              <TabsTrigger value="zapier" className="flex-1 gap-1.5 text-xs">
                <Webhook className="h-3.5 w-3.5" />
                Zapier Webhook
              </TabsTrigger>
            </TabsList>

            <TabsContent value="api" className="mt-4 space-y-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Your credentials are encrypted and stored securely. They are never exposed in the UI.{" "}
                  <a href={cred.helpUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    How to get your keys →
                  </a>
                </p>
              </div>

              {fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <div className="relative">
                    <Input
                      type={field.type === "password" && !showFields[field.key] ? "password" : "text"}
                      placeholder={field.placeholder}
                      value={values[field.key] || ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className={errors[field.key] ? "border-destructive" : ""}
                    />
                    {field.type === "password" && (
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowFields(s => ({ ...s, [field.key]: !s[field.key] }))}
                      >
                        {showFields[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                  {errors[field.key] && <p className="text-xs text-destructive">{errors[field.key]}</p>}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="zapier" className="mt-4 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
                <p className="text-xs font-medium text-blue-800">How to set up Zapier:</p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://zapier.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">zapier.com</a> and create a new Zap</li>
                  <li>Choose <strong>{platform.name}</strong> as your trigger app</li>
                  <li>Choose <strong>Webhooks by Zapier</strong> as your action app</li>
                  <li>Copy the generated webhook URL and paste it below</li>
                </ol>
                <a
                  href={cred.zapierHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 underline font-medium"
                >
                  Browse {platform.name} Zapier templates <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <Input
                    type="text"
                    placeholder={field.placeholder}
                    value={values[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className={errors[field.key] ? "border-destructive" : ""}
                  />
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                  {errors[field.key] && <p className="text-xs text-destructive">{errors[field.key]}</p>}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-primary to-accent border-0 text-white"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</>
            ) : (
              `Connect ${platform.name}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- GHL Import Modal ---
type GHLContact = { name: string; email: string; phone: string | null; company: string | null };
type ImportStep = "configure" | "preview" | "success";

function GHLImportModal({ orgId, open, onClose }: { orgId: number; open: boolean; onClose: () => void }) {
  const { data: eventsData } = useListEvents(orgId);
  const events = eventsData ?? [];

  const [step, setStep] = useState<ImportStep>("configure");
  const [tag, setTag] = useState("studyclub");
  const [eventId, setEventId] = useState<string>("");
  const [contacts, setContacts] = useState<GHLContact[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const reset = () => {
    setStep("configure");
    setTag("studyclub");
    setEventId("");
    setContacts([]);
    setImportResult(null);
    setErrorMsg("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handlePreview = async () => {
    if (!tag.trim()) { setErrorMsg("Please enter a tag to search for."); return; }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/integrations/gohighlevel/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: tag.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch contacts");
      setContacts(data.contacts ?? []);
      setStep("preview");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!eventId) { setErrorMsg("Please select an event to import contacts into."); return; }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/integrations/gohighlevel/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: tag.trim(), eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult({ imported: data.imported, skipped: data.skipped });
      setStep("success");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">🚀</span> Go HighLevel — Import Contacts
          </DialogTitle>
          <DialogDescription>
            {step === "configure" && "Fetch contacts by tag from your GHL sub-account."}
            {step === "preview" && `${contacts.length} contact${contacts.length !== 1 ? "s" : ""} found with tag "${tag}".`}
            {step === "success" && "Import complete!"}
          </DialogDescription>
        </DialogHeader>

        {step === "configure" && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tag to import</label>
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="studyclub"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Contacts in GHL with this tag will be imported.</p>
            </div>
            {errorMsg && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errorMsg}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                className="bg-gradient-to-r from-[#F97316] to-[#FF1493] text-white border-0 hover:opacity-90"
                onClick={handlePreview}
                disabled={loading}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Fetching…</> : "Fetch Contacts →"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-2">
            {contacts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No contacts found with tag <strong>"{tag}"</strong> in Go HighLevel.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                        <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Company</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((c, i) => (
                        <tr key={i} className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{c.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                          <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{c.company ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Import into event</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select an event…</option>
                {events.map((ev: any) => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>

            {errorMsg && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errorMsg}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setStep("configure"); setErrorMsg(""); }}>← Back</Button>
              <Button
                className="bg-gradient-to-r from-[#F97316] to-[#FF1493] text-white border-0 hover:opacity-90"
                onClick={handleImport}
                disabled={loading || contacts.length === 0}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importing…</> : `Import ${contacts.length} Contact${contacts.length !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "success" && importResult && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-[#1a0533]">
                  {importResult.imported} contact{importResult.imported !== 1 ? "s" : ""} imported
                </p>
                {importResult.skipped > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {importResult.skipped} skipped (already in guest list)
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  ✓ {importResult.imported} added
                </Badge>
                {importResult.skipped > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    ⊘ {importResult.skipped} skipped
                  </Badge>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Import more</Button>
              <Button className="bg-gradient-to-r from-[#F97316] to-[#FF1493] text-white border-0" onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Platform Card ---
function PlatformCard({ platform, connected, onConnect, onDisconnect, onImport, isLoading }: {
  platform: Platform;
  connected: Integration | undefined;
  onConnect: (p: Platform) => void;
  onDisconnect: (p: Platform) => void;
  onImport?: (p: Platform) => void;
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
                  <span className="text-xs text-green-600 font-medium truncate max-w-[120px]">
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

        {connected && connected.metadata && (
          <div className="p-2 bg-muted/50 rounded-md text-xs font-mono text-muted-foreground truncate">
            {Object.entries(connected.metadata)
              .filter(([k]) => !k.toLowerCase().includes("secret") && !k.toLowerCase().includes("token") && !k.toLowerCase().includes("key"))
              .slice(0, 2)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {connected ? (
            <>
              {onImport && (
                <Button
                  size="sm"
                  className="flex-1 text-xs bg-gradient-to-r from-[#F97316] to-[#FF1493] border-0 text-white hover:opacity-90"
                  onClick={() => onImport(platform)}
                  disabled={isLoading}
                >
                  Import Contacts
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className={`text-xs text-destructive hover:text-destructive border-destructive/30 ${onImport ? "" : "flex-1"}`}
                onClick={() => onDisconnect(platform)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Disconnect
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

// --- Integrations Tab ---
function IntegrationsTab({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const { data: integrations, isLoading } = useIntegrations(orgId);
  const connectMutation = useConnectIntegration(orgId);
  const disconnectMutation = useDisconnectIntegration(orgId);

  const [modalPlatform, setModalPlatform] = useState<Platform | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [ghlImportOpen, setGhlImportOpen] = useState(false);

  const getConnected = (platformId: string) =>
    integrations?.find((i) => i.platform === platformId);

  const handleConnect = (platform: Platform) => {
    setModalPlatform(platform);
  };

  const handleModalSubmit = (values: Record<string, string>, method: "api" | "zapier") => {
    if (!modalPlatform) return;
    const cred = PLATFORM_CREDS[modalPlatform.id];
    const accountNameKey = cred.accountNameKey;
    const accountName = values[accountNameKey] || modalPlatform.name;

    // Store metadata — mask secrets unless field.raw is true (raw fields are needed for API calls)
    const metadata: Record<string, string> = { connectionMethod: method };
    const fields = method === "api" ? cred.apiFields : cred.zapierFields;
    for (const f of fields) {
      if (f.type === "password" && !f.raw) {
        metadata[f.key] = maskSecret(values[f.key] || "");
      } else {
        metadata[f.key] = values[f.key] || "";
      }
    }

    connectMutation.mutate(
      { platform: modalPlatform.id, platformType: modalPlatform.type, accountName, metadata },
      {
        onSuccess: () => {
          toast({ title: `${modalPlatform.name} connected!`, description: `Connected via ${method === "api" ? "API credentials" : "Zapier webhook"}.` });
          setModalPlatform(null);
        },
        onError: () => {
          toast({ title: "Connection failed", description: "Please check your credentials and try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleDisconnect = (platform: Platform) => {
    setDisconnectingId(platform.id);
    disconnectMutation.mutate(platform.id, {
      onSuccess: () => {
        toast({ title: `${platform.name} disconnected` });
        setDisconnectingId(null);
      },
      onError: () => {
        toast({ title: "Disconnect failed", variant: "destructive" });
        setDisconnectingId(null);
      },
    });
  };

  const connectedCount = integrations?.length ?? 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <ConnectModal
        platform={modalPlatform}
        open={!!modalPlatform}
        onClose={() => setModalPlatform(null)}
        onSubmit={handleModalSubmit}
        isSubmitting={connectMutation.isPending}
      />
      <GHLImportModal orgId={orgId} open={ghlImportOpen} onClose={() => setGhlImportOpen(false)} />

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
                isLoading={disconnectingId === platform.id}
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
                onImport={platform.id === "gohighlevel" ? () => setGhlImportOpen(true) : undefined}
                isLoading={disconnectingId === platform.id}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// --- Settings Page ---
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

          <div className="md:col-span-3 space-y-6">

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

            {activeTab === "integrations" && (
              <Card>
                <CardHeader>
                  <CardTitle>Connected Platforms</CardTitle>
                  <CardDescription>
                    Connect via API keys or Zapier webhooks to automate posting, sync contacts, and amplify your events.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <IntegrationsTab orgId={orgId} />
                </CardContent>
              </Card>
            )}

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
