import { useState } from "react";
import { useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  Video,
  CheckCircle2,
  HelpCircle,
  XCircle,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type RsvpStatus = "confirmed" | "maybe" | "declined";

interface PublicEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  onlineUrl?: string;
  category?: string;
  coverImageUrl?: string;
  slug: string;
}

export default function PublicEvent() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const guestTokenFromUrl = params.get("t");

  // Allow a recipient who received a forwarded email to RSVP as themselves
  // by discarding the token and falling back to the self-register form.
  const [useSelfRegister, setUseSelfRegister] = useState(false);
  const guestToken = useSelfRegister ? null : guestTokenFromUrl;

  const [selectedStatus, setSelectedStatus] = useState<RsvpStatus | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [phone, setPhone] = useState("");
  const [optInFuture, setOptInFuture] = useState(true);
  const [rsvpSuccess, setRsvpSuccess] = useState<RsvpStatus | null>(null);

  const {
    data: event,
    isLoading,
    isError,
  } = useQuery<PublicEvent>({
    queryKey: ["public-event", slug],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/public/events/${slug}`);
      if (res.status === 404) throw new Error("not-found");
      if (!res.ok) throw new Error("Failed to fetch event");
      return res.json();
    },
    enabled: !!slug,
    retry: false,
  });

  const rsvpMutation = useMutation({
    mutationFn: async (status: RsvpStatus) => {
      const body = guestToken
        ? { status, guestToken }
        : {
            status,
            firstName,
            lastName,
            email,
            practiceName: practiceName || undefined,
            specialty: specialty || undefined,
            phone: phone || undefined,
            optInFuture,
          };
      const res = await fetch(`${BASE}/api/public/events/${slug}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "RSVP failed");
      }
      return res.json();
    },
    onSuccess: (_data, status) => {
      setRsvpSuccess(status);
      setSelectedStatus(null);
    },
  });

  const handleRsvpClick = (status: RsvpStatus) => {
    if (guestToken) {
      rsvpMutation.mutate(status);
    } else {
      setSelectedStatus(status);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus || !firstName.trim() || !lastName.trim() || !email.trim()) return;
    rsvpMutation.mutate(selectedStatus);
  };

  const statusLabel: Record<RsvpStatus, string> = {
    confirmed: "attending",
    maybe: "a maybe",
    declined: "not attending",
  };

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-64 md:h-80">
          <Skeleton className="h-full w-full rounded-none" />
        </div>
        <div className="max-w-2xl mx-auto px-4 -mt-12 relative z-10">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- 404 state ---
  if (isError || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Calendar className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Event not found</h1>
          <p className="text-muted-foreground max-w-md">
            This event may have been removed or the link is no longer valid.
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const startDate = parseISO(event.startDate);
  const endDate = event.endDate ? parseISO(event.endDate) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero banner */}
      {event.coverImageUrl ? (
        <div className="h-64 md:h-80 relative overflow-hidden">
          <img
            src={event.coverImageUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      ) : (
        <div className="h-48 md:h-64 bg-gradient-to-r from-primary to-accent relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-16 w-16 text-white/30" />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1">
        <div className="max-w-2xl mx-auto px-4 pb-16 -mt-12 relative z-10">
          <Card className="shadow-xl">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {event.category && (
                  <Badge variant="secondary">{event.category}</Badge>
                )}
              </div>
              <CardTitle className="text-2xl md:text-3xl font-bold">
                {event.title}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Date & time */}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">
                    {format(startDate, "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(startDate, "h:mm a")}
                    {endDate && ` - ${format(endDate, "h:mm a")}`}
                  </p>
                </div>
              </div>

              {/* Location */}
              {event.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="font-medium">{event.location}</p>
                </div>
              )}

              {/* Online URL */}
              {event.onlineUrl && (
                <div className="flex items-start gap-3">
                  <Video className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <a
                    href={event.onlineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline break-all"
                  >
                    Join online
                  </a>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {event.description}
                  </p>
                </div>
              )}

              {/* RSVP section */}
              <div className="pt-4 border-t">
                {rsvpSuccess ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-7 w-7 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold">
                      You're registered as {statusLabel[rsvpSuccess]}!
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {rsvpSuccess === "confirmed"
                        ? "We look forward to seeing you there."
                        : rsvpSuccess === "maybe"
                          ? "We hope to see you! You can update your response anytime."
                          : "Thanks for letting us know. Maybe next time!"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-center">
                      Will you attend?
                    </h3>

                    {guestTokenFromUrl && !useSelfRegister && (
                      <div className="text-center -mt-1">
                        <button
                          type="button"
                          onClick={() => setUseSelfRegister(true)}
                          className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
                        >
                          Not you? RSVP as a different person →
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      <Button
                        variant={selectedStatus === "confirmed" ? "default" : "outline"}
                        className={`h-auto py-3 flex flex-col items-center gap-1.5 ${
                          selectedStatus === "confirmed"
                            ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                            : "hover:border-green-600 hover:text-green-600"
                        }`}
                        onClick={() => handleRsvpClick("confirmed")}
                        disabled={rsvpMutation.isPending}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-xs font-medium">Yes</span>
                      </Button>
                      <Button
                        variant={selectedStatus === "maybe" ? "default" : "outline"}
                        className={`h-auto py-3 flex flex-col items-center gap-1.5 ${
                          selectedStatus === "maybe"
                            ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
                            : "hover:border-amber-500 hover:text-amber-500"
                        }`}
                        onClick={() => handleRsvpClick("maybe")}
                        disabled={rsvpMutation.isPending}
                      >
                        <HelpCircle className="h-5 w-5" />
                        <span className="text-xs font-medium">Maybe</span>
                      </Button>
                      <Button
                        variant={selectedStatus === "declined" ? "default" : "outline"}
                        className={`h-auto py-3 flex flex-col items-center gap-1.5 ${
                          selectedStatus === "declined"
                            ? "bg-red-500 hover:bg-red-600 text-white border-red-500"
                            : "hover:border-red-500 hover:text-red-500"
                        }`}
                        onClick={() => handleRsvpClick("declined")}
                        disabled={rsvpMutation.isPending}
                      >
                        <XCircle className="h-5 w-5" />
                        <span className="text-xs font-medium">No</span>
                      </Button>
                    </div>

                    {/* Registration form (only when no guest token) */}
                    {!guestToken && selectedStatus && (
                      <form onSubmit={handleFormSubmit} className="space-y-3 pt-3 border-t">
                        <p className="text-sm text-muted-foreground text-center">Please fill out your details to RSVP.</p>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            placeholder="First name *"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            autoFocus
                          />
                          <Input
                            placeholder="Last name *"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                          />
                        </div>
                        <Input
                          type="email"
                          placeholder="Email address *"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                        <Input
                          placeholder="Practice name"
                          value={practiceName}
                          onChange={(e) => setPracticeName(e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            placeholder="Specialty (optional)"
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                          />
                          <Input
                            type="tel"
                            placeholder="Phone (optional)"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                        <label className="flex items-start gap-2.5 text-sm text-muted-foreground cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={optInFuture}
                            onChange={(e) => setOptInFuture(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-muted-foreground/30 accent-primary"
                          />
                          <span>Keep me in the loop on future study club events.</span>
                        </label>
                        <Button
                          type="submit"
                          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white border-0"
                          disabled={
                            rsvpMutation.isPending ||
                            !firstName.trim() ||
                            !lastName.trim() ||
                            !email.trim()
                          }
                        >
                          {rsvpMutation.isPending
                            ? "Submitting..."
                            : selectedStatus === "confirmed"
                              ? "Yes, I'll Attend"
                              : selectedStatus === "maybe"
                                ? "Register as Maybe"
                                : "Submit Response"}
                        </Button>
                      </form>
                    )}

                    {rsvpMutation.isError && (
                      <p className="text-sm text-red-500 text-center">
                        {rsvpMutation.error?.message || "Something went wrong. Please try again."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by{" "}
          <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
            HypeSpace
          </span>
        </p>
      </footer>
    </div>
  );
}
