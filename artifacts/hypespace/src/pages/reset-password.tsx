import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import logoSrc from "@assets/HS_logo_1775759732611.png";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const resetSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type ResetFormValues = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const token = new URLSearchParams(window.location.search).get("token");

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetFormValues) => {
    if (!token) return;
    setIsLoading(true);
    setGlobalError(null);

    try {
      const res = await fetch(`${BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, newPassword: data.newPassword }),
      });

      if (res.ok) {
        toast({
          title: "Password updated",
          description: "You can now log in with your new password.",
        });
        setLocation("/login");
        return;
      }

      const body = await res.json().catch(() => ({}));
      setGlobalError(body?.message ?? "This reset link is invalid or has expired.");
    } catch {
      setGlobalError("Unable to connect. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16 z-10 relative">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block">
            <img src={logoSrc} alt="HypeSpace" className="h-8" />
          </Link>

          {!token ? (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Invalid reset link</h1>
                <p className="text-muted-foreground">
                  This password reset link is missing a token. Please request a new one.
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                Request a new link &rarr;
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Choose a new password</h1>
                <p className="text-muted-foreground">
                  Pick a strong password you don't use anywhere else.
                </p>
              </div>

              {globalError && (
                <div className="mb-5 flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{globalError}</p>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="At least 8 characters"
                              autoComplete="new-password"
                              className="h-11 pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setShowPassword((s) => !s)}
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm new password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirm ? "text" : "password"}
                              placeholder="Repeat your password"
                              autoComplete="new-password"
                              className="h-11 pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setShowConfirm((s) => !s)}
                              tabIndex={-1}
                            >
                              {showConfirm ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15 mt-1"
                    disabled={isLoading}
                  >
                    {isLoading ? "Updating..." : "Update password"}
                  </Button>
                </form>
              </Form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Remembered your password?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        {/* Background orbs */}
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-accent/8 blur-3xl" />

        {/* Glassmorphic testimonial card */}
        <div className="relative max-w-md mx-12">
          <div className="glass rounded-2xl p-8 shadow-xl">
            <div className="flex items-center gap-2 text-primary mb-6">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-semibold">What our users say</span>
            </div>
            <p className="text-lg font-medium text-foreground mb-6 leading-relaxed">
              "HypeSpace transformed how we manage our annual conference. From guest lists to
              follow-up campaigns, everything is seamlessly integrated."
            </p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center font-bold text-primary text-sm">
                SJ
              </div>
              <div>
                <p className="font-semibold text-sm">Sarah Jenkins</p>
                <p className="text-xs text-muted-foreground">Director of Events, TechCorp</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
