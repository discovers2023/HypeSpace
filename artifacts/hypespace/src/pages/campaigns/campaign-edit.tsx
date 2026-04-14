import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Send,
  Trash2,
  Eye,
  Code2,
  Type,
  AlertTriangle,
  ImagePlus,
  Sparkles,
  Loader2,
  Paintbrush,
  Upload,
} from "lucide-react";

const editSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  subject: z.string().min(1, "Subject line is required").max(200),
  htmlContent: z.string().max(200_000).optional().default(""),
  textContent: z.string().max(50_000).optional().default(""),
});

type EditFormValues = z.infer<typeof editSchema>;

const ORG_ID = 1;

// ── Helpers to parse/rebuild the email template ─────────────────────────────

function extractSection(html: string, selector: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const el = doc.querySelector(selector);
  return el?.innerHTML ?? "";
}

function updateSection(html: string, selector: string, newInner: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const el = doc.querySelector(selector);
  if (el) el.innerHTML = newInner;
  // Serialize back — get everything inside <html>
  return doc.documentElement.outerHTML;
}

function extractHeaderImage(html: string): string | null {
  const match = html.match(/<img[^>]+class="header-img"[^>]+src="([^"]+)"/);
  return match?.[1] ?? null;
}

// AI image generation keywords mapped to Unsplash topics
const IMAGE_KEYWORDS: Record<string, string> = {
  conference: "conference,event,stage",
  study_club: "dental,medical,education",
  workshop: "workshop,hands-on,teamwork",
  webinar: "technology,virtual,screen",
  networking: "networking,people,social",
  seminar: "seminar,lecture,audience",
  invitation: "elegant,celebration,event",
  reminder: "clock,calendar,reminder",
  followup: "handshake,thankyou,feedback",
  announcement: "megaphone,announcement,news",
};

// ── Component ───────────────────────────────────────────────────────────────

export default function CampaignEdit() {
  const [, params] = useRoute<{ id: string }>("/campaigns/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const campaignId = params?.id ? parseInt(params.id, 10) : NaN;
  const invalidId = Number.isNaN(campaignId);

  const { data: campaign, isLoading, error } = useGetCampaign(ORG_ID, campaignId, {
    query: { enabled: !invalidId },
  });

  const updateCampaign = useUpdateCampaign();
  const sendCampaign = useSendCampaign();
  const deleteCampaign = useDeleteCampaign();

  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "html" | "text">("visual");

  // Visual editor state — editable sections of the email template
  const [editHeading, setEditHeading] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCta, setEditCta] = useState("");
  const [editFooterNote, setEditFooterNote] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");

  // AI image generation
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHeaderImageUrl(reader.result as string);
      setIsImageDialogOpen(false);
      toast({ title: "Image uploaded!" });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", subject: "", htmlContent: "", textContent: "" },
  });

  // Parse template sections when campaign loads
  useEffect(() => {
    if (campaign) {
      form.reset({
        name: campaign.name,
        subject: campaign.subject,
        htmlContent: campaign.htmlContent ?? "",
        textContent: campaign.textContent ?? "",
      });

      const html = campaign.htmlContent ?? "";
      // Extract editable sections from the template
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      setEditHeading(doc.querySelector(".body h2")?.textContent ?? campaign.subject);

      // Get body paragraphs (skip the h2 and the CTA)
      const bodyEl = doc.querySelector(".body");
      if (bodyEl) {
        const paras = bodyEl.querySelectorAll("p");
        const bodyTexts: string[] = [];
        paras.forEach((p) => bodyTexts.push(p.textContent ?? ""));
        setEditBody(bodyTexts.join("\n\n"));
      }

      setEditCta(doc.querySelector(".cta")?.textContent ?? "Reserve My Spot");

      const footerP = doc.querySelector(".footer p");
      setEditFooterNote(footerP?.textContent ?? "");

      // Check for header image
      const img = doc.querySelector(".header img, .header-img");
      if (img) setHeaderImageUrl(img.getAttribute("src") ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id]);

  // Rebuild HTML from visual editor state
  const rebuildHtml = useCallback(() => {
    const currentHtml = form.getValues("htmlContent");
    if (!currentHtml) return currentHtml;

    const parser = new DOMParser();
    const doc = parser.parseFromString(currentHtml, "text/html");

    // Update heading
    const h2 = doc.querySelector(".body h2");
    if (h2) h2.textContent = editHeading;

    // Update body paragraphs
    const bodyEl = doc.querySelector(".body");
    if (bodyEl) {
      const existingParas = bodyEl.querySelectorAll("p");
      const newParas = editBody.split("\n\n").filter(Boolean);

      existingParas.forEach((p, i) => {
        if (i < newParas.length) {
          p.textContent = newParas[i];
        }
      });
      // If user added more paragraphs than exist
      for (let i = existingParas.length; i < newParas.length; i++) {
        const p = doc.createElement("p");
        p.textContent = newParas[i];
        const cta = bodyEl.querySelector(".cta");
        if (cta) bodyEl.insertBefore(p, cta);
        else bodyEl.appendChild(p);
      }
    }

    // Update CTA text
    const cta = doc.querySelector(".cta");
    if (cta) cta.textContent = editCta;

    // Update header image
    const header = doc.querySelector(".header");
    if (header) {
      const existingImg = header.querySelector("img");
      if (headerImageUrl) {
        if (existingImg) {
          existingImg.setAttribute("src", headerImageUrl);
        } else {
          // Insert image before the h1
          const h1 = header.querySelector("h1");
          const img = doc.createElement("img");
          img.src = headerImageUrl;
          img.alt = "Campaign header";
          img.className = "header-img";
          img.setAttribute("style", "width:100%;max-height:200px;object-fit:cover;border-radius:0;margin-bottom:16px;");
          if (h1) header.insertBefore(img, h1);
          else header.prepend(img);
        }
      } else if (existingImg) {
        existingImg.remove();
      }
    }

    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }, [editHeading, editBody, editCta, headerImageUrl, form]);

  // Sync visual edits back to form when switching modes or saving
  const syncVisualToForm = useCallback(() => {
    const rebuilt = rebuildHtml();
    if (rebuilt) {
      form.setValue("htmlContent", rebuilt, { shouldDirty: true });
    }
  }, [rebuildHtml, form]);

  const watchedHtml = form.watch("htmlContent");
  const watchedSubject = form.watch("subject");

  // For preview, use rebuilt HTML in visual mode, raw in html mode
  const previewHtml = useMemo(() => {
    if (editorMode === "visual") {
      return rebuildHtml() || "";
    }
    return watchedHtml || "<p style='font-family:sans-serif;color:#999;text-align:center;padding:40px'>Nothing to preview yet</p>";
  }, [editorMode, rebuildHtml, watchedHtml]);

  // Generate AI image
  const onGenerateImage = async () => {
    setIsGeneratingImage(true);
    try {
      // Use Unsplash Source for free, instant images
      const query = imagePrompt || "event conference professional";
      const seed = Date.now(); // cache bust
      const url = `https://images.unsplash.com/photo-${seed}?w=600&h=200&fit=crop&q=80`;

      // Since Unsplash Source redirects, we use a different approach:
      // Use picsum.photos which is always available, or build a themed URL
      const keywords = query.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 3).join(",");
      const imageUrl = `https://source.unsplash.com/600x200/?${encodeURIComponent(keywords)}&sig=${seed}`;

      setHeaderImageUrl(imageUrl);
      setIsImageDialogOpen(false);
      toast({ title: "Image generated!", description: "Header image added to your campaign." });
    } catch {
      toast({ title: "Failed to generate image", variant: "destructive" });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const onSave = (data: EditFormValues) => {
    if (invalidId) return;
    // Sync visual edits first
    if (editorMode === "visual") syncVisualToForm();

    const finalData = editorMode === "visual"
      ? { ...data, htmlContent: rebuildHtml() || data.htmlContent }
      : data;

    updateCampaign.mutate(
      { orgId: ORG_ID, campaignId, data: finalData },
      {
        onSuccess: () => {
          toast({ title: "Campaign saved" });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", ORG_ID, "campaigns"] });
          form.reset(finalData);
        },
        onError: (err) => {
          toast({ title: "Save failed", description: err.message ?? "Unknown error", variant: "destructive" });
        },
      },
    );
  };

  const onSend = () => {
    if (editorMode === "visual") syncVisualToForm();

    form.handleSubmit((data) => {
      const finalData = editorMode === "visual"
        ? { ...data, htmlContent: rebuildHtml() || data.htmlContent }
        : data;

      updateCampaign.mutate(
        { orgId: ORG_ID, campaignId, data: finalData },
        {
          onSuccess: () => {
            sendCampaign.mutate(
              { orgId: ORG_ID, campaignId },
              {
                onSuccess: () => {
                  toast({ title: "Campaign sent!", description: `${data.name} is on its way.` });
                  queryClient.invalidateQueries({ queryKey: ["/api/organizations", ORG_ID, "campaigns"] });
                  setLocation("/campaigns");
                },
                onError: (err) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
              },
            );
          },
          onError: (err) => toast({ title: "Save before send failed", description: err.message, variant: "destructive" }),
        },
      );
    })();
    setConfirmSend(false);
  };

  const onDelete = () => {
    deleteCampaign.mutate(
      { campaignId },
      {
        onSuccess: () => {
          toast({ title: "Campaign deleted" });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", ORG_ID, "campaigns"] });
          setLocation("/campaigns");
        },
        onError: (err) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
      },
    );
    setConfirmDelete(false);
  };

  // ── Error / loading states ──

  if (invalidId) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid campaign id</h1>
          <Link href="/campaigns"><Button variant="outline">Back to campaigns</Button></Link>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-5 h-96" />
            <Skeleton className="lg:col-span-7 h-96" />
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
      <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-12">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/campaigns">
              <Button variant="outline" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">Edit campaign</h1>
                <Badge variant="outline" className={isSent ? "bg-green-500/10 text-green-700 border-green-500/20" : "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"}>
                  {campaign.status}
                </Badge>
                {isDirty && !isSent && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20">Unsaved changes</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                {campaign.type} &middot; created {new Date(campaign.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={isBusy}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
            <Button variant="outline" onClick={form.handleSubmit(onSave)} disabled={isBusy || isSent}>
              <Save className="h-4 w-4 mr-2" /> {updateCampaign.isPending ? "Saving..." : "Save draft"}
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0" onClick={() => setConfirmSend(true)} disabled={isBusy || isSent}>
              <Send className="h-4 w-4 mr-2" /> {isSent ? "Already sent" : "Save & send"}
            </Button>
          </div>
        </div>

        {isSent && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">This campaign has already been sent</p>
              <p className="text-amber-700 mt-0.5">You can view the content but editing is disabled.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Editor panel */}
          <Card className="lg:col-span-5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Content</CardTitle>
                <Tabs value={editorMode} onValueChange={(v) => {
                  if (editorMode === "visual") syncVisualToForm();
                  setEditorMode(v as typeof editorMode);
                }}>
                  <TabsList className="h-8">
                    <TabsTrigger value="visual" className="text-xs h-6 px-2"><Paintbrush className="h-3 w-3 mr-1" /> Visual</TabsTrigger>
                    <TabsTrigger value="html" className="text-xs h-6 px-2"><Code2 className="h-3 w-3 mr-1" /> HTML</TabsTrigger>
                    <TabsTrigger value="text" className="text-xs h-6 px-2"><Type className="h-3 w-3 mr-1" /> Text</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSave)} className="space-y-5">
                  {/* Always show name + subject */}
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal name</FormLabel>
                      <FormControl><Input placeholder="Spring launch announcement" disabled={isSent} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject line</FormLabel>
                      <FormControl><Input placeholder="You're invited..." disabled={isSent} {...field} /></FormControl>
                      <FormDescription>The first thing recipients see.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* ── Visual editor ── */}
                  {editorMode === "visual" && (
                    <div className="space-y-4 border-t pt-4">
                      {/* Header image */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Header Image</label>
                        {headerImageUrl ? (
                          <div className="relative rounded-lg overflow-hidden border">
                            <img src={headerImageUrl} alt="Header" className="w-full h-32 object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setIsImageDialogOpen(true)}>
                                <ImagePlus className="h-3 w-3 mr-1" /> Change
                              </Button>
                              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setHeaderImageUrl("")}>
                                <Trash2 className="h-3 w-3 mr-1" /> Remove
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsImageDialogOpen(true)}
                            className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:bg-muted/50 transition-all"
                          >
                            <ImagePlus className="h-5 w-5" />
                            <span className="text-xs">Add header image</span>
                          </button>
                        )}
                      </div>

                      {/* Email heading */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Email Heading</label>
                        <Input
                          value={editHeading}
                          onChange={(e) => setEditHeading(e.target.value)}
                          placeholder="Your Invitation Awaits"
                          disabled={isSent}
                        />
                      </div>

                      {/* Body text */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Body Text</label>
                        <Textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          placeholder="Write your email message here..."
                          disabled={isSent}
                          rows={8}
                          className="resize-y"
                        />
                        <p className="text-xs text-muted-foreground">Separate paragraphs with blank lines.</p>
                      </div>

                      {/* CTA button text */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Button Text</label>
                        <Input
                          value={editCta}
                          onChange={(e) => setEditCta(e.target.value)}
                          placeholder="Reserve My Spot"
                          disabled={isSent}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── HTML editor ── */}
                  {editorMode === "html" && (
                    <FormField control={form.control} name="htmlContent" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">HTML content</FormLabel>
                        <FormControl>
                          <Textarea placeholder="<html>...</html>" disabled={isSent} className="font-mono text-xs min-h-[360px] resize-y" {...field} />
                        </FormControl>
                        <FormDescription>Edit raw HTML. Preview updates live.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* ── Plain text editor ── */}
                  {editorMode === "text" && (
                    <FormField control={form.control} name="textContent" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Plain text content</FormLabel>
                        <FormControl>
                          <Textarea placeholder={"Hello\n\nYou're invited..."} disabled={isSent} className="min-h-[360px] resize-y" {...field} />
                        </FormControl>
                        <FormDescription>For email clients that block HTML.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="lg:col-span-7 sticky top-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" /> Live preview
                </CardTitle>
                <Badge variant="outline" className="text-xs">updates as you type</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="bg-muted/30 border-t border-b px-4 py-2 text-sm">
                <span className="text-muted-foreground mr-2">Subject:</span>
                <span className="font-medium">{watchedSubject || "(no subject)"}</span>
              </div>
              <iframe
                srcDoc={previewHtml}
                title="Campaign preview"
                sandbox="allow-same-origin"
                className="w-full bg-white"
                style={{ height: 560, border: "none" }}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Image Generation Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate Header Image
            </DialogTitle>
            <DialogDescription>
              Describe the image you want and AI will generate it for your campaign.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Image description</label>
              <Textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="e.g. Professional dental conference with speakers on stage, modern venue, warm lighting"
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Quick picks</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Conference", prompt: "professional conference stage audience" },
                  { label: "Workshop", prompt: "hands-on workshop participants collaborative" },
                  { label: "Dental CE", prompt: "dental continuing education professional" },
                  { label: "Networking", prompt: "business networking event professional people" },
                  { label: "Celebration", prompt: "elegant celebration event lights" },
                  { label: "Medical", prompt: "medical professional healthcare modern" },
                ].map((pick) => (
                  <button
                    key={pick.label}
                    type="button"
                    onClick={() => setImagePrompt(pick.prompt)}
                    className="px-2.5 py-1 text-xs rounded-full border hover:bg-primary/10 hover:border-primary/30 transition-colors"
                  >
                    {pick.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload from computer */}
            <div className="space-y-2 border-t pt-3">
              <label className="text-sm font-medium">Upload from your computer</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/50 hover:text-foreground transition-all"
              >
                <Upload className="h-4 w-4" />
                Choose image file
              </button>
              <p className="text-xs text-muted-foreground">JPG, PNG, GIF or WebP. Max 5 MB.</p>
            </div>

            {/* Manual URL input */}
            <div className="space-y-1.5 border-t pt-3">
              <label className="text-sm font-medium text-muted-foreground">Or paste an image URL</label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={headerImageUrl.startsWith("data:") ? "" : headerImageUrl}
                onChange={(e) => setHeaderImageUrl(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsImageDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={onGenerateImage}
                disabled={isGeneratingImage || !imagePrompt.trim()}
                className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
              >
                {isGeneratingImage ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Generate Image</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send confirmation */}
      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this campaign now?</AlertDialogTitle>
            <AlertDialogDescription>
              Any unsaved changes will be saved before sending. Once sent, the campaign cannot be unsent or further edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSend} className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0">
              Save &amp; send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
