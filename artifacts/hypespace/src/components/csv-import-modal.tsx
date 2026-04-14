/**
 * CSV Import Modal for importing contacts from a CSV file into an event's
 * guest list. Supports drag-and-drop and file picker.
 *
 * Expected CSV columns: name, email, phone (optional), company (optional), notes (optional)
 * Automatically detects headers and maps common variations (e.g. "full name" → name).
 */
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  AlertTriangle,
  X,
} from "lucide-react";
import { useBulkAddGuests } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type ParsedContact = {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  notes: string | null;
};

type ImportStep = "upload" | "preview" | "success";

/** Normalise a CSV header to a known field name. */
function mapHeader(raw: string): keyof ParsedContact | null {
  const h = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["name", "fullname", "contactname", "guestname"].includes(h)) return "name";
  if (["email", "emailaddress", "mail"].includes(h)) return "email";
  if (["phone", "phonenumber", "mobile", "cell", "telephone"].includes(h)) return "phone";
  if (["company", "organization", "organisation", "practice", "practicename", "companyname"].includes(h)) return "company";
  if (["notes", "note", "comment", "comments"].includes(h)) return "notes";
  return null;
}

/** Simple CSV parser that handles quoted fields with commas/newlines. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\r" && next === "\n") {
        row.push(cell);
        cell = "";
        if (row.some((c) => c.trim())) rows.push(row);
        row = [];
        i++;
      } else if (ch === "\n") {
        row.push(cell);
        cell = "";
        if (row.some((c) => c.trim())) rows.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
  }
  // last cell / row
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);

  return rows;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CSVImportModal({
  orgId,
  eventId,
  open,
  onClose,
}: {
  orgId: number;
  eventId: number;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const bulkAdd = useBulkAddGuests();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setContacts([]);
    setWarnings([]);
    setErrorMsg("");
    setImportResult(null);
    setIsDragging(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = useCallback((file: File) => {
    setErrorMsg("");
    setWarnings([]);

    if (!file.name.endsWith(".csv")) {
      setErrorMsg("Please upload a .csv file.");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text?.trim()) {
        setErrorMsg("The file appears to be empty.");
        return;
      }

      const rows = parseCSV(text);
      if (rows.length < 2) {
        setErrorMsg("CSV must have a header row and at least one data row.");
        return;
      }

      const headerRow = rows[0];
      const mapping: (keyof ParsedContact | null)[] = headerRow.map(mapHeader);

      const nameIdx = mapping.indexOf("name");
      const emailIdx = mapping.indexOf("email");

      if (nameIdx === -1 || emailIdx === -1) {
        setErrorMsg(
          `Could not find required columns. Found headers: ${headerRow.map((h) => `"${h.trim()}"`).join(", ")}. Need at least "name" and "email".`,
        );
        return;
      }

      const parsed: ParsedContact[] = [];
      const rowWarnings: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i];
        const name = cells[nameIdx]?.trim() || "";
        const email = cells[emailIdx]?.trim() || "";

        if (!name && !email) continue; // skip blank rows

        if (!name) {
          rowWarnings.push(`Row ${i + 1}: missing name, skipped`);
          continue;
        }
        if (!email || !EMAIL_RE.test(email)) {
          rowWarnings.push(`Row ${i + 1}: invalid email "${email}", skipped`);
          continue;
        }

        const contact: ParsedContact = {
          name,
          email,
          phone: null,
          company: null,
          notes: null,
        };

        mapping.forEach((field, idx) => {
          if (field && field !== "name" && field !== "email" && cells[idx]?.trim()) {
            contact[field] = cells[idx].trim();
          }
        });

        parsed.push(contact);
      }

      if (parsed.length === 0) {
        setErrorMsg("No valid contacts found in the CSV. Check that rows have name and email.");
        return;
      }

      // Deduplicate by email
      const seen = new Set<string>();
      const deduped: ParsedContact[] = [];
      for (const c of parsed) {
        const key = c.email.toLowerCase();
        if (seen.has(key)) {
          rowWarnings.push(`Duplicate email "${c.email}" removed`);
          continue;
        }
        seen.add(key);
        deduped.push(c);
      }

      setContacts(deduped);
      setWarnings(rowWarnings);
      setStep("preview");
    };

    reader.onerror = () => setErrorMsg("Failed to read the file.");
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    setErrorMsg("");
    bulkAdd.mutate(
      {
        orgId,
        eventId,
        data: {
          guests: contacts.map((c) => ({
            name: c.name,
            email: c.email,
            ...(c.phone ? { phone: c.phone } : {}),
            ...(c.company ? { company: c.company } : {}),
            ...(c.notes ? { notes: c.notes } : {}),
          })),
        },
      },
      {
        onSuccess: (result) => {
          const imported = Array.isArray(result) ? result.length : contacts.length;
          setImportResult({ imported, skipped: contacts.length - imported });
          setStep("success");
          // Invalidate guest list cache
          const url = `/api/organizations/${orgId}/events/${eventId}/guests`;
          queryClient.invalidateQueries({
            predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === url,
          });
          queryClient.invalidateQueries({
            queryKey: [`/api/organizations/${orgId}/events/${eventId}`],
          });
        },
        onError: (err) => {
          setErrorMsg(err instanceof Error ? err.message : "Import failed");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Contacts from CSV
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file with contact information to add as guests."}
            {step === "preview" && `${contacts.length} contact${contacts.length !== 1 ? "s" : ""} ready to import from ${fileName}`}
            {step === "success" && "Import complete!"}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                ${isDragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }
              `}
            >
              <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? "text-primary" : "text-muted-foreground/40"}`} />
              <p className="font-medium text-foreground mb-1">
                {isDragging ? "Drop your CSV here" : "Drag & drop a CSV file"}
              </p>
              <p className="text-sm text-muted-foreground">
                or <span className="text-primary underline underline-offset-2">browse files</span>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">Expected format</p>
              <p>Required columns: <code className="bg-muted px-1 rounded">name</code>, <code className="bg-muted px-1 rounded">email</code></p>
              <p>Optional columns: <code className="bg-muted px-1 rounded">phone</code>, <code className="bg-muted px-1 rounded">company</code>, <code className="bg-muted px-1 rounded">notes</code></p>
              <p className="font-mono text-[11px] mt-2 bg-muted rounded px-2 py-1">
                name,email,phone,company<br />
                Jane Smith,jane@example.com,555-0123,Acme Dental
              </p>
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {errorMsg}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-2">
            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
                </p>
                <div className="max-h-20 overflow-auto text-xs text-amber-700 space-y-0.5">
                  {warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              </div>
            )}

            <div className="rounded-lg border overflow-hidden">
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Phone</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Company</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c, i) => (
                      <tr key={i} className="border-t hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{c.name}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{c.email}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{c.phone ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.company ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {errorMsg}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setStep("upload"); setErrorMsg(""); }}>
                Back
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 border-0 hover:opacity-90"
                onClick={handleImport}
                disabled={bulkAdd.isPending || contacts.length === 0}
              >
                {bulkAdd.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importing...
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
                <p className="font-semibold">
                  {importResult.imported} contact{importResult.imported !== 1 ? "s" : ""} imported
                </p>
                {importResult.skipped > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {importResult.skipped} skipped (already in guest list or duplicate)
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  {importResult.imported} added
                </Badge>
                {importResult.skipped > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {importResult.skipped} skipped
                  </Badge>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Import more</Button>
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
