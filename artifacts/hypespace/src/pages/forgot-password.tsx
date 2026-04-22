import { useState } from "react";
import { Link } from "wouter";
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
import { AlertCircle, Sparkles } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const form = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotFormValues) => {
    setIsLoading(true);
    setGlobalError(null);

    try {
      await fetch(`${BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: data.email }),
      });
      // Always show confirmation regardless of response — no enumeration
      setSubmittedEmail(data.email);
      setSubmitted(true);
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

          {submitted ? (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Check your email</h1>
                <p className="text-muted-foreground">
                  If an account exists for{" "}
                  <strong className="text-foreground">{submittedEmail}</strong>, we've sent a
                  password reset link. The link will expire in 1 hour.
                </p>
              </div>
              <Link
                href="/login"
                className="text-sm font-medium text-primary hover:underline"
              >
                &larr; Back to log in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Forgot your password?</h1>
                <p className="text-muted-foreground">
                  Enter the email associated with your account and we'll send a link to reset your
                  password.
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
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="you@company.com"
                            autoComplete="email"
                            className="h-11"
                            {...field}
                          />
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
                    {isLoading ? "Sending..." : "Send reset link"}
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
