/**
 * Reusable GoHighLevel contact import modal.
 *
 * Originally embedded in settings.tsx. Lifted into a shared component so
 * event pages can open it directly without routing through Settings → Integrations.
 *
 * Props:
 *  - `orgId` — current organization
 *  - `open` / `onClose` — controlled dialog state
 *  - `initialEventId` — optional. If provided, the "Import into event" dropdown
 *    is pre-selected on the preview step (useful when opening from an event's
 *    detail page so users don't have to pick the event they're already on).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useListEvents } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type GHLContact = {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  // New fields imported from GHL: practiceName comes from a custom field
  // (falls back to company if not present). specialty comes from a "specialty"
  // custom field if present. tags are the contact's GHL tags array.
  practiceName: string | null;
  specialty: string | null;
  tags: string[];
};
type ImportStep = "configure" | "preview" | "success";

export function GHLImportModal({
  orgId,
  open,
  onClose,
  initialEventId,
}: {
  orgId: number;
  open: boolean;
  onClose: () => void;
  initialEventId?: number;
}) {
  const { data: eventsData } = useListEvents(orgId);
  const events = eventsData ?? [];
  const queryClient = useQueryClient();

  const [step, setStep] = useState<ImportStep>("configure");
  const [filterMode, setFilterMode] = useState<"all" | "tags">("all");
  const [tagInput, setTagInput] = useState("");
  const [eventId, setEventId] = useState<string>(
    initialEventId ? String(initialEventId) : "",
  );
  const [contacts, setContacts] = useState<GHLContact[]>([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const parsedTags = tagInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Keep eventId in sync if the caller changes initialEventId while modal is open
  useEffect(() => {
    if (initialEventId && !eventId) {
      setEventId(String(initialEventId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEventId]);

  const reset = () => {
    setStep("configure");
    setFilterMode("all");
    setTagInput("");
    setEventId(initialEventId ? String(initialEventId) : "");
    setContacts([]);
    setImportResult(null);
    setErrorMsg("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePreview = async () => {
    setErrorMsg("");
    if (filterMode === "tags" && parsedTags.length === 0) {
      setErrorMsg("Enter at least one tag, or switch to 'All contacts'.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE}/api/organizations/${orgId}/integrations/gohighlevel/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tags: filterMode === "tags" ? parsedTags : [],
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch contacts");
      setContacts(data.contacts ?? []);
      setStep("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!eventId) {
      setErrorMsg("Please select an event to import contacts into.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE}/api/organizations/${orgId}/integrations/gohighlevel/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tags: filterMode === "tags" ? parsedTags : [],
            eventId,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult({ imported: data.imported, skipped: data.skipped });
      setStep("success");
      // Invalidate the guest list for the event we just imported into so any
      // open event-detail page refreshes immediately.
      const evIdNum = parseInt(eventId, 10);
      if (!Number.isNaN(evIdNum)) {
        const url = `/api/organizations/${orgId}/events/${evIdNum}/guests`;
        queryClient.invalidateQueries({
          predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === url,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const previewLabel =
    filterMode === "all"
      ? `${contacts.length} contact${contacts.length !== 1 ? "s" : ""} found`
      : `${contacts.length} contact${contacts.length !== 1 ? "s" : ""} with tag${parsedTags.length !== 1 ? "s" : ""} ${parsedTags.map((t) => `"${t}"`).join(", ")}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">🚀</span> Go HighLevel — Import Contacts
          </DialogTitle>
          <DialogDescription>
            {step === "configure" &&
              "Choose which contacts to pull from your GHL sub-account."}
            {step === "preview" && previewLabel}
            {step === "success" && "Import complete!"}
          </DialogDescription>
        </DialogHeader>

        {step === "configure" && (
          <div className="space-y-4 py-2">
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
                <label className="text-sm font-medium">
                  Tags{" "}
                  <span className="text-muted-foreground font-normal">
                    (comma-separated)
                  </span>
                </label>
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="studyclub, vip, speaker"
                  className="font-mono"
                  autoFocus
                />
                {parsedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {parsedTags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Contacts matching any of these tags will be imported.
                </p>
              </div>
            )}

            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {errorMsg}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
                onClick={handlePreview}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Fetching…
                  </>
                ) : (
                  "Fetch Contacts →"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-2">
            {contacts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No contacts found with tag <strong>"{tagInput}"</strong> in Go
                HighLevel.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                        <th className="text-left px-3 py-2 font-medium">Phone</th>
                        <th className="text-left px-3 py-2 font-medium">Practice</th>
                        <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                          Specialty
                        </th>
                        <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">
                          Tags
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((c, i) => (
                        <tr key={i} className="border-t hover:bg-muted/20 align-top">
                          <td className="px-3 py-2 font-medium whitespace-nowrap">
                            {c.name}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {c.email}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {c.phone ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.practiceName ?? c.company ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                            {c.specialty ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">
                            {c.tags && c.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {c.tags.slice(0, 3).map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-medium"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {c.tags.length > 3 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{c.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
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
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
              {initialEventId && eventId === String(initialEventId) && (
                <p className="text-xs text-muted-foreground">
                  Pre-selected to the event you&rsquo;re currently viewing.
                </p>
              )}
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {errorMsg}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("configure");
                  setErrorMsg("");
                }}
              >
                ← Back
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
                onClick={handleImport}
                disabled={loading || contacts.length === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importing…
                  </>
                ) : (
                  `Import ${contacts.length} Contact${contacts.length !== 1 ? "s" : ""}`
                )}
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
                  {importResult.imported} contact
                  {importResult.imported !== 1 ? "s" : ""} imported
                </p>
                {importResult.skipped > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {importResult.skipped} skipped (already in guest list)
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-200 bg-green-50"
                >
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
              <Button variant="outline" onClick={reset}>
                Import more
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0"
                onClick={handleClose}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
