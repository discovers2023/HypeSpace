import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Get all IANA timezones, with fallback for older environments
function getAllTimezones(): string[] {
  try {
    // @ts-ignore — supportedValuesOf exists in modern runtimes
    const zones = Intl.supportedValuesOf("timeZone");
    if (Array.isArray(zones) && zones.length > 0) return zones;
  } catch {
    /* fall through */
  }
  // Fallback list — common timezones
  return [
    "UTC",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Anchorage", "America/Honolulu", "America/Toronto", "America/Vancouver",
    "America/Mexico_City", "America/Sao_Paulo", "America/Buenos_Aires",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome",
    "Europe/Amsterdam", "Europe/Stockholm", "Europe/Warsaw", "Europe/Istanbul", "Europe/Moscow",
    "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Bangkok", "Asia/Singapore",
    "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul",
    "Australia/Sydney", "Australia/Melbourne", "Australia/Perth",
    "Pacific/Auckland", "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos",
  ];
}

function getTimezoneOffset(tz: string): string {
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(date);
    const offset = parts.find((p) => p.type === "timeZoneName")?.value || "";
    return offset;
  } catch {
    return "";
  }
}

function formatTimezoneLabel(tz: string): { name: string; region: string } {
  const parts = tz.split("/");
  if (parts.length === 1) return { name: tz, region: "" };
  const region = parts[0].replace(/_/g, " ");
  const name = parts.slice(1).join(" / ").replace(/_/g, " ");
  return { name, region };
}

interface TimezonePickerProps {
  value: string;
  onChange: (tz: string) => void;
  className?: string;
  placeholder?: string;
}

export function TimezonePicker({ value, onChange, className, placeholder = "Select a timezone" }: TimezonePickerProps) {
  const [open, setOpen] = useState(false);

  const timezones = useMemo(() => {
    const all = getAllTimezones();
    return all.map((tz) => {
      const { name, region } = formatTimezoneLabel(tz);
      return {
        value: tz,
        label: name,
        region,
        offset: getTimezoneOffset(tz),
        search: `${tz} ${name} ${region}`.toLowerCase(),
      };
    });
  }, []);

  // Group by region for display
  const grouped = useMemo(() => {
    const groups: Record<string, typeof timezones> = {};
    for (const tz of timezones) {
      const key = tz.region || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(tz);
    }
    // sort groups alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [timezones]);

  const selected = timezones.find((t) => t.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal h-11 bg-card", !value && "text-muted-foreground", className)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">
              {selected ? (
                <>
                  <span className="font-medium">{selected.label}</span>
                  {selected.offset && (
                    <span className="text-muted-foreground ml-2 text-xs">({selected.offset})</span>
                  )}
                </>
              ) : (
                placeholder
              )}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, searchTerm) => {
            // itemValue is the `value` prop of CommandItem which we set to tz.search
            if (itemValue.includes(searchTerm.toLowerCase())) return 1;
            return 0;
          }}
        >
          <CommandInput placeholder="Search timezones..." className="h-10" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No timezones found.</CommandEmpty>
            {grouped.map(([region, zones]) => (
              <CommandGroup key={region} heading={region}>
                {zones.map((tz) => (
                  <CommandItem
                    key={tz.value}
                    value={tz.search}
                    onSelect={() => {
                      onChange(tz.value);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Check
                        className={cn("h-4 w-4 shrink-0", value === tz.value ? "opacity-100 text-primary" : "opacity-0")}
                      />
                      <span className="truncate">{tz.label}</span>
                    </div>
                    {tz.offset && (
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{tz.offset}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
