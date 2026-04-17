import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";
import {
  BrandingTab,
  EmailSendingTab,
  AiSettingsTab,
  IntegrationsTab,
} from "@/pages/settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ArrowRight, ArrowLeft, X, LogOut } from "lucide-react";
import logoSrc from "@assets/HS_logo_1775759732611.png";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type StepId = "branding" | "email" | "ai" | "integrations";

const STEPS: { id: StepId; title: string; description: string }[] = [
  {
    id: "branding",
    title: "Branding",
    description:
      "Logo and colors for your event pages and emails.",
  },
  {
    id: "email",
    title: "Email Sending",
    description:
      "Connect a sending domain so campaigns come from your address.",
  },
  {
    id: "ai",
    title: "AI Settings",
    description:
      "Hook up an AI provider (Anthropic, OpenAI, Gemini, or Ollama) for campaign generation.",
  },
  {
    id: "integrations",
    title: "Integrations",
    description:
      "Connect contact sources (GoHighLevel, HubSpot) and social platforms.",
  },
];

export default function Onboarding() {
  const { user, activeOrgId, isLoading, refreshOnboarding, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visited, setVisited] = useState<Set<StepId>>(new Set([STEPS[0].id]));
  const [isFinishing, setIsFinishing] = useState(false);

  const current = STEPS[currentIdx];
  const isLast = currentIdx === STEPS.length - 1;
  const isFirst = currentIdx === 0;

  const goToStep = (idx: number) => {
    if (idx < 0 || idx >= STEPS.length) return;
    setCurrentIdx(idx);
    setVisited((prev) => {
      const next = new Set(prev);
      next.add(STEPS[idx].id);
      return next;
    });
  };

  async function handleFinish() {
    if (!activeOrgId) return;
    setIsFinishing(true);
    try {
      await fetch(`${BASE}/api/organizations/${activeOrgId}/onboarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
      refreshOnboarding();
      setLocation("/dashboard");
    } finally {
      setIsFinishing(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // best effort — proceed with client-side logout regardless
    }
    logout();
    setLocation("/login");
  }

  // Loading state — auth provider hasn't resolved yet
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full px-6 space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Not authenticated → bounce to login
  if (!user) {
    setLocation("/login");
    return null;
  }

  // auth-provider hasn't resolved activeOrgId yet
  if (!activeOrgId) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="w-full border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/dashboard">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={logoSrc} alt="HypeSpace" className="h-8 w-auto" />
              <span className="font-semibold tracking-tight">HypeSpace</span>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to HypeSpace</h1>
          <p className="text-muted-foreground mt-1">
            Let's get your workspace set up. You can come back to any of these
            any time under <Link href="/settings"><span className="text-primary hover:underline cursor-pointer">Settings</span></Link> — this wizard just walks you through them once.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Step rail */}
          <aside className="flex flex-col gap-1">
            {STEPS.map((step, idx) => {
              const isActive = idx === currentIdx;
              const isVisited = visited.has(step.id);
              return (
                <button
                  key={step.id}
                  onClick={() => goToStep(idx)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : isVisited
                        ? "text-foreground hover:bg-muted/50"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isVisited
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isVisited && !isActive ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span className={isVisited || isActive ? "" : "opacity-70"}>
                    {step.title}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Main panel */}
          <div className="md:col-span-3 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>
                    Step {currentIdx + 1} of {STEPS.length}: {current.title}
                  </CardTitle>
                  <CardDescription>{current.description}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFinish}
                  disabled={isFinishing}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Skip setup
                </Button>
              </CardHeader>
              <CardContent>
                {current.id === "branding" && <BrandingTab orgId={activeOrgId} />}
                {current.id === "email" && <EmailSendingTab orgId={activeOrgId} />}
                {current.id === "ai" && <AiSettingsTab orgId={activeOrgId} />}
                {current.id === "integrations" && <IntegrationsTab orgId={activeOrgId} />}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => goToStep(currentIdx - 1)}
                disabled={isFirst || isFinishing}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              {isLast ? (
                <Button onClick={handleFinish} disabled={isFinishing}>
                  {isFinishing ? "Finishing..." : "Finish"}
                  <Check className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={() => goToStep(currentIdx + 1)}
                  disabled={isFinishing}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
