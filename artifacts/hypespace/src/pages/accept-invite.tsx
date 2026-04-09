import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import logoUrl from "@assets/HS_logo_1775759732611.png";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]+$/, "") || "";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type FormValues = z.infer<typeof schema>;

interface InviteInfo {
  email: string;
  name: string;
  orgName: string;
  role: string;
  isNewUser: boolean;
}

export default function AcceptInvite() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = form.watch("password");
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) { setStatus("error"); setErrorMsg("No invitation token found in the link."); return; }
    setToken(t);

    fetch(`${API_BASE}/api/invite/${t}`)
      .then((r) => {
        if (r.status === 404) throw new Error("This invitation link is invalid or has already been used.");
        if (r.status === 410) throw new Error("This invitation link has expired. Please ask your admin to resend it.");
        if (r.status === 409) throw new Error("This invitation has already been accepted. You can log in directly.");
        if (!r.ok) throw new Error("Something went wrong. Please try again.");
        return r.json();
      })
      .then((data) => { setInviteInfo(data); setStatus("ready"); })
      .catch((err) => { setStatus("error"); setErrorMsg(err.message); });
  }, []);

  const onSubmit = async (data: FormValues) => {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/api/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.password }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        if (body.error === "TOKEN_EXPIRED") throw new Error("This invite link has expired.");
        if (body.error === "ALREADY_ACCEPTED") throw new Error("This invite has already been accepted.");
        throw new Error("Could not accept invite. Please try again.");
      }
      setStatus("success");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Something went wrong.");
    }
  };

  const roleLabel = inviteInfo?.role === "admin" ? "Admin" : inviteInfo?.role === "manager" ? "Manager" : "Member";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img src={logoUrl} alt="HypeSpace" className="h-9 mx-auto" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#FF8C00] to-[#FF1493]" />

          <div className="p-8">
            {/* Loading */}
            {status === "loading" && (
              <div className="flex flex-col items-center py-8 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-[#FF8C00]" />
                <p className="text-sm">Validating your invitation…</p>
              </div>
            )}

            {/* Error */}
            {status === "error" && (
              <div className="flex flex-col items-center py-8 gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="h-7 w-7 text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#1a0533] mb-1">Invite Link Problem</h2>
                  <p className="text-sm text-muted-foreground">{errorMsg}</p>
                </div>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => navigate("/login")}
                >
                  Go to Login
                </Button>
              </div>
            )}

            {/* Success */}
            {status === "success" && (
              <div className="flex flex-col items-center py-8 gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-green-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#1a0533] mb-1">You're in!</h2>
                  <p className="text-sm text-muted-foreground">
                    Your account is set up. You can now log in to <strong>{inviteInfo?.orgName}</strong>.
                  </p>
                </div>
                <Button
                  className="mt-2 bg-gradient-to-r from-[#FF8C00] to-[#FF1493] text-white border-0 hover:opacity-90"
                  onClick={() => navigate(`/login?email=${encodeURIComponent(inviteInfo?.email ?? "")}`)}
                >
                  Log in now →
                </Button>
              </div>
            )}

            {/* Ready — show accept form */}
            {status === "ready" && inviteInfo && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1a0533] mb-1">Accept your invitation</h2>
                  <p className="text-sm text-muted-foreground">
                    You've been invited to join <strong className="text-[#1a0533]">{inviteInfo.orgName}</strong> as a <strong className="text-[#FF8C00]">{roleLabel}</strong>.
                  </p>
                </div>

                {/* Invite summary card */}
                <div className="bg-purple-50 rounded-lg border border-purple-100 p-4 mb-6 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF8C00] to-[#FF1493] flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {inviteInfo.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[#1a0533] text-sm truncate">{inviteInfo.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{inviteInfo.email}</p>
                  </div>
                  <div className="ml-auto shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs bg-white border border-purple-200 text-purple-700 rounded-full px-2 py-0.5 font-medium">
                      <ShieldCheck className="h-3 w-3" />
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Password */}
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Create a password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Min. 8 characters"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </FormControl>
                          {/* Strength checklist */}
                          {password.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {[
                                { ok: checks.length, label: "At least 8 characters" },
                                { ok: checks.upper,  label: "One uppercase letter" },
                                { ok: checks.number, label: "One number" },
                              ].map(({ ok, label }) => (
                                <li key={label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-600" : "text-muted-foreground"}`}>
                                  <CheckCircle2 className={`h-3 w-3 ${ok ? "text-green-500" : "text-gray-300"}`} />
                                  {label}
                                </li>
                              ))}
                            </ul>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Confirm password */}
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirm ? "text" : "password"}
                                placeholder="Repeat your password"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirm((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {errorMsg && (
                      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {errorMsg}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-[#FF8C00] to-[#FF1493] text-white border-0 hover:opacity-90 h-11"
                      disabled={form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Setting up account…</>
                      ) : (
                        "Accept invitation & create account"
                      )}
                    </Button>
                  </form>
                </Form>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-[#FF8C00] hover:underline font-medium">Log in</a>
        </p>
      </div>
    </div>
  );
}
