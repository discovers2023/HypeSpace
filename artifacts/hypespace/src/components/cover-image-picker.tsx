import { useRef, useState } from "react";
import { UploadCloud, Link2, ImagePlus, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

// Curated stock images for quick picking
const STOCK_IMAGES = [
  { url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200", label: "Conference" },
  { url: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1200", label: "Workshop" },
  { url: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=1200", label: "Networking" },
  { url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200", label: "Party" },
  { url: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=1200", label: "Wedding" },
  { url: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1200", label: "Business" },
];

interface CoverImagePickerProps {
  value?: string;
  onChange: (url: string) => void;
  heightClass?: string;
}

export function CoverImagePicker({ value, onChange, heightClass = "h-48 md:h-56" }: CoverImagePickerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"stock" | "upload" | "url">("stock");
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const openFilePicker = () => fileInputRef.current?.click();

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload PNG, JPG, WebP, or GIF.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "File too large", description: "Max file size is 5 MB.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onChange(dataUrl);
      toast({ title: "Cover image updated" });
      setIsUploading(false);
      setIsOpen(false);
    };
    reader.onerror = () => {
      toast({ title: "Failed to read file", variant: "destructive" });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const applyUrl = () => {
    try {
      new URL(urlInput);
    } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid image URL.", variant: "destructive" });
      return;
    }
    onChange(urlInput);
    toast({ title: "Cover image updated" });
    setIsOpen(false);
    setUrlInput("");
  };

  const applyStock = (url: string) => {
    onChange(url);
    setIsOpen(false);
    toast({ title: "Cover image updated" });
  };

  return (
    <>
      <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden group border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-muted/30`}>
        {value ? (
          <img src={value} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <ImagePlus className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">No cover image yet</p>
          </div>
        )}
        {value && <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />}
        <div className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity ${value ? "bg-black/40 opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
          <Button
            type="button"
            variant="secondary"
            className="gap-2 shadow-lg"
            onClick={() => {
              setMode("stock");
              setIsOpen(true);
            }}
          >
            <UploadCloud className="h-4 w-4" />
            {value ? "Change Cover" : "Add Cover"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="shadow-lg"
              onClick={() => onChange("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={onFileSelect}
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose a cover image</DialogTitle>
            <DialogDescription>Upload from your computer, paste a URL, or pick from our gallery.</DialogDescription>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b">
            {[
              { key: "stock", label: "Gallery", icon: ImagePlus },
              { key: "upload", label: "Upload", icon: UploadCloud },
              { key: "url", label: "From URL", icon: Link2 },
            ].map((t) => {
              const Icon = t.icon;
              const active = mode === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setMode(t.key as any)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Gallery */}
          {mode === "stock" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
              {STOCK_IMAGES.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => applyStock(img.url)}
                  className="relative aspect-video rounded-lg overflow-hidden group border-2 border-border hover:border-primary transition-colors"
                >
                  <img src={img.url} alt={img.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-2 left-2 text-white text-xs font-semibold">{img.label}</span>
                  {value === img.url && (
                    <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Upload */}
          {mode === "upload" && (
            <div className="py-4">
              <div
                onClick={openFilePicker}
                className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                {isUploading ? (
                  <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-3" />
                ) : (
                  <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                )}
                <p className="font-medium mb-1">Click to upload an image</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, WebP, or GIF · Max 5 MB</p>
              </div>
            </div>
          )}

          {/* URL */}
          {mode === "url" && (
            <div className="py-4 space-y-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Image URL</label>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="h-11"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyUrl();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">Paste a direct link to a PNG, JPG, or GIF file.</p>
              </div>
              {urlInput && (
                <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img
                    src={urlInput}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            {mode === "url" && (
              <Button type="button" onClick={applyUrl} disabled={!urlInput} className="bg-primary hover:bg-primary/90 text-white">
                Apply
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
