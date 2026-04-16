import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/components/auth-provider";
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
  Palette,
  Mail,
  Upload,
  RefreshCw,
  XCircle,
  Server,
  Send,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const orgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  description: z.string().optional(),
  logoUrl: z.string().refine((v) => !v || v.startsWith("data:") || /^https?:\/\//.test(v), "Must be a valid URL").optional().or(z.literal("")),
});
type OrgFormValues = z.infer<typeof orgSchema>;

type TabId = "general" | "branding" | "email" | "integrations" | "billing";

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
    summary: "Schedule posts and track engagement via Instagram.",
    helpUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
    zapierHelpUrl: "https://zapier.com/apps/instagram/integrations",
    apiFields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "EAABsbCS...", required: true, hint: "Meta Developer Portal → Your App → Access Tokens" },
      { key: "username", label: "Instagram Username", type: "text", placeholder: "@yourbrand", required: true },
    ],
    zapierFields: [],
  },
  tiktok: {
    accountNameKey: "handle",
    summary: "Publish event videos and ads via TikTok for Business.",
    helpUrl: "https://ads.tiktok.com/marketing_api/docs",
    zapierHelpUrl: "",
    apiFields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Bearer token from TikTok", required: true, hint: "TikTok for Business → Assets → App Management" },
      { key: "handle", label: "TikTok Handle", type: "text", placeholder: "@yourbrand", required: true },
    ],
    zapierFields: [],
  },
  facebook: {
    accountNameKey: "pageName",
    summary: "Publish events and posts to your Facebook Page.",
    helpUrl: "https://developers.facebook.com/docs/graph-api/get-started",
    zapierHelpUrl: "",
    apiFields: [
      { key: "pageAccessToken", label: "Page Access Token", type: "password", placeholder: "EAABsbCS...", required: true, hint: "Meta Developer Portal → Your App → Access Tokens" },
      { key: "pageName", label: "Page Name", type: "text", placeholder: "Your Brand Page", required: true },
    ],
    zapierFields: [],
  },
  twitter: {
    accountNameKey: "handle",
    summary: "Schedule tweets and engage attendees via X (Twitter) API v2.",
    helpUrl: "https://developer.twitter.com/en/portal/dashboard",
    zapierHelpUrl: "",
    apiFields: [
      { key: "bearerToken", label: "Bearer Token", type: "password", placeholder: "AAAAAAAAA...", required: true, hint: "developer.twitter.com → Your App → Keys and Tokens" },
      { key: "handle", label: "X Handle", type: "text", placeholder: "@yourbrand", required: true },
    ],
    zapierFields: [],
  },
  linkedin: {
    accountNameKey: "pageName",
    summary: "Publish updates to your LinkedIn Company Page.",
    helpUrl: "https://www.linkedin.com/developers/apps",
    zapierHelpUrl: "",
    apiFields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "AQV...", required: true, hint: "LinkedIn Developer Portal → Your App → Auth → OAuth 2.0 tokens" },
      { key: "pageName", label: "Company Page Name", type: "text", placeholder: "Your Company", required: true },
    ],
    zapierFields: [],
  },
  youtube: {
    accountNameKey: "channelName",
    summary: "Manage your channel and live-stream events via YouTube.",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    zapierHelpUrl: "",
    apiFields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "AIzaSy...", required: true, hint: "Google Cloud Console → APIs & Services → Credentials" },
      { key: "channelName", label: "Channel Name", type: "text", placeholder: "Your YouTube Channel", required: true },
    ],
    zapierFields: [],
  },
  hubspot: {
    accountNameKey: "portalId",
    summary: "Sync contacts and manage event pipelines in HubSpot.",
    helpUrl: "https://app.hubspot.com/private-apps",
    zapierHelpUrl: "",
    apiFields: [
      { key: "privateAppToken", label: "Private App Token", type: "password", placeholder: "pat-na1-...", required: true, hint: "HubSpot → Settings → Integrations → Private Apps → Create app" },
      { key: "portalId", label: "Portal ID", type: "text", placeholder: "12345678", required: true },
    ],
    zapierFields: [],
  },
  salesforce: {
    accountNameKey: "instanceUrl",
    summary: "Sync event registrations and guest data into Salesforce.",
    helpUrl: "https://login.salesforce.com",
    zapierHelpUrl: "",
    apiFields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "00D...", required: true, hint: "Salesforce → Setup → App Manager → Connected App" },
      { key: "instanceUrl", label: "Instance URL", type: "text", placeholder: "https://yourorg.salesforce.com", required: true },
    ],
    zapierFields: [],
  },
  mailchimp: {
    accountNameKey: "apiKey",
    summary: "Export guest lists and sync contacts with your Mailchimp audience.",
    helpUrl: "https://us1.admin.mailchimp.com/account/api/",
    zapierHelpUrl: "",
    apiFields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "xxxxxxxxxxxxxxxxxxxx-us1", required: true, hint: "Mailchimp → Account → Extras → API Keys → Create A Key" },
    ],
    zapierFields: [],
  },
  activecampaign: {
    accountNameKey: "apiUrl",
    summary: "Automate follow-up emails and sync guest contacts with ActiveCampaign.",
    helpUrl: "https://www.activecampaign.com/api/",
    zapierHelpUrl: "",
    apiFields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "Your ActiveCampaign API key", required: true, hint: "ActiveCampaign → Settings → Developer → API Access" },
      { key: "apiUrl", label: "Account URL", type: "text", placeholder: "https://youraccount.api-us1.com", required: true },
    ],
    zapierFields: [],
  },
  zoho: {
    accountNameKey: "accessToken",
    summary: "Manage leads and contacts from your events inside Zoho CRM.",
    helpUrl: "https://api-console.zoho.com/",
    zapierHelpUrl: "",
    apiFields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "1000.xxx...", required: true, hint: "Zoho API Console → OAuth Apps → Generate Token" },
    ],
    zapierFields: [],
  },
  klaviyo: {
    accountNameKey: "publicKey",
    summary: "Power event-driven email and SMS campaigns using Klaviyo flows.",
    helpUrl: "https://www.klaviyo.com/settings/account/api-keys",
    zapierHelpUrl: "",
    apiFields: [
      { key: "privateKey", label: "Private API Key", type: "password", placeholder: "pk_xxxxxxxxxxxxxxxxxxxx", required: true, hint: "Klaviyo → Settings → API Keys → Create Private API Key" },
      { key: "publicKey", label: "Site ID (Public Key)", type: "text", placeholder: "XXXXXX", required: true },
    ],
    zapierFields: [],
  },
  gohighlevel: {
    accountNameKey: "locationId",
    summary: "Import contacts directly from your Go HighLevel sub-account. Filter by tag, preview, then import as event guests. RSVPs sync back automatically.",
    helpUrl: "https://app.gohighlevel.com/settings/integrations",
    zapierHelpUrl: "",
    apiFields: [
      { key: "apiKey", label: "Private Integration Token", type: "password", placeholder: "eyJhbGci...", required: true, raw: true, hint: "Go HighLevel → Settings → Integrations → Private Integrations → Create" },
      { key: "locationId", label: "Location ID", type: "text", placeholder: "abc123XYZxxx", required: true, raw: true, hint: "Go HighLevel → Settings → Business Info → Location ID" },
    ],
    zapierFields: [],
  },
  custom_crm: {
    accountNameKey: "crmName",
    summary: "Connect any CRM via a webhook URL. HypeSpace will POST guest data (name, email, status, event) to your endpoint on every RSVP change.",
    helpUrl: "https://en.wikipedia.org/wiki/Webhook",
    zapierHelpUrl: "",
    apiFields: [
      { key: "crmName", label: "CRM Name", type: "text", placeholder: "e.g. Pipedrive, Nutshell, Keap…", required: true, hint: "A label to identify this integration" },
      { key: "webhookUrl", label: "Webhook URL", type: "text", placeholder: "https://your-crm.com/api/webhook", required: true, hint: "HypeSpace will POST JSON here on every guest RSVP change: { event, guest, status }" },
      { key: "apiKey", label: "Authorization Token (optional)", type: "password", placeholder: "Bearer sk-...", required: false, hint: "Sent as the Authorization header if provided" },
      { key: "contactListId", label: "Contact List / Pipeline ID (optional)", type: "text", placeholder: "list_123", required: false, hint: "Include this in the webhook payload to route contacts to a specific list" },
    ],
    zapierFields: [],
  },
  google_calendar: {
    accountNameKey: "calendarName",
    summary: "Sync your Google Calendar events to HypeSpace using your private iCal link.",
    helpUrl: "https://support.google.com/calendar/answer/37648",
    zapierHelpUrl: "",
    apiFields: [
      { key: "calendarUrl", label: "iCal URL (Secret Address)", type: "password", placeholder: "https://calendar.google.com/calendar/ical/.../basic.ics", required: true, raw: true, hint: "Google Calendar → Settings → [Your calendar] → Integrate calendar → Secret address in iCal format" },
      { key: "calendarName", label: "Calendar Name", type: "text", placeholder: "My Google Calendar", required: true },
    ],
    zapierFields: [],
  },
  outlook_calendar: {
    accountNameKey: "calendarName",
    summary: "Connect your Outlook or Office 365 calendar via the published iCal link.",
    helpUrl: "https://support.microsoft.com/en-us/office/share-your-calendar-in-outlook-on-the-web-7ecef8ae-139c-40d9-bae2-a23977ee58d5",
    zapierHelpUrl: "",
    apiFields: [
      { key: "calendarUrl", label: "iCal URL", type: "password", placeholder: "https://outlook.live.com/owa/calendar/.../reachcalendar.ics", required: true, raw: true, hint: "Outlook Web → Settings → Calendar → Shared calendars → Publish a calendar → Copy ICS link" },
      { key: "calendarName", label: "Calendar Name", type: "text", placeholder: "My Outlook Calendar", required: true },
    ],
    zapierFields: [],
  },
  apple_calendar: {
    accountNameKey: "calendarName",
    summary: "Connect your iCloud Calendar using a shared or public iCal link.",
    helpUrl: "https://support.apple.com/guide/icloud/share-calendars-mm6b1a7ab2/icloud",
    zapierHelpUrl: "",
    apiFields: [
      { key: "calendarUrl", label: "iCal URL", type: "password", placeholder: "webcal://p-caldav.icloud.com/published/2/.../calendar", required: true, raw: true, hint: "iCloud Calendar → select calendar → Share → tick 'Public Calendar' → copy link (change webcal:// to https://)" },
      { key: "calendarName", label: "Calendar Name", type: "text", placeholder: "My iCloud Calendar", required: true },
    ],
    zapierFields: [],
  },
  other_calendar: {
    accountNameKey: "calendarName",
    summary: "Connect any calendar that supports iCal/ICS format, like Fantastical, Calendly, or Notion.",
    helpUrl: "https://en.wikipedia.org/wiki/ICalendar",
    zapierHelpUrl: "",
    apiFields: [
      { key: "calendarUrl", label: "iCal / ICS URL", type: "password", placeholder: "https://your-calendar-provider.com/feed.ics", required: true, raw: true, hint: "Find this in your calendar app's sharing or export settings. Look for an iCal, ICS, or webcal link." },
      { key: "calendarName", label: "Calendar Name", type: "text", placeholder: "My Calendar", required: true },
    ],
    zapierFields: [],
  },
};

// --- Platform definitions ---
type Platform = {
  id: string;
  name: string;
  type: "social" | "crm" | "calendar";
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

const CALENDAR_PLATFORMS: Platform[] = [
  { id: "google_calendar", name: "Google Calendar", type: "calendar", color: "#4285F4", textColor: "#fff", description: "Paste your private iCal URL to pull Google Calendar events into HypeSpace.", icon: "📅" },
  { id: "outlook_calendar", name: "Outlook / Office 365", type: "calendar", color: "#0078D4", textColor: "#fff", description: "Connect your Microsoft 365 or Outlook.com calendar via iCal link.", icon: "📧" },
  { id: "apple_calendar", name: "Apple Calendar", type: "calendar", color: "#1C1C1E", textColor: "#fff", description: "Connect your iCloud calendar by sharing a public iCal link.", icon: "🍎" },
  { id: "other_calendar", name: "Other Calendar", type: "calendar", color: "#6366f1", textColor: "#fff", description: "Any calendar that supports iCal / ICS format (Calendly, Fantastical, etc.).", icon: "🗓️" },
];

const CRM_PLATFORMS: Platform[] = [
  { id: "gohighlevel", name: "Go HighLevel", type: "crm", color: "#F97316", textColor: "#fff", description: "Import contacts by tag, sync RSVPs back — built-in two-way integration.", icon: "⚡" },
  { id: "hubspot", name: "HubSpot", type: "crm", color: "#FF7A59", textColor: "#fff", description: "Sync contacts and track deal stages automatically.", icon: "🏢" },
  { id: "salesforce", name: "Salesforce", type: "crm", color: "#00A1E0", textColor: "#fff", description: "Enterprise-grade lead routing and opportunity mapping.", icon: "☁️" },
  { id: "zoho", name: "Zoho CRM", type: "crm", color: "#F0483E", textColor: "#fff", description: "Seamless event lead to customer conversion pipelines.", icon: "📊" },
  { id: "monday", name: "monday.com", type: "crm", color: "#FF3D57", textColor: "#fff", description: "Orchestrate your event tasks and lead follow-up.", icon: "📝" },
  { id: "custom_crm", name: "Custom CRM", type: "crm", color: "#6d28d9", textColor: "#fff", description: "Connect any CRM via a webhook URL — Pipedrive, Nutshell, Keap, or your own system.", icon: "🔌" },
];


const ALL_PLATFORMS = [...SOCIAL_PLATFORMS, ...CRM_PLATFORMS, ...CALENDAR_PLATFORMS];

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
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setValues({}); setErrors({}); setShowFields({}); }
  }, [open, platform]);

  if (!platform) return null;
  const cred = PLATFORM_CREDS[platform.id];
  const fields = cred.apiFields;

  const handleChange = (key: string, val: string) => {
    setValues(v => ({ ...v, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: "" }));
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) newErrors[f.key] = "Required";
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    onSubmit(values, "api");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: platform.color, color: platform.textColor }}
            >
              {platform.icon}
            </div>
            <div>
              <DialogTitle className="text-base">Connect {platform.name}</DialogTitle>
              <a
                href={cred.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Where to find my credentials <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <label className="text-sm font-medium">{field.label}</label>
              <div className="relative">
                <Input
                  type={field.type === "password" && !showFields[field.key] ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={values[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className={`h-9 text-sm font-mono ${errors[field.key] ? "border-destructive" : ""}`}
                  autoComplete="off"
                />
                {field.type === "password" && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowFields(s => ({ ...s, [field.key]: !s[field.key] }))}
                  >
                    {showFields[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              {field.hint && !errors[field.key] && (
                <p className="text-xs text-muted-foreground">{field.hint}</p>
              )}
              {errors[field.key] && <p className="text-xs text-destructive">{errors[field.key]}</p>}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 text-white border-0 hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${platform.color}, ${platform.color}bb)` }}
          >
            {isSubmitting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Connecting…</>
              : "Connect"
            }
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
  const [filterMode, setFilterMode] = useState<"all" | "tags">("all");
  const [tagInput, setTagInput] = useState("");
  const [eventId, setEventId] = useState<string>("");
  const [contacts, setContacts] = useState<GHLContact[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const parsedTags = tagInput.split(",").map(t => t.trim()).filter(Boolean);

  const reset = () => {
    setStep("configure");
    setFilterMode("all");
    setTagInput("");
    setEventId("");
    setContacts([]);
    setImportResult(null);
    setErrorMsg("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handlePreview = async () => {
    setErrorMsg("");
    if (filterMode === "tags" && parsedTags.length === 0) {
      setErrorMsg("Enter at least one tag, or switch to 'All contacts'.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/integrations/gohighlevel/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: filterMode === "tags" ? parsedTags : [] }),
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
        body: JSON.stringify({ tags: filterMode === "tags" ? parsedTags : [], eventId }),
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

  const previewLabel = filterMode === "all"
    ? `${contacts.length} contact${contacts.length !== 1 ? "s" : ""} found`
    : `${contacts.length} contact${contacts.length !== 1 ? "s" : ""} with tag${parsedTags.length !== 1 ? "s" : ""} ${parsedTags.map(t => `"${t}"`).join(", ")}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">🚀</span> Go HighLevel — Import Contacts
          </DialogTitle>
          <DialogDescription>
            {step === "configure" && "Choose which contacts to pull from your GHL sub-account."}
            {step === "preview" && previewLabel}
            {step === "success" && "Import complete!"}
          </DialogDescription>
        </DialogHeader>

        {step === "configure" && (
          <div className="space-y-4 py-2">
            {/* Filter mode toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
                  filterMode === "all"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                <div className="font-semibold">All contacts</div>
                <div className="text-xs opacity-70 mt-0.5">Import everyone</div>
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("tags")}
                className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
                  filterMode === "tags"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                <div className="font-semibold">Filter by tag</div>
                <div className="text-xs opacity-70 mt-0.5">One or more tags</div>
              </button>
            </div>

            {filterMode === "tags" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="studyclub, vip, speaker"
                  className="font-mono"
                  autoFocus
                />
                {parsedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {parsedTags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Contacts matching any of these tags will be imported.</p>
              </div>
            )}

            {errorMsg && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errorMsg}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
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
                No contacts found with tag <strong>"{tagInput}"</strong> in Go HighLevel.
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
                className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
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
              <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0" onClick={handleClose}>Done</Button>
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
                  className="flex-1 text-xs bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
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
              className="flex-1 text-xs bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
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

        <div>
          <h3 className="font-semibold text-base mb-1">Calendar & Meetings</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Sync with your personal or team calendars to manage availability and invitations.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CALENDAR_PLATFORMS.map((platform) => (
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
      </div>
    </>
  );
}

// --- Branding schemas ---
const brandingSchema = z.object({
  logoUrl: z.string().refine((v) => !v || v.startsWith("data:") || /^https?:\/\//.test(v), "Must be a valid URL").optional().or(z.literal("")),
  primaryColor: z.string().min(4, "Select a color"),
  accentColor: z.string().min(4, "Select a color"),
  fromEmail: z.string().email("Must be a valid email").optional().or(z.literal("")),
  replyToEmail: z.string().email("Must be a valid email").optional().or(z.literal("")),
  emailFooterText: z.string().optional(),
});
type BrandingFormValues = z.infer<typeof brandingSchema>;

// --- Email Provider wizard ---
type ProviderValue = "gmail" | "outlook" | "resend" | "sendgrid" | "postmark" | "custom";

type ProviderDef = {
  value: ProviderValue;
  label: string;
  icon: string;
  tagline: string;
  badge?: string;
  badgeColor?: string;
  host: string;
  port: number;
  fixedUser?: string;
  userLabel: string;
  userPlaceholder: string;
  passLabel: string;
  steps: Array<{ text: string; link?: string; linkLabel?: string }>;
};

const PROVIDER_DEFS: ProviderDef[] = [
  {
    value: "gmail",
    label: "Gmail",
    icon: "✉️",
    tagline: "Use your existing Google / Gmail account",
    host: "smtp.gmail.com",
    port: 587,
    userLabel: "Your Gmail address",
    userPlaceholder: "you@gmail.com",
    passLabel: "App password (16 letters, no spaces)",
    steps: [
      { text: "Open your Google Account security settings", link: "https://myaccount.google.com/security", linkLabel: "Open Google Security →" },
      { text: "Make sure 2-Step Verification is turned on. If not, turn it on first." },
      { text: 'Search for "App passwords" on that same page and click it.' },
      { text: 'Choose "Mail" as the app. Copy the 16-letter password Google shows you.' },
      { text: "Paste that password in the field below (not your regular Gmail password)." },
    ],
  },
  {
    value: "outlook",
    label: "Outlook",
    icon: "📧",
    tagline: "Use your Microsoft / Office 365 account",
    host: "smtp.office365.com",
    port: 587,
    userLabel: "Your Microsoft email address",
    userPlaceholder: "you@outlook.com",
    passLabel: "Your Microsoft password",
    steps: [
      { text: "Make sure your account allows SMTP sending.", link: "https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353", linkLabel: "Check Microsoft guide →" },
      { text: "Enter your full Microsoft email address below." },
      { text: "Enter your regular Microsoft account password." },
      { text: "If your org uses multi-factor auth, you may need an app password from your IT admin." },
    ],
  },
  {
    value: "resend",
    label: "Resend",
    icon: "⚡",
    tagline: "Free service, easiest to set up — recommended for new users",
    badge: "Recommended",
    badgeColor: "bg-violet-500/10 text-violet-700 border-violet-500/20",
    host: "smtp.resend.com",
    port: 587,
    fixedUser: "resend",
    userLabel: "Username",
    userPlaceholder: "resend",
    passLabel: "Your Resend API key",
    steps: [
      { text: "Create a free Resend account", link: "https://resend.com/signup", linkLabel: "Sign up for free →" },
      { text: 'In Resend, click "API Keys" in the left menu, then "Create API Key".' },
      { text: "Give it any name (e.g. HypeSpace) and click Create." },
      { text: "Copy the key that appears and paste it below." },
    ],
  },
  {
    value: "sendgrid",
    label: "SendGrid",
    icon: "📮",
    tagline: "Twilio SendGrid — popular for bulk email",
    host: "smtp.sendgrid.net",
    port: 587,
    fixedUser: "apikey",
    userLabel: "Username",
    userPlaceholder: "apikey",
    passLabel: "Your SendGrid API key",
    steps: [
      { text: "Log into SendGrid and go to API Keys", link: "https://app.sendgrid.com/settings/api_keys", linkLabel: "Open SendGrid →" },
      { text: 'Click "Create API Key", give it Full Access, and click Create.' },
      { text: "Copy the key shown and paste it below." },
    ],
  },
  {
    value: "postmark",
    label: "Postmark",
    icon: "📬",
    tagline: "High deliverability for transactional email",
    host: "smtp.postmarkapp.com",
    port: 587,
    userLabel: "Server API token",
    userPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    passLabel: "Server API token (same as above)",
    steps: [
      { text: "Log into Postmark and open your server", link: "https://account.postmarkapp.com/servers", linkLabel: "Open Postmark →" },
      { text: 'Click "API Tokens" tab and copy your Server API Token.' },
      { text: "Paste that token in both fields below (Postmark uses it as both username and password)." },
    ],
  },
  {
    value: "custom",
    label: "Other / Custom",
    icon: "⚙️",
    tagline: "I have my own mail server or a different provider",
    host: "",
    port: 587,
    userLabel: "Username / email",
    userPlaceholder: "you@yourdomain.com",
    passLabel: "Password",
    steps: [
      { text: "Ask your email provider or IT admin for the SMTP host, port, username, and password." },
      { text: "Fill in all the fields below exactly as given." },
    ],
  },
];

type EmailProviderConfig = {
  id: number;
  provider: string;
  host: string;
  port: number;
  user: string;
  passSet: boolean;
  fromEmail: string;
  fromName: string;
  status: string;
} | null;

function StepBubble({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
      done ? "bg-green-500 text-white" : active ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground"
    }`}>
      {done ? <CheckCircle2 className="h-4 w-4" /> : n}
    </div>
  );
}

function EmailProviderCard({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [provider, setProvider] = useState<ProviderValue>("resend");
  const [customHost, setCustomHost] = useState("");
  const [customPort, setCustomPort] = useState("587");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [testTo, setTestTo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: config, isLoading, refetch } = useQuery<EmailProviderConfig>({
    queryKey: ["email-provider", orgId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/email-provider`);
      return res.json();
    },
  });

  useEffect(() => {
    if (config) {
      setProvider((config.provider as ProviderValue) ?? "resend");
      setUser(config.user ?? "");
      setFromEmail(config.fromEmail ?? "");
      setFromName(config.fromName ?? "");
      setCustomHost(config.host ?? "");
      setCustomPort(String(config.port ?? 587));
    }
  }, [config]);

  const def = PROVIDER_DEFS.find(p => p.value === provider) ?? PROVIDER_DEFS[0];

  const onSave = async () => {
    const effectiveUser = def.fixedUser ?? user;
    if (!effectiveUser || (!pass && !config?.passSet)) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (!fromEmail || !fromName) {
      toast({ title: "Please enter your name and email address", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        provider,
        user: effectiveUser,
        fromEmail,
        fromName,
      };
      if (pass) body.pass = pass;
      if (provider === "custom") { body.host = customHost; body.port = parseInt(customPort, 10); }
      const res = await fetch(`${BASE}/api/organizations/${orgId}/email-provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setPass("");
      setEditing(false);
      refetch();
      setStep(3);
    } catch (err: any) {
      toast({ title: "Could not connect", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const onTest = async () => {
    if (!testTo || !testTo.includes("@")) {
      toast({ title: "Enter your email address to receive the test", variant: "destructive" });
      return;
    }
    setIsTesting(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/email-provider/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTestSent(true);
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const onRemove = async () => {
    setIsRemoving(true);
    try {
      await fetch(`${BASE}/api/organizations/${orgId}/email-provider`, { method: "DELETE" });
      toast({ title: "Email provider removed" });
      setUser(""); setPass(""); setFromEmail(""); setFromName(""); setTestSent(false);
      setStep(1); setEditing(false);
      refetch();
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" });
    } finally {
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return <Card><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>;
  }

  const isConnected = !!config && !editing;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Email Setup
            </CardTitle>
            <CardDescription>Connect an email account so your guests actually receive emails</CardDescription>
          </div>
          {isConnected && (
            <Badge className="bg-green-500/10 text-green-700 border-green-500/20 border">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* === Connected summary view === */}
        {isConnected && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 flex items-start gap-4">
              <div className="text-3xl leading-none">{PROVIDER_DEFS.find(p => p.value === config.provider)?.icon ?? "📧"}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{PROVIDER_DEFS.find(p => p.value === config.provider)?.label ?? config.provider}</div>
                <div className="text-sm text-muted-foreground mt-0.5">Sending as <strong className="text-foreground">{config.fromName}</strong> &lt;{config.fromEmail}&gt;</div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Send a test to make sure it's working</p>
              {testSent ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-4 py-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Test email sent to <strong>{testTo}</strong>. Check your inbox!
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="your@email.com"
                    value={testTo}
                    onChange={e => setTestTo(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button variant="outline" size="sm" onClick={onTest} disabled={isTesting}>
                    {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                    Send Test
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setEditing(true); setStep(2); }}>
                Change provider
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove} disabled={isRemoving}>
                {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Disconnect
              </Button>
            </div>
          </div>
        )}

        {/* === Wizard === */}
        {!isConnected && (
          <>
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <StepBubble n={1} active={step === 1} done={step > 1} />
              <div className={`flex-1 h-0.5 rounded ${step > 1 ? "bg-green-400" : "bg-muted"}`} />
              <StepBubble n={2} active={step === 2} done={step > 2} />
              <div className={`flex-1 h-0.5 rounded ${step > 2 ? "bg-green-400" : "bg-muted"}`} />
              <StepBubble n={3} active={step === 3} done={testSent} />
            </div>

            {/* Step 1: Pick a provider */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Which email service would you like to send from?</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PROVIDER_DEFS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setProvider(p.value)}
                      className={`relative text-left rounded-xl border-2 p-3 transition-all hover:border-violet-400 ${
                        provider === p.value ? "border-violet-500 bg-violet-50" : "border-border bg-card"
                      }`}
                    >
                      {p.badge && (
                        <span className={`absolute -top-2 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.badgeColor}`}>
                          {p.badge}
                        </span>
                      )}
                      <div className="text-2xl mb-1">{p.icon}</div>
                      <div className="font-semibold text-sm">{p.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{p.tagline}</div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end pt-1">
                  <Button onClick={() => setStep(2)}>
                    Continue with {def.label} →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Setup guide + credentials */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{def.icon}</span>
                  <div>
                    <p className="font-semibold">{def.label}</p>
                    <button className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => setStep(1)}>
                      ← Choose a different provider
                    </button>
                  </div>
                </div>

                {/* Step guide */}
                <div className="rounded-xl bg-muted/40 border p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Follow these steps</p>
                  {def.steps.map((s, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-muted-foreground leading-snug">
                        {s.text}
                        {s.link && (
                          <a href={s.link} target="_blank" rel="noopener noreferrer"
                            className="ml-1.5 inline-flex items-center gap-0.5 text-violet-600 font-medium hover:underline">
                            {s.linkLabel} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Custom host/port */}
                {provider === "custom" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-sm font-medium">Mail server address (SMTP host)</label>
                      <Input placeholder="mail.yourdomain.com" value={customHost} onChange={e => setCustomHost(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Port</label>
                      <Input placeholder="587" value={customPort} onChange={e => setCustomPort(e.target.value)} />
                    </div>
                  </div>
                )}

                {/* Credentials */}
                <div className="space-y-3">
                  {def.fixedUser ? (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      Username is automatically set to <code className="text-foreground font-mono font-medium">{def.fixedUser}</code>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{def.userLabel}</label>
                      <Input placeholder={def.userPlaceholder} value={user} onChange={e => setUser(e.target.value)} autoComplete="off" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {def.passLabel}
                      {config?.passSet && <span className="text-xs text-muted-foreground font-normal ml-1">(already saved — leave blank to keep it)</span>}
                    </label>
                    <div className="relative">
                      <Input
                        type={showPass ? "text" : "password"}
                        placeholder={config?.passSet ? "••••••••" : "Paste here"}
                        value={pass}
                        onChange={e => setPass(e.target.value)}
                        autoComplete="new-password"
                        className="pr-9"
                      />
                      <button type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPass(v => !v)}>
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Display identity */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">How should your emails appear?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Your name (shown as the sender)</label>
                      <Input placeholder="e.g. Events Team" value={fromName} onChange={e => setFromName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">From email address</label>
                      <Input placeholder={def.fixedUser ? "you@yourdomain.com" : (user || "you@example.com")} value={fromEmail} onChange={e => setFromEmail(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-between pt-1">
                  <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                  <Button onClick={onSave} disabled={isSaving}>
                    {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Connecting...</> : "Save & Continue →"}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Test */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="text-center py-4 space-y-2">
                  <div className="text-4xl">🎉</div>
                  <p className="font-semibold text-lg">Almost done!</p>
                  <p className="text-sm text-muted-foreground">Send yourself a quick test to confirm everything is working.</p>
                </div>

                {testSent ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
                    <p className="font-semibold text-green-800">Test email sent to {testTo}</p>
                    <p className="text-sm text-green-700">Check your inbox — it should arrive within a minute. You're all set!</p>
                    <Button className="mt-2" onClick={() => { refetch(); setEditing(false); }}>
                      Done →
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Enter your email address to receive the test</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="your@email.com"
                        value={testTo}
                        onChange={e => setTestTo(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={onTest} disabled={isTesting}>
                        {isTesting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Sending...</> : <><Send className="h-3.5 w-3.5 mr-1.5" /> Send Test</>}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">A real email will arrive in your inbox confirming the connection works.</p>
                    <button className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => { refetch(); }}>
                      Skip test for now
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Email Sending Tab ---
type SendingDomain = {
  id: number;
  domain: string;
  fromEmail: string;
  fromName: string;
  dnsRecords: Array<{ type: string; name: string; value: string }>;
  status: string;
  verifiedAt: string | null;
};

function EmailSendingTab({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const [addDomain, setAddDomain] = useState("");
  const [addFromEmail, setAddFromEmail] = useState("");
  const [addFromName, setAddFromName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<number, Array<{ record: string; status: string; detail: string }>>>({});

  const { data: domains, isLoading, refetch } = useQuery<SendingDomain[]>({
    queryKey: ["sending-domains", orgId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/sending-domains`);
      if (!res.ok) return [];
      return res.json();
    },
    retry: false,
  });

  const onAdd = async () => {
    if (!addDomain || !addFromEmail || !addFromName) return;
    setIsAdding(true);
    try {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/sending-domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: addDomain, fromEmail: addFromEmail, fromName: addFromName }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast({ title: "Domain added", description: "Add the DNS records below to verify." });
      setAddDomain(""); setAddFromEmail(""); setAddFromName("");
      setShowAddForm(false);
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to add domain", description: err.message, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const onVerify = async (domainId: number) => {
    setVerifyingId(domainId);
    try {
      const res = await fetch(`${BASE}/api/organizations/${orgId}/sending-domains/${domainId}/verify`, { method: "POST" });
      const data = await res.json();
      setVerifyResults(prev => ({ ...prev, [domainId]: data.checks }));
      if (data.status === "verified") {
        toast({ title: "Domain verified!", description: "Emails will now send from your domain." });
      } else {
        toast({ title: "Verification incomplete", description: "Some DNS records are missing. See details below.", variant: "destructive" });
      }
      refetch();
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setVerifyingId(null);
    }
  };

  const onDelete = async (domainId: number) => {
    await fetch(`${BASE}/api/organizations/${orgId}/sending-domains/${domainId}`, { method: "DELETE" });
    toast({ title: "Domain removed" });
    refetch();
  };

  return (
    <div className="space-y-6">
      <EmailProviderCard orgId={orgId} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sending Domain</CardTitle>
              <CardDescription>Send emails from your own domain (e.g. events@yourdomain.com)</CardDescription>
            </div>
            {!showAddForm && (
              <Button size="sm" onClick={() => setShowAddForm(true)}>
                Add Domain
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add domain form */}
          {showAddForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Domain</label>
                  <Input placeholder="yourdomain.com" value={addDomain} onChange={e => setAddDomain(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">From Name</label>
                  <Input placeholder="Your Practice" value={addFromName} onChange={e => setAddFromName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">From Email</label>
                <Input placeholder="events@yourdomain.com" value={addFromEmail} onChange={e => setAddFromEmail(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                <Button size="sm" onClick={onAdd} disabled={isAdding || !addDomain || !addFromEmail || !addFromName}>
                  {isAdding ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Adding...</> : "Add Domain"}
                </Button>
              </div>
            </div>
          )}

          {/* Domain list */}
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : domains?.length === 0 && !showAddForm ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-foreground mb-1">No sending domain configured</p>
              <p className="text-sm">Emails currently send from the default HypeSpace domain. Add your own domain for professional branding.</p>
            </div>
          ) : (
            domains?.map(d => (
              <div key={d.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {d.fromName} &lt;{d.fromEmail}&gt;
                      <Badge variant="outline" className={
                        d.status === "verified"
                          ? "bg-green-500/10 text-green-700 border-green-500/20"
                          : d.status === "failed"
                            ? "bg-red-500/10 text-red-700 border-red-200"
                            : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                      }>
                        {d.status === "verified" && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                        {d.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{d.domain}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={verifyingId === d.id}
                      onClick={() => onVerify(d.id)}
                    >
                      {verifyingId === d.id ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Checking...</> :
                        <><RefreshCw className="h-3 w-3 mr-1" /> Verify DNS</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => onDelete(d.id)}>
                      Remove
                    </Button>
                  </div>
                </div>

                {/* DNS Records to add */}
                {d.status !== "verified" && d.dnsRecords && d.dnsRecords.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">Add these DNS records with your domain registrar:</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1 pr-3 font-medium text-muted-foreground">Type</th>
                            <th className="text-left py-1 pr-3 font-medium text-muted-foreground">Name</th>
                            <th className="text-left py-1 font-medium text-muted-foreground">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.dnsRecords.map((r, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-1.5 pr-3 font-mono">{r.type}</td>
                              <td className="py-1.5 pr-3 font-mono text-muted-foreground break-all">{r.name}</td>
                              <td className="py-1.5 font-mono text-muted-foreground break-all">{r.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-muted-foreground">DNS changes can take up to 48 hours to propagate. Click "Verify DNS" to check.</p>
                  </div>
                )}

                {/* Verification results */}
                {verifyResults[d.id] && (
                  <div className="space-y-1.5">
                    {verifyResults[d.id].map((check, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
                        check.status === "pass" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      }`}>
                        {check.status === "pass" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        <span className="font-medium">{check.record}</span>
                        <span className="text-muted-foreground">— {check.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong className="text-foreground">1.</strong> Enter your domain and the email address you want to send from.</p>
          <p><strong className="text-foreground">2.</strong> Add the DNS records shown to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.).</p>
          <p><strong className="text-foreground">3.</strong> Click "Verify DNS" — once verified, all campaign and reminder emails will be sent from your domain.</p>
          <p><strong className="text-foreground">4.</strong> Until verified, emails send from the default HypeSpace domain.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Branding Tab ---
function BrandingTab({ orgId }: { orgId: number }) {
  const { data: org, isLoading } = useGetOrganization(orgId);
  const updateOrg = useUpdateOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      logoUrl: "",
      primaryColor: "#7C3AED",
      accentColor: "#EA580C",
      fromEmail: "",
      replyToEmail: "",
      emailFooterText: "",
    },
  });

  useEffect(() => {
    if (org) {
      form.reset({
        logoUrl: org.logoUrl || "",
        primaryColor: org.primaryColor || "#7C3AED",
        accentColor: org.accentColor || "#EA580C",
        fromEmail: org.fromEmail || "",
        replyToEmail: org.replyToEmail || "",
        emailFooterText: org.emailFooterText || "",
      });
    }
  }, [org, form]);

  const watched = form.watch();

  const onSubmit = (data: BrandingFormValues) => {
    updateOrg.mutate(
      { orgId, data: { logoUrl: data.logoUrl || null, primaryColor: data.primaryColor, accentColor: data.accentColor, fromEmail: data.fromEmail || null, replyToEmail: data.replyToEmail || null, emailFooterText: data.emailFooterText || null } },
      {
        onSuccess: () => {
          toast({ title: "Branding saved" });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId] });
        },
        onError: (err) => {
          toast({ title: "Failed to save branding", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  const previewGradient = `linear-gradient(135deg, ${watched.primaryColor || "#7C3AED"}, ${watched.accentColor || "#EA580C"})`;
  const orgName = org?.name || "Your Organization";
  const footerText = watched.emailFooterText || `You're receiving this because you're on our guest list. © ${orgName}`;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo</CardTitle>
            <CardDescription>Shown in the email header and on your event pages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-xl border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {watched.logoUrl ? (
                  <img src={watched.logoUrl} alt="Logo preview" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <Building className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo</FormLabel>
                      <FormControl>
                        <div className="flex gap-2 items-center">
                          <Input placeholder="https://yoursite.com/logo.png" {...field} />
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) {
                                toast({ title: "Image too large", description: "Please choose an image under 2 MB.", variant: "destructive" });
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () => {
                                form.setValue("logoUrl", String(reader.result), { shouldDirty: true, shouldValidate: true });
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                          <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>Upload</Button>
                        </div>
                      </FormControl>
                      <FormDescription>Paste a URL or upload from your computer (max 2 MB).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Brand Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand Colors</CardTitle>
            <CardDescription>Used in email headers, buttons, and accent elements.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <input
                            type="color"
                            value={field.value || "#7C3AED"}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="w-12 h-10 rounded-lg border cursor-pointer p-0.5 bg-transparent"
                          />
                        </div>
                        <Input
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="#7C3AED"
                          className="font-mono uppercase"
                          maxLength={7}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accentColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accent Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <input
                            type="color"
                            value={field.value || "#EA580C"}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="w-12 h-10 rounded-lg border cursor-pointer p-0.5 bg-transparent"
                          />
                        </div>
                        <Input
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="#EA580C"
                          className="font-mono uppercase"
                          maxLength={7}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="mt-4 h-10 rounded-lg overflow-hidden" style={{ background: previewGradient }}>
              <div className="h-full flex items-center justify-center text-white text-xs font-semibold opacity-90 tracking-wide">Gradient Preview</div>
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Sender Settings</CardTitle>
            <CardDescription>Control how your campaigns appear in recipients' inboxes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fromEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Email</FormLabel>
                    <FormControl>
                      <Input placeholder="events@yourcompany.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="replyToEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reply-To Email</FormLabel>
                    <FormControl>
                      <Input placeholder="hello@yourcompany.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="emailFooterText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Footer</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={`You're receiving this because you're on our guest list. © ${orgName}. Unsubscribe`}
                      className="resize-none min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Live Email Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Preview
            </CardTitle>
            <CardDescription>Live preview of how your branded emails will look.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden rounded-b-xl">
            <div className="scale-[0.85] origin-top-left w-[117%] pointer-events-none select-none">
              <div style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <div style={{ background: previewGradient, padding: "32px 40px", textAlign: "center" }}>
                  {watched.logoUrl ? (
                    <img src={watched.logoUrl} alt="Logo" style={{ height: 40, maxWidth: 160, objectFit: "contain", marginBottom: 12 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ color: "white", fontWeight: 700, fontSize: 22, marginBottom: 4 }}>{orgName}</div>
                  )}
                  <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Where moments are made</div>
                </div>
                <div style={{ padding: "32px 40px" }}>
                  <h2 style={{ color: "#1a0533", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>You're Invited to Our Upcoming Event</h2>
                  <p style={{ color: "#4a4a6a", lineHeight: 1.7, fontSize: 14, marginBottom: 20 }}>
                    We'd love to have you join us for a special experience curated just for you. Reserve your spot today before seats fill up.
                  </p>
                  <div style={{ textAlign: "center", margin: "24px 0" }}>
                    <a style={{ display: "inline-block", background: previewGradient, color: "white", padding: "12px 28px", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                      Reserve My Spot
                    </a>
                  </div>
                  <p style={{ color: "#4a4a6a", lineHeight: 1.7, fontSize: 13 }}>
                    If you have questions, reply to this email or contact our team. We look forward to seeing you.
                  </p>
                  <p style={{ color: "#4a4a6a", fontSize: 13, marginTop: 16 }}>Warmly,<br /><strong>{orgName}</strong></p>
                </div>
                <div style={{ background: "#1a0533", padding: "20px 40px", textAlign: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: 0 }}>{footerText}</p>
                  {watched.fromEmail && (
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: "6px 0 0" }}>Sent from: {watched.fromEmail}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateOrg.isPending || !form.formState.isDirty} className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0">
            {updateOrg.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Save Branding"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// --- Billing Tab ---
interface PlanLimits {
  key: "free" | "starter" | "growth" | "agency";
  name: string;
  priceMonthly: number;
  events: number | null;
  attendeesPerEvent: number | null;
  users: number | null;
}
interface OrgUsage {
  plan: PlanLimits;
  usage: { events: number; users: number; largestEventAttendees: number };
}
function formatLimit(n: number | null): string { return n === null ? "Unlimited" : String(n); }
function usagePercent(current: number, max: number | null): number {
  if (max === null) return 0;
  if (max === 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}
function BillingTab({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const [plansList, setPlansList] = useState<PlanLimits[]>([]);
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanLimits | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const [violations, setViolations] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [p, u] = await Promise.all([
        fetch("/api/plans").then((r) => r.json()),
        fetch(`/api/organizations/${orgId}/usage`).then((r) => r.json()),
      ]);
      setPlansList(p.plans ?? []);
      setUsage(u);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchData().then(() => { if (cancelled) { /* noop */ } });
    return () => { cancelled = true; };
  }, [orgId]);

  const PLAN_ORDER = ["free", "starter", "growth", "agency"];

  const isUpgrade = (from: string, to: string) => {
    return PLAN_ORDER.indexOf(to) > PLAN_ORDER.indexOf(from);
  };

  const onSelectPlan = (plan: PlanLimits) => {
    setViolations([]);
    setSelectedPlan(plan);
  };

  const onConfirmChange = async () => {
    if (!selectedPlan) return;
    setChangingPlan(true);
    setViolations([]);
    try {
      const res = await fetch(`/api/organizations/${orgId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan.key }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `Plan changed to ${selectedPlan.name}!` });
        setSelectedPlan(null);
        await fetchData();
      } else if (res.status === 422 && data.violations) {
        setViolations(data.violations);
      } else {
        toast({ title: "Failed to change plan", description: data.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setChangingPlan(false);
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  const current = usage?.plan;
  const upgrading = selectedPlan && current ? isUpgrade(current.key, selectedPlan.key) : true;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your subscription and real-time usage against its limits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {current && usage && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-lg">{current.name}</span>
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                    {current.priceMonthly === 0 ? "Free" : `$${current.priceMonthly}/mo`}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {current.key === "free" && "Run 1 event with up to 20 attendees. Try it out — upgrade when you grow."}
                  {current.key === "starter" && "For small teams running a handful of events."}
                  {current.key === "growth" && "Scale up — 15 events, 500 attendees each, 10 users."}
                  {current.key === "agency" && "Unlimited events and users for agencies."}
                </p>
              </div>
            </div>
          )}

          {current && usage && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <UsageCard label="Events" current={usage.usage.events} max={current.events} />
              <UsageCard label="Team members" current={usage.usage.users} max={current.users} />
              <UsageCard label="Largest event attendees" current={usage.usage.largestEventAttendees} max={current.attendeesPerEvent} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Upgrade to unlock more events, attendees, and team seats.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {plansList.map((p) => {
              const isCurrent = current?.key === p.key;
              const highlight = p.key === "growth";
              const isUp = current ? isUpgrade(current.key, p.key) : false;
              return (
                <div key={p.key} className={`p-5 rounded-xl border-2 relative flex flex-col transition-all ${
                  isCurrent ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : highlight ? "border-primary/50 bg-primary/[0.02]"
                  : "border-border hover:border-primary/30"
                }`}>
                  {highlight && !isCurrent && <Badge className="bg-primary text-white text-xs absolute -top-2.5 right-3">Popular</Badge>}
                  {isCurrent && <Badge className="bg-green-600 text-white text-xs absolute -top-2.5 right-3">Current</Badge>}
                  <span className="font-semibold text-base mb-1">{p.name}</span>
                  <div className="text-3xl font-bold mb-1">
                    {p.priceMonthly === 0 ? "Free" : `$${p.priceMonthly}`}
                    {p.priceMonthly > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {p.key === "free" && "For trying out the platform"}
                    {p.key === "starter" && "For small teams & solo operators"}
                    {p.key === "growth" && "For growing organizations"}
                    {p.key === "agency" && "For agencies managing many clients"}
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 mb-5 flex-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      {formatLimit(p.events)} event{p.events === 1 ? "" : "s"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      {formatLimit(p.attendeesPerEvent)} attendees / event
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      {formatLimit(p.users)} team member{p.users === 1 ? "" : "s"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${p.key === "free" ? "text-muted-foreground/40" : "text-green-500"}`} />
                      <span className={p.key === "free" ? "line-through text-muted-foreground/50" : ""}>
                        AI campaigns & bulk email
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      Social scheduling
                    </li>
                    {(p.key === "growth" || p.key === "agency") && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        Priority support
                      </li>
                    )}
                    {p.key === "agency" && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        Custom sending domains
                      </li>
                    )}
                  </ul>
                  <Button
                    size="sm"
                    variant={isCurrent ? "outline" : isUp ? "default" : "outline"}
                    className={`w-full ${!isCurrent && isUp ? "bg-primary hover:bg-primary/90 text-white border-0" : ""}`}
                    disabled={isCurrent}
                    onClick={() => onSelectPlan(p)}
                  >
                    {isCurrent ? "Current plan" : isUp ? "Upgrade" : "Downgrade"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Plan change confirmation dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={(o) => { if (!o) { setSelectedPlan(null); setViolations([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {upgrading ? "Upgrade" : "Downgrade"} to {selectedPlan?.name}
            </DialogTitle>
            <DialogDescription>
              {upgrading
                ? `You'll get more capacity and features with the ${selectedPlan?.name} plan.`
                : `Downgrading may limit your access to some features.`}
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && current && (
            <div className="space-y-4">
              {/* Comparison */}
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="font-medium text-muted-foreground"></div>
                <div className="font-semibold text-center">{current.name}</div>
                <div className="font-semibold text-center text-primary">{selectedPlan.name}</div>

                <div className="text-muted-foreground">Events</div>
                <div className="text-center">{formatLimit(current.events)}</div>
                <div className={`text-center font-medium ${upgrading ? "text-green-600" : "text-amber-600"}`}>{formatLimit(selectedPlan.events)}</div>

                <div className="text-muted-foreground">Attendees/event</div>
                <div className="text-center">{formatLimit(current.attendeesPerEvent)}</div>
                <div className={`text-center font-medium ${upgrading ? "text-green-600" : "text-amber-600"}`}>{formatLimit(selectedPlan.attendeesPerEvent)}</div>

                <div className="text-muted-foreground">Team members</div>
                <div className="text-center">{formatLimit(current.users)}</div>
                <div className={`text-center font-medium ${upgrading ? "text-green-600" : "text-amber-600"}`}>{formatLimit(selectedPlan.users)}</div>

                <div className="text-muted-foreground">Campaigns</div>
                <div className="text-center">{current.key === "free" ? "No" : "Yes"}</div>
                <div className={`text-center font-medium ${selectedPlan.key === "free" ? "text-amber-600" : "text-green-600"}`}>
                  {selectedPlan.key === "free" ? "No" : "Yes"}
                </div>

                <div className="text-muted-foreground">Price</div>
                <div className="text-center">{current.priceMonthly === 0 ? "Free" : `$${current.priceMonthly}/mo`}</div>
                <div className="text-center font-semibold text-primary">{selectedPlan.priceMonthly === 0 ? "Free" : `$${selectedPlan.priceMonthly}/mo`}</div>
              </div>

              {/* Downgrade violations */}
              {violations.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
                  <p className="text-sm font-semibold text-destructive">Cannot downgrade — usage exceeds limits:</p>
                  {violations.map((v, i) => (
                    <p key={i} className="text-xs text-destructive/80 flex items-start gap-1.5">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {v}
                    </p>
                  ))}
                </div>
              )}

              {!upgrading && violations.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-700">
                    Downgrading will reduce your plan limits. If your current usage fits, the change takes effect immediately.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setSelectedPlan(null); setViolations([]); }}>
              Cancel
            </Button>
            <Button
              onClick={onConfirmChange}
              disabled={changingPlan || violations.length > 0}
              className={upgrading ? "bg-primary hover:bg-primary/90 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
            >
              {changingPlan ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : upgrading ? `Upgrade to ${selectedPlan?.name}` : `Downgrade to ${selectedPlan?.name}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function UsageCard({ label, current, max }: { label: string; current: number; max: number | null }) {
  const pct = usagePercent(current, max);
  const at = max !== null && current >= max;
  const near = max !== null && current / max >= 0.8;
  return (
    <div className="p-4 border rounded-lg">
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold">
        {current} <span className="text-sm font-normal text-muted-foreground">/ {formatLimit(max)}</span>
      </div>
      {max !== null && (
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${at ? "bg-destructive" : near ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {at && <p className="text-xs text-destructive mt-1.5">Limit reached — upgrade to add more.</p>}
    </div>
  );
}

// --- Settings Page ---
export default function Settings() {
  const { activeOrgId } = useAuth();
  const orgId = activeOrgId;
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const { data: org, isLoading } = useGetOrganization(orgId);
  const updateOrg = useUpdateOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement | null>(null);

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
    { id: "branding", label: "Branding", icon: Palette },
    { id: "email", label: "Email Sending", icon: Mail },
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
                              <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  if (!file) return;
                                  if (file.size > 2 * 1024 * 1024) {
                                    toast({ title: "Image too large", description: "Please choose an image under 2 MB.", variant: "destructive" });
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    form.setValue("logoUrl", String(reader.result), { shouldDirty: true, shouldValidate: true });
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                              <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>Upload new logo</Button>
                              {form.watch("logoUrl") && (
                                <Button type="button" variant="ghost" size="sm" className="ml-2" onClick={() => form.setValue("logoUrl", "", { shouldDirty: true })}>Remove</Button>
                              )}
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

            {activeTab === "branding" && (
              <BrandingTab orgId={orgId} />
            )}

            {activeTab === "email" && (
              <EmailSendingTab orgId={orgId} />
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

            {activeTab === "billing" && <BillingTab orgId={orgId} />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
