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
    summary: "Import contacts tagged 'studyclub' directly from your Go HighLevel sub-account.",
    helpUrl: "https://app.gohighlevel.com/settings/integrations",
    zapierHelpUrl: "",
    apiFields: [
      { key: "apiKey", label: "Private Integration Token", type: "password", placeholder: "eyJhbGci...", required: true, raw: true, hint: "Go HighLevel → Settings → Integrations → Private Integrations" },
      { key: "locationId", label: "Location ID", type: "text", placeholder: "abc123XYZxxx", required: true, raw: true, hint: "Go HighLevel → Settings → Business Info → Location ID" },
    ],
    zapierFields: [],
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
                className="text-xs text-[#FF8C00] hover:underline inline-flex items-center gap-0.5"
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
                    ? "border-[#FF8C00] bg-orange-50 text-[#FF8C00]"
                    : "border-border bg-background text-muted-foreground hover:border-[#FF8C00]/50"
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
                    ? "border-[#FF8C00] bg-orange-50 text-[#FF8C00]"
                    : "border-border bg-background text-muted-foreground hover:border-[#FF8C00]/50"
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
