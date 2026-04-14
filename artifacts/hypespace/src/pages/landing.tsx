import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Zap,
  Users,
  BarChart3,
  Share2,
  CalendarDays,
  Layers,
  CheckCircle2,
  ArrowUpRight,
  Play,
  Shield,
  Clock,
  Mail,
  Megaphone,
  MousePointerClick,
  Sparkles,
  Star,
  ChevronRight,
} from "lucide-react";
import logoSrc from "@assets/HS_logo_1775759732611.png";

/* ─────────────────────────────────────────────────────────
   DECORATIVE ORB — warm gradient blobs
   ───────────────────────────────────────────────────────── */
function WarmOrb({
  className = "",
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={`absolute rounded-full pointer-events-none blur-3xl ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 2, delay, ease: "easeOut" }}
    />
  );
}

/* ─────────────────────────────────────────────────────────
   NAVBAR — clean floating glass on white
   ───────────────────────────────────────────────────────── */
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={`flex items-center justify-between w-full max-w-5xl h-14 px-6 rounded-2xl transition-all duration-500 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl border border-gray-200/60 shadow-lg shadow-black/[0.03]"
            : "bg-transparent"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
          <img
            src={logoSrc}
            alt="HypeSpace event management software"
            className="h-8 object-contain opacity-90 group-hover:opacity-100 transition-opacity"
          />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", href: "/#features" },
            { label: "Pricing", href: "/#pricing" },
            { label: "About", href: "/about" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors duration-300 font-medium"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <button className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors hidden sm:block font-medium cursor-pointer">
              Log in
            </button>
          </Link>
          <Link href="/register">
            <button className="h-9 px-5 rounded-xl btn-gradient text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer">
              <span className="relative z-10">Start free</span>
            </button>
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────
   HERO SECTION — light, vibrant, brand colors
   ───────────────────────────────────────────────────────── */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
      {/* Warm gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <WarmOrb
          className="top-[-15%] left-[-5%] w-[600px] h-[600px] bg-orange-200/40"
          delay={0}
        />
        <WarmOrb
          className="bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-pink-200/30"
          delay={0.3}
        />
        <WarmOrb
          className="top-[20%] right-[5%] w-[350px] h-[350px] bg-fuchsia-200/20"
          delay={0.6}
        />
        <WarmOrb
          className="bottom-[10%] left-[10%] w-[300px] h-[300px] bg-violet-200/15"
          delay={0.9}
        />
      </div>

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-28 pb-20">
        {/* Badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-pink-200/60 bg-gradient-to-r from-orange-50 to-pink-50 mb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-pink-500" />
          </span>
          <span className="text-[12px] text-slate-600 font-medium">
            Built for small businesses
          </span>
        </motion.div>

        {/* H1 — Primary keyword targeted */}
        <motion.h1
          className="text-5xl sm:text-6xl md:text-[76px] lg:text-[86px] font-extrabold tracking-[-0.04em] leading-[0.95] text-[#1E1B4B] mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          Run events.
          <br />
          <span className="brand-gradient-text">
            Grow your business.
          </span>
        </motion.h1>

        {/* Subhead — SEO-rich, natural language */}
        <motion.p
          className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-12 leading-relaxed font-normal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          HypeSpace is the event management platform that helps small businesses
          create events, run marketing campaigns, and track RSVPs — without the
          complexity or the cost of enterprise tools.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Link href="/register">
            <button className="group h-13 px-8 rounded-2xl btn-gradient text-[15px] font-semibold flex items-center gap-2 cursor-pointer">
              <span className="relative z-10 flex items-center gap-2">
                Start for free
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          </Link>
          <button className="group h-13 px-8 rounded-2xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 font-medium text-[15px] flex items-center gap-2 hover:bg-slate-50 transition-all duration-300 cursor-pointer">
            <Play className="h-4 w-4 fill-slate-400 group-hover:fill-slate-600" />
            See how it works
          </button>
        </motion.div>

        {/* Social proof */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex -space-x-2">
            {["#F97316", "#EC4899", "#C026D3", "#8B5CF6"].map((bg, i) => (
              <div
                key={i}
                className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-semibold text-white shadow-sm"
                style={{ backgroundColor: bg, zIndex: 4 - i }}
              >
                {["JD", "KM", "AL", "RS"][i]}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 text-[13px] text-slate-400">
            <span>
              Used by{" "}
              <span className="text-slate-700 font-semibold">2,500+</span>{" "}
              small businesses
            </span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <div className="hidden sm:flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                />
              ))}
              <span className="ml-0.5 text-slate-500 font-medium">4.9/5</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#FAFAFA] to-transparent" />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   FEATURES — what HypeSpace does for small businesses
   ───────────────────────────────────────────────────────── */
const features = [
  {
    icon: CalendarDays,
    title: "Event Scheduling",
    desc: "Create and publish professional event pages in minutes. Set dates, locations, ticket types, and custom branding — no design skills needed.",
    gradient: "from-orange-500 to-orange-600",
    bgLight: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  {
    icon: Users,
    title: "Guest List Management",
    desc: "Track RSVPs, manage check-ins, and organize VIP tiers. One dashboard for every guest across all your events.",
    gradient: "from-pink-500 to-pink-600",
    bgLight: "bg-pink-50",
    iconColor: "text-pink-500",
  },
  {
    icon: Megaphone,
    title: "Campaign Builder",
    desc: "Build email and social media campaigns that drive registrations. Use templates or let AI generate copy that converts.",
    gradient: "from-fuchsia-500 to-fuchsia-600",
    bgLight: "bg-fuchsia-50",
    iconColor: "text-fuchsia-500",
  },
  {
    icon: Share2,
    title: "Referral & Sharing Tools",
    desc: "Give every attendee a unique referral link. Track who's sharing and reward your top promoters automatically.",
    gradient: "from-violet-500 to-violet-600",
    bgLight: "bg-violet-50",
    iconColor: "text-violet-500",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    desc: "See RSVPs, page views, click-through rates, and campaign performance as they happen. Know what's working instantly.",
    gradient: "from-amber-500 to-amber-600",
    bgLight: "bg-amber-50",
    iconColor: "text-amber-500",
  },
  {
    icon: Layers,
    title: "CRM Integrations",
    desc: "Sync your event data with HubSpot, Salesforce, or Notion in one click. Keep your contacts and your events connected.",
    gradient: "from-rose-500 to-rose-600",
    bgLight: "bg-rose-50",
    iconColor: "text-rose-500",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-28 bg-[#FAFAFA] relative">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[#1E1B4B] mb-5">
            Everything your business needs
            <br />
            <span className="text-slate-400">to run better events.</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            One platform for event scheduling, guest management, and marketing
            campaigns — designed for teams of 1 to 50.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="group relative p-7 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-pink-500/[0.04] transition-all duration-500 cursor-pointer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="relative z-10">
                <div
                  className={`h-11 w-11 rounded-xl ${f.bgLight} flex items-center justify-center ${f.iconColor} mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-[17px] font-semibold text-[#1E1B4B] mb-2 tracking-tight">
                  {f.title}
                </h3>
                <p className="text-[14px] text-slate-500 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   STATS BAND
   ───────────────────────────────────────────────────────── */
function StatsBand() {
  const stats = [
    { value: "2,500+", label: "Small businesses" },
    { value: "45K+", label: "Events created" },
    { value: "1.2M+", label: "Guests managed" },
    { value: "99.9%", label: "Uptime" },
  ];

  return (
    <section className="py-20 bg-white relative">
      <div className="section-divider absolute top-0 left-0 right-0" />
      <div className="section-divider absolute bottom-0 left-0 right-0" />
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              className="text-center"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="text-3xl md:text-4xl font-bold brand-gradient-text tracking-tight mb-1">
                {stat.value}
              </div>
              <div className="text-[13px] text-slate-400 font-medium">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   HOW IT WORKS — 3 steps for small business owners
   ───────────────────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: CalendarDays,
      title: "Create your event",
      desc: "Pick a template or start from scratch. Add your details, set your schedule, and customize your event page.",
      color: "text-orange-500",
      bg: "bg-orange-50",
      border: "border-orange-200",
    },
    {
      num: "02",
      icon: Megaphone,
      title: "Promote it",
      desc: "Launch email campaigns, share on social media, and activate referral links to fill every seat.",
      color: "text-pink-500",
      bg: "bg-pink-50",
      border: "border-pink-200",
    },
    {
      num: "03",
      icon: BarChart3,
      title: "Track results",
      desc: "Monitor RSVPs, check-ins, and campaign performance in real time. Follow up automatically.",
      color: "text-fuchsia-500",
      bg: "bg-fuchsia-50",
      border: "border-fuchsia-200",
    },
  ];

  return (
    <section id="how-it-works" className="py-28 bg-[#FAFAFA]">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[#1E1B4B] mb-5">
            Up and running
            <br />
            <span className="text-slate-400">in three steps.</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-lg mx-auto">
            No onboarding calls. No training sessions. Just create, promote, and
            grow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px bg-gradient-to-r from-orange-200 via-pink-200 to-fuchsia-200" />

          {steps.map((step, i) => (
            <motion.div
              key={i}
              className="relative text-center p-8 rounded-2xl bg-white border border-gray-100 hover:shadow-lg hover:shadow-pink-500/[0.04] transition-all duration-500"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <div className="relative inline-flex mb-6">
                <div className={`h-14 w-14 rounded-2xl ${step.bg} border ${step.border} flex items-center justify-center ${step.color}`}>
                  <step.icon className="h-6 w-6" />
                </div>
                <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full brand-gradient flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                  {step.num}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[#1E1B4B] mb-2 tracking-tight">
                {step.title}
              </h3>
              <p className="text-[14px] text-slate-500 leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   USE CASES — who is HypeSpace for
   ───────────────────────────────────────────────────────── */
function UseCasesSection() {
  const useCases = [
    {
      title: "Workshops & Classes",
      desc: "Yoga studios, cooking classes, photography workshops — schedule recurring events and let students book in seconds.",
      icon: Sparkles,
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      title: "Networking Mixers",
      desc: "Real estate groups, startup meetups, chamber of commerce events — manage RSVPs and follow up automatically.",
      icon: Users,
      color: "text-pink-500",
      bg: "bg-pink-50",
    },
    {
      title: "Product Launches",
      desc: "Retail stores, restaurants, salons — build buzz with campaigns, track attendance, and measure ROI.",
      icon: Zap,
      color: "text-fuchsia-500",
      bg: "bg-fuchsia-50",
    },
    {
      title: "Community Events",
      desc: "Nonprofits, churches, neighborhood groups — free event pages, guest lists, and email reminders.",
      icon: Share2,
      color: "text-violet-500",
      bg: "bg-violet-50",
    },
  ];

  return (
    <section className="py-28 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[#1E1B4B] mb-5">
            Built for businesses
            <br />
            <span className="text-slate-400">like yours.</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-lg mx-auto">
            Whether you're hosting 10 people or 10,000 — HypeSpace scales with
            you.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5">
          {useCases.map((uc, i) => (
            <motion.div
              key={i}
              className="group p-7 rounded-2xl bg-[#FAFAFA] border border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-lg hover:shadow-pink-500/[0.04] transition-all duration-500 cursor-pointer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className={`h-11 w-11 rounded-xl ${uc.bg} flex items-center justify-center ${uc.color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <uc.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#1E1B4B] mb-2 tracking-tight">
                {uc.title}
              </h3>
              <p className="text-[14px] text-slate-500 leading-relaxed">
                {uc.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   COMPARISON TABLE
   ───────────────────────────────────────────────────────── */
function ComparisonSection() {
  const rows = [
    { feature: "Event creation", us: "Under 5 minutes", them: "1–2 hours" },
    { feature: "Campaign tools", us: "Built-in", them: "Separate platform" },
    { feature: "Guest management", us: "Included", them: "Manual spreadsheets" },
    { feature: "CRM integrations", us: "One-click", them: "Custom setup" },
    { feature: "Starting price", us: "Free", them: "$50–$300/mo" },
  ];

  return (
    <section className="py-28 bg-[#FAFAFA]">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[#1E1B4B] mb-5">
            How HypeSpace compares
            <br />
            <span className="text-slate-400">to doing it the hard way.</span>
          </h2>
        </motion.div>

        <motion.div
          className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="grid grid-cols-3 bg-[#FAFAFA] border-b border-gray-200">
            <div className="p-5 text-[12px] text-slate-400 uppercase tracking-widest font-semibold">
              Feature
            </div>
            <div className="p-5 text-[12px] uppercase tracking-widest font-semibold text-center brand-gradient-text">
              HypeSpace
            </div>
            <div className="p-5 text-[12px] text-slate-300 uppercase tracking-widest font-semibold text-center">
              DIY / Other tools
            </div>
          </div>

          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-3 border-b border-gray-100 last:border-0 hover:bg-pink-50/30 transition-colors"
            >
              <div className="p-5 text-[14px] text-slate-600 font-medium">
                {row.feature}
              </div>
              <div className="p-5 text-[14px] text-[#1E1B4B] font-semibold text-center">
                {row.us}
              </div>
              <div className="p-5 text-[14px] text-slate-300 text-center italic">
                {row.them}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   PRICING — honest, small-business friendly
   ───────────────────────────────────────────────────────── */
const plans = [
  {
    name: "Starter",
    price: "$0",
    desc: "For trying HypeSpace out",
    features: [
      "3 events per month",
      "Up to 100 guests",
      "Basic event pages",
      "Email notifications",
      "Community support",
    ],
  },
  {
    name: "Growth",
    price: "$29",
    period: "/mo",
    desc: "For active small businesses",
    popular: true,
    features: [
      "Unlimited events",
      "Up to 2,000 guests",
      "Campaign builder",
      "Referral tracking",
      "CRM integrations",
      "Priority support",
    ],
  },
  {
    name: "Business",
    price: "$79",
    period: "/mo",
    desc: "For scaling operations",
    features: [
      "Everything in Growth",
      "Unlimited guests",
      "Custom branding",
      "Advanced analytics",
      "API access",
      "Dedicated account manager",
    ],
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="py-28 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[#1E1B4B] mb-5">
            Pricing that works
            <br />
            <span className="text-slate-400">for small budgets.</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-lg mx-auto">
            Start free. Upgrade when you're ready. No contracts, cancel anytime.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              className={`relative p-7 rounded-2xl flex flex-col transition-all duration-300 ${
                plan.popular
                  ? "bg-white border-2 border-pink-300 shadow-xl shadow-pink-500/[0.08]"
                  : "bg-white border border-gray-200 hover:border-gray-300 hover:shadow-lg"
              }`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full btn-gradient text-[11px] font-semibold">
                  <span className="relative z-10">Most popular</span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#1E1B4B] mb-1">
                  {plan.name}
                </h3>
                <p className="text-[13px] text-slate-400">{plan.desc}</p>
              </div>

              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold text-[#1E1B4B] tracking-tight">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                )}
              </div>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((feature, j) => (
                  <li
                    key={j}
                    className="flex items-center gap-2.5 text-[14px] text-slate-600"
                  >
                    <CheckCircle2 className="h-4 w-4 text-pink-400 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link href="/register">
                <button
                  className={`w-full h-11 rounded-xl text-[14px] font-semibold transition-all cursor-pointer ${
                    plan.popular
                      ? "btn-gradient"
                      : "border border-gray-200 text-slate-700 hover:text-[#1E1B4B] hover:border-pink-200 hover:bg-pink-50/50"
                  }`}
                >
                  <span className="relative z-10">Get started</span>
                </button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   LEAD MAGNET CTA
   ───────────────────────────────────────────────────────── */
function LeadMagnetCTA() {
  const [email, setEmail] = useState("");

  return (
    <section className="py-28 bg-[#FAFAFA] relative overflow-hidden">
      {/* Decorative gradient blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-orange-200/30 via-pink-200/30 to-fuchsia-200/30 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        className="max-w-3xl mx-auto px-6 text-center relative z-10"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 className="text-4xl md:text-6xl font-bold tracking-[-0.03em] text-[#1E1B4B] mb-6 leading-tight">
          Your next event
          <br />
          <span className="brand-gradient-text">starts here.</span>
        </h2>
        <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto">
          Join 2,500+ small businesses using HypeSpace to plan events, run
          campaigns, and grow their communities.
        </p>

        <form
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-6"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourcompany.com"
            className="flex-1 h-13 px-5 rounded-xl bg-white border border-gray-200 text-[#1E1B4B] placeholder:text-slate-300 text-[15px] focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300 transition-all shadow-sm"
          />
          <button
            type="submit"
            className="h-13 px-7 rounded-xl btn-gradient text-[15px] font-semibold flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start free
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </button>
        </form>

        <p className="text-[12px] text-slate-400 flex items-center justify-center gap-1.5">
          <Shield className="h-3 w-3" />
          Free plan available · No credit card required
        </p>
      </motion.div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   FAQ — schema markup for search engines
   ───────────────────────────────────────────────────────── */
function FAQSection() {
  const faqs = [
    {
      q: "What is HypeSpace?",
      a: "HypeSpace is an event management platform built for small businesses. It lets you create event pages, manage guest lists, run marketing campaigns, and track RSVPs — all from one dashboard.",
    },
    {
      q: "How much does HypeSpace cost?",
      a: "HypeSpace offers a free Starter plan with up to 3 events per month and 100 guests. Paid plans start at $29/month for unlimited events and advanced features like campaign tools and CRM integrations.",
    },
    {
      q: "Do I need technical skills to use HypeSpace?",
      a: "Not at all. HypeSpace is designed for non-technical users. You can create events, build campaigns, and manage guests without any coding or design experience.",
    },
    {
      q: "Can HypeSpace integrate with my CRM?",
      a: "Yes. HypeSpace offers one-click integrations with popular CRMs like HubSpot, Salesforce, and Notion. Your guest data syncs automatically after each event.",
    },
    {
      q: "What types of events can I create?",
      a: "HypeSpace works for any type of event — workshops, networking mixers, product launches, community gatherings, webinars, and more. Both in-person and virtual events are supported.",
    },
  ];

  return (
    <section className="py-28 bg-white">
      <div className="section-divider mb-28" />
      <div className="max-w-3xl mx-auto px-6">
        <motion.h2
          className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[#1E1B4B] mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Frequently asked questions.
        </motion.h2>

        <div
          className="space-y-0 divide-y divide-gray-100"
          itemScope
          itemType="https://schema.org/FAQPage"
        >
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              className="py-8"
              itemProp="mainEntity"
              itemScope
              itemType="https://schema.org/Question"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <h3
                itemProp="name"
                className="text-lg font-semibold text-[#1E1B4B] mb-3 tracking-tight"
              >
                {faq.q}
              </h3>
              <div
                itemProp="acceptedAnswer"
                itemScope
                itemType="https://schema.org/Answer"
              >
                <p
                  itemProp="text"
                  className="text-[15px] text-slate-500 leading-relaxed"
                >
                  {faq.a}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   FOOTER
   ───────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="py-16 bg-[#1E1B4B]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img
                src={logoSrc}
                alt="HypeSpace"
                className="h-7 object-contain brightness-0 invert opacity-80"
              />
            </div>
            <p className="text-[13px] text-white/40 leading-relaxed max-w-xs">
              Event management software for small businesses that want to grow.
            </p>
          </div>

          {[
            {
              title: "Product",
              links: [
                { label: "Features", href: "/#features" },
                { label: "Pricing", href: "/#pricing" },
                { label: "Integrations", href: "#" },
                { label: "Changelog", href: "#" },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "About", href: "/about" },
                { label: "Careers", href: "/careers" },
                { label: "Blog", href: "#" },
                { label: "Contact", href: "#" },
              ],
            },
            {
              title: "Legal",
              links: [
                { label: "Privacy Policy", href: "#" },
                { label: "Terms of Service", href: "#" },
                { label: "Security", href: "#" },
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] text-white/30 uppercase tracking-[0.15em] font-semibold mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] text-white/50 hover:text-white/90 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-white/25">
            © 2026 HypeSpace. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-white/30 font-medium">
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────
   LANDING PAGE — final assembly
   ───────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-[#1E1B4B] overflow-hidden">
      <LandingNav />

      <main>
        <HeroSection />
        <FeaturesSection />
        <StatsBand />
        <HowItWorks />
        <UseCasesSection />
        <ComparisonSection />
        <PricingSection />
        <LeadMagnetCTA />
        <FAQSection />
      </main>

      <Footer />
    </div>
  );
}
