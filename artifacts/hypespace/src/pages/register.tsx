import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
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
import { AlertCircle, Eye, EyeOff, CheckCircle2, Calendar, Users, Mail, Share2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const registerSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters"),
  company: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "One number", ok: /[0-9]/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      {checks.map(c => (
        <div key={c.label} className="flex items-center gap-1.5">
          <CheckCircle2
            className={`h-3 w-3 shrink-0 transition-colors ${c.ok ? "text-green-500" : "text-muted-foreground/40"}`}
          />
          <span className={`text-xs transition-colors ${c.ok ? "text-green-700" : "text-muted-foreground"}`}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Register() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", company: "", email: "", password: "" },
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    const emailParam = params.get("email");
    if (emailParam) {
      form.setValue("email", emailParam);
    }
  }, [search, form]);

  const password = form.watch("password");

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setGlobalError(null);

    try {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
          company: data.company,
        }),
      });

      const body = await res.json();

      if (res.ok || res.status === 201) {
        setLocation("/dashboard");
        return;
      }

      if (body.error === "EMAIL_TAKEN") {
        form.setError("email", {
          type: "manual",
          message: "This email is already registered.",
        });
        setGlobalError("email_taken");
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Create your account</h1>
            <p className="text-muted-foreground">Join thousands of organizers launching better events.</p>
          </div>

          {globalError === "email_taken" && (
            <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">Email already in use</p>
                <p className="text-amber-700 mt-0.5">
                  An account with this email already exists.{" "}
                  <Link href="/login" className="font-semibold underline underline-offset-2 hover:text-amber-900">
                    Log in instead &rarr;
                  </Link>
                </p>
              </div>
            </div>
          )}

          {globalError && globalError !== "email_taken" && (
            <div className="mb-5 flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{globalError}</p>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" autoComplete="name" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Inc" autoComplete="organization" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                          if (globalError === "email_taken") setGlobalError(null);
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 8 characters"
                          autoComplete="new-password"
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
                    <PasswordStrength password={password} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-11 mt-2 bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/15"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Get started"}
              </Button>
            </form>
          </Form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        {/* Background orbs */}
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-accent/8 blur-3xl" />

        <div className="relative max-w-lg mx-12">
          <h2 className="text-4xl font-bold text-foreground mb-8">Everything you need to hype your space.</h2>
          <ul className="space-y-5">
            {[
              { icon: Calendar, text: "Beautiful event landing pages" },
              { icon: Users, text: "Seamless guest list management" },
              { icon: Mail, text: "AI-powered email campaigns" },
              { icon: Share2, text: "Automated social scheduling" },
            ].map((item, i) => (
              <li key={i} className="flex items-center text-lg text-foreground/90 gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
