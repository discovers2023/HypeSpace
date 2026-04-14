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

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setGlobalError(null);

    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      const body = await res.json();

      if (res.ok) {
        setLocation("/dashboard");
        return;
      }

      if (body.error === "USER_NOT_FOUND") {
        form.setError("email", {
          type: "manual",
          message: "No account found with this email address.",
        });
        setGlobalError("register");
        return;
      }

      if (body.error === "WRONG_PASSWORD") {
        form.setError("password", {
          type: "manual",
          message: "Incorrect password. Please try again.",
        });
        return;
      }

      setGlobalError("Something went wrong. Please try again.");
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

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back</h1>
            <p className="text-muted-foreground">Log in to manage your events and campaigns.</p>
          </div>

          {globalError === "register" && (
            <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">No account found</p>
                <p className="text-amber-700 mt-0.5">
                  This email isn't registered yet.{" "}
                  <Link
                    href={`/register?email=${encodeURIComponent(form.getValues("email"))}`}
                    className="font-semibold underline underline-offset-2 hover:text-amber-900"
                  >
                    Create a free account &rarr;
                  </Link>
                </p>
              </div>
            </div>
          )}

          {globalError && globalError !== "register" && (
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
                        onChange={(e) => {
                          field.onChange(e);
                          if (globalError === "register") setGlobalError(null);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link href="#" className="text-sm font-medium text-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          className="h-11 pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowPassword(s => !s)}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                {isLoading ? "Logging in..." : "Log in"}
              </Button>
            </form>
          </Form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Sign up free
            </Link>
          </p>
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
              "HypeSpace transformed how we manage our annual conference. From guest lists to follow-up campaigns, everything is seamlessly integrated."
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
