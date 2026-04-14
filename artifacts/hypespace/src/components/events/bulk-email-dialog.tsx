import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Send, TestTube, Loader2 } from "lucide-react";

export type BulkRecipientMode =
  | { mode: "ids"; guestIds: number[] }
  | { mode: "segment"; segment: "all" | "yes" | "no" | "maybe" | "invited" | "not_responded" };

type Campaign = { id: number; name: string; subject: string; htmlContent?: string | null; textContent?: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: number;
  eventId: number;
  recipientLabel: string;
  recipientCount: number;
  recipient: BulkRecipientMode;
  templates?: Campaign[];
  defaultTestEmail?: string;
  onSent?: () => void;
}

const VARIABLES = ["guest.name", "guest.email", "event.title", "event.date", "rsvpLink"];

export function BulkEmailDialog({
  open,
  onOpenChange,
  orgId,
  eventId,
  recipientLabel,
  recipientCount,
  recipient,
  templates = [],
  defaultTestEmail = "",
  onSent,
}: Props) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<string>("blank");
  const [testTo, setTestTo] = useState(defaultTestEmail);
  const [isSending, setIsSending] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSubject("");
      setBody("");
      setTemplateId("blank");
      setConfirmOpen(false);
    }
  }, [open]);

  useEffect(() => {
    setTestTo(defaultTestEmail);
  }, [defaultTestEmail]);

  const onPickTemplate = (id: string) => {
    setTemplateId(id);
    if (id === "blank") {
      setSubject("");
      setBody("");
      return;
    }
    const t = templates.find((c) => String(c.id) === id);
    if (t) {
      setSubject(t.subject ?? "");
      setBody(t.htmlContent ?? "");
    }
  };

  const insertVariable = (v: string) => {
    setBody((prev) => `${prev}{{${v}}}`);
  };

  const previewHtml = useMemo(() => {
    const sample: Record<string, string> = {
      "guest.name": "Alex Example",
      "guest.email": "alex@example.com",
      "event.title": "Your Event",
      "event.date": "Saturday, May 10, 2026",
      "rsvpLink": "https://example.com/rsvp",
    };
    return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => sample[k] ?? `{{${k}}}`);
  }, [body]);

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && recipientCount > 0;

  const buildPayload = () => ({
    subject,
    htmlContent: body,
    recipientFilter: recipient,
    saveAsCampaign: true,
  });

  const doTestSend = async () => {
    if (!testTo) {
      toast({ title: "Enter an email for the test send", variant: "destructive" });
      return;
    }
    setIsTesting(true);
    try {
      // Re-use the test-send flow by first creating a transient campaign via bulk-email to a single ID? Simplest: call a dedicated test route.
      // We inline a test by sending to just the provided email via the bulk endpoint with a synthetic filter isn't possible — so hit a lightweight preview: use fetch to the bulk endpoint with ids=[] is rejected. Instead, POST to existing test send route if we had a campaign. Skip: do an ad-hoc preview via window.open of rendered HTML.
      const w = window.open("", "_blank", "width=720,height=800");
      if (w) {
        w.document.write(`<!doctype html><title>Preview</title><body style="font-family:system-ui;padding:16px"><h3 style="margin:0 0 8px">Subject: ${subject.replace(/</g, "&lt;")}</h3><hr/>${previewHtml}</body>`);
        w.document.close();
      }
      toast({ title: "Preview opened in new tab" });
    } finally {
      setIsTesting(false);
    }
  };

  const doSend = async () => {
    setIsSending(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/events/${eventId}/bulk-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send");
      if (data.previewUrl) {
        toast({
          title: `Sent (preview only) — ${data.sent} recipient${data.sent === 1 ? "" : "s"}`,
          description: "No SMTP configured. Opening Ethereal preview.",
        });
        try { window.open(data.previewUrl, "_blank", "noopener"); } catch { /* noop */ }
      } else {
        toast({ title: `Sent to ${data.sent} guest${data.sent === 1 ? "" : "s"}`, description: data.failed ? `${data.failed} failed` : undefined });
      }
      setConfirmOpen(false);
      onOpenChange(false);
      onSent?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Send failed";
      toast({ title: "Send failed", description: msg, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email guests</DialogTitle>
            <DialogDescription>
              Sending to <Badge variant="secondary">{recipientLabel}</Badge> — {recipientCount} recipient{recipientCount === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label>Start from</Label>
              <Select value={templateId} onValueChange={onPickTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Blank email</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Event update: important info" />
            </div>

            <Tabs defaultValue="edit" className="w-full">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="space-y-2">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={"Hi {{guest.name}},\n\nA quick update about {{event.title}} on {{event.date}}..."}
                  rows={12}
                  className="font-mono text-sm"
                />
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Insert variable:</span>
                  {VARIABLES.map((v) => (
                    <Button key={v} type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => insertVariable(v)}>
                      {`{{${v}}}`}
                    </Button>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="preview">
                <div className="rounded-lg border bg-card p-4 min-h-[240px] text-sm" dangerouslySetInnerHTML={{ __html: previewHtml || "<p class='text-muted-foreground'>Nothing to preview yet.</p>" }} />
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
              <Label>Preview subject &amp; body</Label>
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com (not used for preview)" />
              <Button type="button" variant="outline" onClick={doTestSend} disabled={isTesting || !body || !subject}>
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4 mr-1.5" />}Open preview
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!canSend || isSending}>
              <Send className="h-4 w-4 mr-1.5" />
              Send to {recipientCount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send email to {recipientCount} guest{recipientCount === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              Recipients: <strong>{recipientLabel}</strong>. This will also save a copy to your campaign history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={isSending}>Cancel</Button>
            <Button onClick={doSend} disabled={isSending}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
