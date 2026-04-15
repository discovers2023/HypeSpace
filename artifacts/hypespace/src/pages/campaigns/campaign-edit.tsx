import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useGetCampaign,
  useUpdateCampaign,
  useSendCampaign,
  useDeleteCampaign,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, Send, Trash2, AlertTriangle, Code2, Type,
  Paintbrush, Loader2, Eye, TestTube, Lock, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import { CampaignSuggestionList } from "@/components/campaign-suggestion-list";
import { DEFAULT_SUGGESTIONS } from "@/lib/campaign-suggestions";

// ─── Regex-based extraction / patching for the AI template ───────────────────
// These patterns are safe to use on both AI-generated AND hand-edited HTML.

function extractBodyIntro(html: string): string {
  // The AI template body intro paragraph
  const m = html.match(/<p[^>]*margin:0 0 24px[^>]*>([\s\S]*?)<\/p>/);
  if (m) {
    // Strip HTML tags for plain-text editing
    return m[1].replace(/<[^>]+>/g, "");
  }
  return "";
}

function patchBodyIntro(html: string, newText: string): string {
  return html.replace(
    /(<p[^>]*margin:0 0 24px[^>]*>)([\s\S]*?)(<\/p>)/,
    `$1${newText}$3`,
  );
}

function extractCtaLabel(html: string): string {
  // The gradient CTA button in the AI template
  const m = html.match(/<a[^>]*linear-gradient\(135deg,#7C3AED[^>]*>([\s\S]*?)<\/a>/);
  return m ? m[1].trim() : "";
}

function patchCtaLabel(html: string, newLabel: string): string {
  return html.replace(
    /(<a[^>]*linear-gradient\(135deg,#7C3AED[^>]*>)([\s\S]*?)(<\/a>)/,
    `$1${newLabel}$3`,
  );
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const editSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  subject: z.string().min(1, "Subject line is required").max(200),
  htmlContent: z.string().max(200_000).optional().default(""),
  textContent: z.string().max(50_000).optional().default(""),
});

type EditFormValues = z.infer<typeof editSchema>;
type EditorTab = "visual" | "html" | "text";

// ─── Component ────────────────────────────────────────────────────────────────

export default function CampaignEdit() {
  const { activeOrgId } = useAuth();
  const orgId = activeOrgId ?? 1;
  const [, params] = useRoute<{ id: string }>("/campaigns/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const campaignId = params?.id ? parseInt(params.id, 10) : NaN;
  const invalidId = Number.isNaN(campaignId);

  const { data: campaign, isLoading, error } = useGetCampaign(orgId, campaignId, {
    query: { enabled: !invalidId },
  });

  const updateCampaign = useUpdateCampaign();
  const sendCampaign = useSendCampaign();
  const deleteCampaign = useDeleteCampaign();

  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("visual");
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [showTestInput, setShowTestInput] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Visual editor fields — extracted from the template
  const [bodyIntro, setBodyIntro] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", subject: "", htmlContent: "", textContent: "" },
  });

  // Populate form + visual fields when campaign loads
  useEffect(() => {
    if (!campaign) return;
    form.reset({
      name: campaign.name,
      subject: campaign.subject,
      htmlContent: campaign.htmlContent ?? "",
      textContent: campaign.textContent ?? "",
    });
    const html = campaign.htmlContent ?? "";
    setBodyIntro(extractBodyIntro(html));
    setCtaLabel(extractCtaLabel(html));
  }, [campaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the live-preview HTML by patching visual fields back into the stored HTML
  const watchedHtml = form.watch("htmlContent");

  const previewHtml = useMemo(() => {
    if (editorTab !== "visual") return watchedHtml;
    let html = watchedHtml;
    if (bodyIntro) html = patchBodyIntro(html, bodyIntro);
    if (ctaLabel) html = patchCtaLabel(html, ctaLabel);
    return html;
  }, [editorTab, watchedHtml, bodyIntro, ctaLabel]);

  // Sync visual fields back into the form's htmlContent before save/send
  const syncVisualToForm = useCallback(() => {
    if (editorTab !== "visual") return;
    let html = form.getValues("htmlContent");
    if (bodyIntro) html = patchBodyIntro(html, bodyIntro);
    if (ctaLabel) html = patchCtaLabel(html, ctaLabel);
    form.setValue("htmlContent", html, { shouldDirty: true });
  }, [editorTab, bodyIntro, ctaLabel, form]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const onSave = (data: EditFormValues) => {
    if (invalidId) return;
    syncVisualToForm();
    const finalData = editorTab === "visual"
      ? { ...data, htmlContent: (() => { let h = data.htmlContent; if (bodyIntro) h = patchBodyIntro(h, bodyIntro); if (ctaLabel) h = patchCtaLabel(h, ctaLabel); return h; })() }
      : data;

    updateCampaign.mutate({ orgId, campaignId, data: finalData }, {
      onSuccess: () => {
        toast({ title: "Campaign saved" });
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId, "campaigns"] });
        form.reset(finalData);
      },
      onError: (err) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
    });
  };

  const onSend = () => {
    syncVisualToForm();
    form.handleSubmit((data) => {
      const finalHtml = editorTab === "visual"
        ? (() => { let h = data.htmlContent; if (bodyIntro) h = patchBodyIntro(h, bodyIntro); if (ctaLabel) h = patchCtaLabel(h, ctaLabel); return h; })()
        : data.htmlContent;
      const finalData = { ...data, htmlContent: finalHtml };

      updateCampaign.mutate({ orgId, campaignId, data: finalData }, {
        onSuccess: () => {
          sendCampaign.mutate({ orgId, campaignId }, {
            onSuccess: () => {
              toast({ title: "Campaign sent!", description: `${data.name} is on its way.` });
              queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId, "campaigns"] });
              setLocation("/campaigns");
            },
            onError: (err) => {
              const msg = err.message ?? "";
              if (msg.includes("402") || msg.includes("paid plan") || msg.includes("PLAN_LIMIT")) {
                setUpgradeNeeded(true);
              } else {
                toast({ title: "Send failed", description: msg, variant: "destructive" });
              }
            },
          });
        },
        onError: (err) => toast({ title: "Save before send failed", description: err.message, variant: "destructive" }),
      });
    })();
    setConfirmSend(false);
  };

  const onDelete = () => {
    deleteCampaign.mutate({ orgId, campaignId }, {
      onSuccess: () => {
        toast({ title: "Campaign deleted" });
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId, "campaigns"] });
        setLocation("/campaigns");
      },
      onError: (err) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
    });
    setConfirmDelete(false);
  };

  const onTestSend = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    setTestSending(true);
    try {
      const resp = await fetch(`/api/organizations/${orgId}/campaigns/${campaignId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Unknown error");
      toast({
        title: "Test email sent!",
        description: json.previewUrl ? `Preview: ${json.previewUrl}` : `Delivered to ${testEmail}`,
      });
      setShowTestInput(false);
    } catch (err: unknown) {
      toast({ title: "Test send failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setTestSending(false);
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────

  if (invalidId) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid campaign</h1>
          <Link href="/campaigns"><Button variant="outline">Back to campaigns</Button></Link>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col gap-4 max-w-7xl mx-auto">
          <Skeleton className="h-10 w-72" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Skeleton className="lg:col-span-2 h-[600px] rounded-2xl" />
            <Skeleton className="lg:col-span-3 h-[600px] rounded-2xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !campaign) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Campaign not found</h1>
          <Link href="/campaigns"><Button variant="outline">Back to campaigns</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const isSent = campaign.status === "sent";
  const isBusy = updateCampaign.isPending || sendCampaign.isPending;
  const isDirty = form.formState.isDirty;

  return (
    <AppLayout>
      <div className="flex flex-col gap-5 max-w-7xl mx-auto pb-12">

        {/* ── Top bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/campaigns">
              <Button variant="outline" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="text-xl font-bold tracking-tight">{campaign.name}</h1>
                <Badge
                  variant="outline"
                  className={isSent
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"}
                >
                  {campaign.status}
                </Badge>
                {isDirty && !isSent && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Unsaved changes
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">
                {campaign.type} · created {new Date(campaign.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Test send */}
            <div className="flex gap-1.5">
              {showTestInput ? (
                <>
                  <Input
                    className="h-9 w-44 text-sm"
                    placeholder="you@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onTestSend()}
                  />
                  <Button size="sm" variant="outline" onClick={onTestSend} disabled={testSending}>
                    {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowTestInput(false)}>✕</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowTestInput(true)} disabled={isBusy}>
                  <TestTube className="h-4 w-4 mr-1.5" />
                  Test
                </Button>
              )}
            </div>

            <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={isBusy}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
            <Button variant="outline" onClick={form.handleSubmit(onSave)} disabled={isBusy || isSent}>
              {updateCampaign.isPending
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</>
                : <><Save className="h-4 w-4 mr-1.5" />Save draft</>}
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
              onClick={() => setConfirmSend(true)}
              disabled={isBusy || isSent}
            >
              <Send className="h-4 w-4 mr-1.5" />
              {isSent ? "Already sent" : "Save & send"}
            </Button>
          </div>
        </div>

        {/* Sent warning */}
        {isSent && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">This campaign has already been sent</p>
              <p className="text-amber-700 mt-0.5">Content is read-only. You can still view the preview on the right.</p>
            </div>
          </div>
        )}

        {/* ── Main split ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* LEFT — editor panel */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSave)} className="flex flex-col gap-4">

                {/* Name */}
                <div className="bg-card border rounded-xl p-4 flex flex-col gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal name</FormLabel>
                      <FormControl>
                        <Input placeholder="Spring launch announcement" disabled={isSent} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email subject line</FormLabel>
                      <FormControl>
                        <Input placeholder="You're invited to…" disabled={isSent} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Editor tabs */}
                <div className="bg-card border rounded-xl overflow-hidden">
                  {/* Tab bar */}
                  <div className="flex border-b bg-muted/30">
                    {(
                      [
                        { key: "visual" as EditorTab, label: "Visual", icon: <Paintbrush className="h-3.5 w-3.5" /> },
                        { key: "html" as EditorTab, label: "HTML", icon: <Code2 className="h-3.5 w-3.5" /> },
                        { key: "text" as EditorTab, label: "Plain text", icon: <Type className="h-3.5 w-3.5" /> },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          if (editorTab === "visual") syncVisualToForm();
                          setEditorTab(tab.key);
                        }}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                          editorTab === tab.key
                            ? "border-primary text-primary bg-background"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {/* ── Visual tab ── */}
                    {editorTab === "visual" && (
                      <div className="space-y-4">
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
                          Edit the key content sections below. The live preview on the right updates instantly.
                          Switch to <strong>HTML</strong> to make deeper changes.
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Email body text</label>
                          <Textarea
                            rows={6}
                            placeholder="The main paragraph of your email…"
                            value={bodyIntro}
                            onChange={(e) => setBodyIntro(e.target.value)}
                            disabled={isSent}
                            className="resize-y text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            This is the opening paragraph recipients read first.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Button label</label>
                          <Input
                            placeholder="Reserve My Spot"
                            value={ctaLabel}
                            onChange={(e) => setCtaLabel(e.target.value)}
                            disabled={isSent}
                          />
                          <p className="text-xs text-muted-foreground">
                            Text on the call-to-action button.
                          </p>
                        </div>

                        {!bodyIntro && !ctaLabel && (
                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            This campaign's HTML doesn't use the standard AI template — switch to the <strong>HTML</strong> tab to edit directly.
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── HTML tab ── */}
                    {editorTab === "html" && (
                      <FormField control={form.control} name="htmlContent" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              rows={20}
                              placeholder="<!DOCTYPE html>…"
                              disabled={isSent}
                              className="font-mono text-xs resize-y"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                // Re-extract visual fields when HTML is manually edited
                                setBodyIntro(extractBodyIntro(e.target.value));
                                setCtaLabel(extractCtaLabel(e.target.value));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}

                    {/* ── Text tab ── */}
                    {editorTab === "text" && (
                      <FormField control={form.control} name="textContent" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              rows={20}
                              placeholder="Plain text fallback for email clients that don't render HTML…"
                              disabled={isSent}
                              className="text-sm resize-y"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Shown to email clients that cannot render HTML.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                  </div>
                </div>

              </form>
            </Form>

            {/* AI Suggestions Panel */}
            {!isSent && (
              <div className="bg-card border rounded-xl overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
                  onClick={() => setShowSuggestions((v) => !v)}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Suggestions
                    <span className="text-xs text-muted-foreground font-normal">— click any to apply</span>
                  </span>
                  {showSuggestions
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {showSuggestions && (
                  <div className="px-4 pb-4">
                    <CampaignSuggestionList
                      suggestions={DEFAULT_SUGGESTIONS}
                      html={form.watch("htmlContent") ?? ""}
                      onApply={(newHtml) => {
                        form.setValue("htmlContent", newHtml, { shouldDirty: true });
                        setBodyIntro(extractBodyIntro(newHtml));
                      }}
                      compact
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — live preview */}
          <div className="lg:col-span-3 sticky top-4">
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Live Preview
                </div>
                <span className="text-xs text-muted-foreground">
                  Subject: {form.watch("subject") || "—"}
                </span>
              </div>
              <div className="relative" style={{ height: "680px" }}>
                {previewHtml ? (
                  <iframe
                    key={editorTab}
                    srcDoc={previewHtml}
                    title="Email preview"
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <Eye className="h-10 w-10 opacity-25" />
                    <p className="text-sm">No content yet — start editing to see a preview.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirm send ── */}
      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will save any unsaved changes and immediately send the campaign to all
              recipients. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSend} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Yes, send it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm delete ── */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The campaign and all its content will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Upgrade required ── */}
      <AlertDialog open={upgradeNeeded} onOpenChange={setUpgradeNeeded}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-xl">Upgrade to send campaigns</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base leading-relaxed">
              The free plan lets you create unlimited campaigns, but sending requires a paid plan.
              Upgrade to <strong>Starter</strong> or higher to launch your campaigns to your audience.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-3 gap-3 my-2">
            {[
              { name: "Starter", price: "$49/mo", events: "3 events", color: "border-blue-200 bg-blue-50" },
              { name: "Growth", price: "$149/mo", events: "15 events", color: "border-purple-200 bg-purple-50" },
              { name: "Agency", price: "$399/mo", events: "Unlimited", color: "border-orange-200 bg-orange-50" },
            ].map((p) => (
              <div key={p.name} className={`rounded-xl border p-3 text-center ${p.color}`}>
                <p className="font-semibold text-sm">{p.name}</p>
                <p className="text-lg font-bold mt-0.5">{p.price}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.events}</p>
              </div>
            ))}
          </div>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction className="w-full bg-primary hover:bg-primary/90 text-white h-11">
              <Sparkles className="h-4 w-4 mr-2" />
              View upgrade options
            </AlertDialogAction>
            <AlertDialogCancel className="w-full m-0">Maybe later</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
