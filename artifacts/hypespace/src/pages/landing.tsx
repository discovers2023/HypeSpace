import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import logoSrc from "@assets/HS_logo_1775759732611.png";
import { motion, useTransform, useMotionValue, useSpring, type MotionValue } from "framer-motion";
import {
  Calendar,
  Mail,
  Share2,
  Zap,
  BarChart,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Globe,
  Shield,
  Bell,
  Star,
  Heart,
  Ticket,
  TrendingUp,
  Play,
  CircleDot,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// 3D Parallax Card — follows mouse cursor
// ═══════════════════════════════════════════════════════════════════
function use3DParallax(mouseX: MotionValue<number>, mouseY: MotionValue<number>, strength = 1) {
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12 * strength, -12 * strength]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12 * strength, 12 * strength]), {
    stiffness: 150,
    damping: 20,
  });
  return { rotateX, rotateY };
}

// ═══════════════════════════════════════════════════════════════════
// Animated background particles
// ═══════════════════════════════════════════════════════════════════
function Particles() {
  const particles = Array.from({ length: 14 });
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((_, i) => {
        const size = 3 + Math.random() * 5;
        const left = Math.random() * 100;
        const duration = 15 + Math.random() * 20;
        const delay = Math.random() * 20;
        const color = i % 3 === 0 ? "bg-accent/40" : i % 3 === 1 ? "bg-primary/40" : "bg-secondary/60";
        return (
          <div
            key={i}
            className={`absolute rounded-full ${color} blur-[1px]`}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${left}%`,
              bottom: `-10px`,
              animation: `particle-float ${duration}s linear ${delay}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 3D Floating Card — uses mouse parallax + float animation
// ═══════════════════════════════════════════════════════════════════
function Floating3DCard({
  children,
  mouseX,
  mouseY,
  depth = 0,
  className = "",
  initialDelay = 0,
  floatClass = "animate-float-slow",
}: {
  children: React.ReactNode;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  depth?: number;
  className?: string;
  initialDelay?: number;
  floatClass?: string;
}) {
  // translate based on depth (closer = more movement)
  const x = useSpring(useTransform(mouseX, [-0.5, 0.5], [-depth * 20, depth * 20]), { stiffness: 120, damping: 25 });
  const y = useSpring(useTransform(mouseY, [-0.5, 0.5], [-depth * 20, depth * 20]), { stiffness: 120, damping: 25 });

  return (
    <motion.div
      className={`absolute ${className}`}
      style={{ x, y, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, scale: 0.7, rotateX: -15 }}
      animate={{ opacity: 1, scale: 1, rotateX: 0 }}
      transition={{ delay: initialDelay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={floatClass}>{children}</div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Mini stat card
// ═══════════════════════════════════════════════════════════════════
function MiniStatCard({
  icon: Icon,
  label,
  value,
  colorClass,
  trend,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  colorClass: string;
  trend?: string;
}) {
  return (
    <div className="glass-card px-5 py-4 min-w-[180px]">
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground font-medium">{label}</div>
          <div className="text-xl font-bold leading-tight mt-0.5">{value}</div>
          {trend && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold mt-1">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Live notification pill
// ═══════════════════════════════════════════════════════════════════
function LiveNotification({
  name,
  action,
  colorClass,
}: {
  name: string;
  action: string;
  colorClass: string;
}) {
  return (
    <div className="glass-card px-4 py-2.5 flex items-center gap-3 min-w-[220px]">
      <div className={`h-8 w-8 rounded-full ${colorClass} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
        {name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{action}</p>
      </div>
      <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Dashboard Mockup (the hero center piece)
// ═══════════════════════════════════════════════════════════════════
function DashboardMockup({ mouseX, mouseY }: { mouseX: MotionValue<number>; mouseY: MotionValue<number> }) {
  const { rotateX, rotateY } = use3DParallax(mouseX, mouseY, 0.8);

  const events = [
    { date: "APR 20", name: "Tech Summit 2026", guests: 342, conf: 89, color: "from-primary to-purple-500" },
    { date: "APR 28", name: "Design Workshop", guests: 86, conf: 74, color: "from-accent to-orange-400" },
    { date: "MAY 05", name: "Startup Mixer", guests: 215, conf: 62, color: "from-pink-500 to-rose-400" },
  ];

  return (
    <motion.div
      className="glass-card p-6 w-[400px] shadow-2xl"
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, scale: 0.9, rotateX: 15 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/30">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold">Event Pulse</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CircleDot className="h-2 w-2 text-emerald-500 fill-emerald-500 animate-pulse" />
              Live · Last 24h
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <div className="h-6 w-6 rounded-md bg-muted/50" />
          <div className="h-6 w-6 rounded-md bg-muted/50" />
        </div>
      </div>

      {/* Mini chart area */}
      <div className="mb-5">
        <div className="flex items-end justify-between gap-1 h-16 mb-2">
          {[40, 55, 45, 65, 58, 78, 68, 88, 75, 92, 82, 95].map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary/10"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.6 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: `${h}%`, originY: 1 }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold gradient-text">2,847</p>
            <p className="text-[10px] text-muted-foreground">RSVPs this week</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +48%
            </p>
            <p className="text-[10px] text-muted-foreground">vs last week</p>
          </div>
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Upcoming</p>
        {events.map((event, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-white/50 border border-white/30"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 + i * 0.1 }}
          >
            <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${event.color} flex flex-col items-center justify-center text-white shrink-0 shadow-md`}>
              <span className="text-[8px] font-bold leading-none">{event.date.split(" ")[0]}</span>
              <span className="text-sm font-bold leading-none">{event.date.split(" ")[1]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{event.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${event.conf}%` }}
                    transition={{ delay: 1.2 + i * 0.1, duration: 0.8 }}
                  />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{event.conf}%</span>
              </div>
            </div>
            <div className="flex -space-x-1.5 shrink-0">
              {[0, 1, 2].map((j) => (
                <div
                  key={j}
                  className="h-5 w-5 rounded-full border-2 border-white bg-gradient-to-br from-primary/60 to-accent/60"
                  style={{ zIndex: 3 - j }}
                />
              ))}
              <div className="h-5 px-1.5 rounded-full border-2 border-white bg-muted flex items-center justify-center text-[8px] font-semibold">
                +{event.guests - 3}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HERO SECTION
// ═══════════════════════════════════════════════════════════════════
function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [mouseX, mouseY]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[92vh] flex items-center overflow-hidden mesh-bg noise-overlay"
      style={{ perspective: "1500px" }}
    >
      {/* Animated blobs */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full bg-primary/20 blur-[100px] pointer-events-none"
        style={{ top: "-10%", right: "-10%" }}
        animate={{ scale: [1, 1.15, 1], x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-accent/15 blur-[100px] pointer-events-none"
        style={{ bottom: "-10%", left: "-10%" }}
        animate={{ scale: [1, 1.2, 1], x: [0, -30, 0], y: [0, 20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-secondary/25 blur-[80px] pointer-events-none"
        style={{ top: "40%", left: "40%" }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* Floating particles */}
      <Particles />

      {/* Rotating decoration ring */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] pointer-events-none opacity-[0.06]"
        style={{ animation: "rotate-slow 80s linear infinite" }}
      >
        <svg viewBox="0 0 900 900" className="w-full h-full">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(263, 84%, 58%)" />
              <stop offset="100%" stopColor="hsl(21, 90%, 48%)" />
            </linearGradient>
          </defs>
          <circle cx="450" cy="450" r="445" fill="none" stroke="url(#ringGrad)" strokeWidth="1" strokeDasharray="2 8" />
          <circle cx="450" cy="450" r="380" fill="none" stroke="url(#ringGrad)" strokeWidth="1" strokeDasharray="4 12" />
          <circle cx="450" cy="450" r="300" fill="none" stroke="url(#ringGrad)" strokeWidth="1" strokeDasharray="1 6" />
        </svg>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 md:px-6 relative z-10 py-12">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-center">
          {/* LEFT: Copy */}
          <div className="relative z-20">
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-premium text-primary text-xs font-semibold mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span>Now with AI campaigns · Launch in 90 seconds</span>
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.02] mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
            >
              Launch moments
              <br />
              that <span className="shimmer-text">matter.</span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-muted-foreground/90 max-w-lg leading-relaxed mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              The luxurious event OS for organizers who obsess over the details. Beautiful landing pages, AI campaigns, and live analytics — in one fluid workspace.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-start gap-3 mb-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Link href="/register">
                <Button size="lg" className="text-base h-14 px-8 bg-primary hover:bg-primary/90 shadow-[0_10px_40px_-8px_rgba(124,58,237,0.5)] border-0 group relative overflow-hidden">
                  <span className="relative z-10 flex items-center">
                    Start free
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] opacity-0 group-hover:opacity-100 group-hover:animate-[shimmer_2s_linear_infinite] transition-opacity" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-base h-14 px-7 border-primary/20 hover:bg-primary/5 group">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-2 group-hover:bg-primary group-hover:text-white transition-colors">
                  <Play className="h-3.5 w-3.5 fill-current" />
                </div>
                Watch demo
              </Button>
            </motion.div>

            {/* Mini social proof */}
            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex -space-x-2">
                {[
                  "from-primary to-purple-500",
                  "from-accent to-orange-400",
                  "from-emerald-500 to-teal-400",
                  "from-pink-500 to-rose-400",
                ].map((bg, i) => (
                  <div key={i} className={`h-9 w-9 rounded-full border-2 border-white bg-gradient-to-br ${bg} flex items-center justify-center text-white text-[10px] font-bold shadow-md`}>
                    {["SJ", "MK", "AR", "LP"][i]}
                  </div>
                ))}
                <div className="h-9 w-9 rounded-full border-2 border-white bg-white text-primary flex items-center justify-center text-[10px] font-bold shadow-md">
                  +9K
                </div>
              </div>
              <div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-xs font-bold ml-1">4.9</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Trusted by 10,000+ organizers</p>
              </div>
            </motion.div>
          </div>

          {/* RIGHT: 3D Visual composition */}
          <div className="relative h-[520px] md:h-[600px] preserve-3d">
            {/* Center main card */}
            <div className="absolute top-[8%] left-[8%]" style={{ transform: "translateZ(0)" }}>
              <DashboardMockup mouseX={mouseX} mouseY={mouseY} />
            </div>

            {/* Top-right stat: RSVPs */}
            <Floating3DCard
              mouseX={mouseX}
              mouseY={mouseY}
              depth={1.8}
              className="top-[0%] right-[0%] z-30"
              initialDelay={0.6}
              floatClass="animate-float-fast"
            >
              <MiniStatCard
                icon={Users}
                label="Total RSVPs"
                value="2,847"
                colorClass="bg-primary/10 text-primary"
                trend="+48%"
              />
            </Floating3DCard>

            {/* Mid-right: Live notification */}
            <Floating3DCard
              mouseX={mouseX}
              mouseY={mouseY}
              depth={2.2}
              className="top-[40%] right-[-6%] z-40"
              initialDelay={0.9}
              floatClass="animate-float-medium"
            >
              <LiveNotification
                name="Sarah Jenkins"
                action="just confirmed · TechSummit"
                colorClass="bg-gradient-to-br from-primary to-purple-500"
              />
            </Floating3DCard>

            {/* Bottom-right: Ticket sold */}
            <Floating3DCard
              mouseX={mouseX}
              mouseY={mouseY}
              depth={1.5}
              className="bottom-[6%] right-[5%] z-30"
              initialDelay={1.1}
              floatClass="animate-float-slow"
            >
              <div className="glass-card px-4 py-3 flex items-center gap-3 min-w-[200px]">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent to-orange-400 flex items-center justify-center shadow-md shadow-accent/30">
                  <Ticket className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold">VIP Pass Sold</p>
                  <p className="text-[10px] text-muted-foreground">2 seconds ago · $299</p>
                </div>
              </div>
            </Floating3DCard>

            {/* Bottom-left: Engagement stat */}
            <Floating3DCard
              mouseX={mouseX}
              mouseY={mouseY}
              depth={1.3}
              className="bottom-[12%] left-[-4%] z-30"
              initialDelay={1.3}
              floatClass="animate-float-medium"
            >
              <MiniStatCard
                icon={Heart}
                label="Engagement"
                value="94.2%"
                colorClass="bg-accent/10 text-accent"
                trend="+12%"
              />
            </Floating3DCard>

            {/* Floating mail icon */}
            <Floating3DCard
              mouseX={mouseX}
              mouseY={mouseY}
              depth={2.5}
              className="top-[30%] left-[-8%] z-20"
              initialDelay={1.5}
              floatClass="animate-float-fast"
            >
              <div className="h-14 w-14 rounded-2xl glass-card flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
            </Floating3DCard>

            {/* Floating bell icon */}
            <Floating3DCard
              mouseX={mouseX}
              mouseY={mouseY}
              depth={2.8}
              className="top-[68%] right-[30%] z-20"
              initialDelay={1.7}
              floatClass="animate-float-slow"
            >
              <div className="h-12 w-12 rounded-2xl glass-card flex items-center justify-center">
                <Bell className="h-5 w-5 text-accent" />
              </div>
            </Floating3DCard>

            {/* Floating sparkle decoration */}
            <Floating3DCard
              mouseX={mouseX}
              mouseY={mouseY}
              depth={3}
              className="top-[4%] left-[35%] z-10"
              initialDelay={1.9}
              floatClass="animate-float-medium"
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl shadow-primary/40">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            </Floating3DCard>
          </div>
        </div>

        {/* Trust strip below hero - tight spacing */}
        <motion.div
          className="mt-16 pt-8 border-t border-border/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-6">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-50">
            {["TechCorp", "Stripe", "Notion", "Linear", "Figma", "Vercel"].map((brand) => (
              <span key={brand} className="text-xl font-bold tracking-tight text-muted-foreground">
                {brand}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FEATURES with 3D tilt on hover
// ═══════════════════════════════════════════════════════════════════
function FeatureCard({
  feature,
  index,
}: {
  feature: { icon: typeof Calendar; title: string; desc: string; gradient: string };
  index: number;
}) {
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -12;
    setRot({ x: y, y: x });
  };

  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      className="group relative p-7 rounded-2xl glass-card cursor-default"
      onMouseMove={handleMove}
      onMouseLeave={() => setRot({ x: 0, y: 0 })}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: index * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        transform: `perspective(1000px) rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
        transformStyle: "preserve-3d",
        transition: "transform 0.15s ease-out",
      }}
    >
      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-5 shadow-lg`} style={{ transform: "translateZ(30px)" }}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ transform: "translateZ(20px)" }}>{feature.title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed" style={{ transform: "translateZ(10px)" }}>{feature.desc}</p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════
const features = [
  { icon: Calendar, title: "Event Creation", desc: "Set up onsite, remote, or hybrid events in minutes with beautiful landing pages.", gradient: "from-primary to-purple-500" },
  { icon: Users, title: "Guest Management", desc: "Track RSVPs, manage waitlists, and keep your VIPs happy with seamless lists.", gradient: "from-accent to-orange-400" },
  { icon: Mail, title: "AI Campaigns", desc: "Generate high-converting email invitations and reminders tailored to your tone.", gradient: "from-pink-500 to-rose-400" },
  { icon: Share2, title: "Social Scheduling", desc: "Keep the hype going across Twitter, LinkedIn, and Instagram from one dashboard.", gradient: "from-blue-500 to-cyan-400" },
  { icon: BarChart, title: "Real-time Analytics", desc: "Watch the RSVPs roll in and track engagement metrics as they happen.", gradient: "from-emerald-500 to-teal-400" },
  { icon: Zap, title: "Automated Reminders", desc: "Never let a guest forget. Set up automated workflows to maximize attendance.", gradient: "from-amber-500 to-orange-400" }
];

const stats = [
  { value: "10K+", label: "Events launched" },
  { value: "2M+", label: "Guests managed" },
  { value: "98%", label: "Uptime SLA" },
  { value: "4.9/5", label: "Customer rating" },
];

const plans = [
  { name: "Free", price: "$0", desc: "Perfect for exploring", features: ["1 Active Event", "Up to 50 Guests", "Basic Analytics"] },
  { name: "Starter", price: "$29", period: "/mo", desc: "For growing communities", features: ["5 Active Events", "Up to 500 Guests", "Email Campaigns", "Social Scheduling"] },
  { name: "Professional", price: "$79", period: "/mo", desc: "For serious organizers", popular: true, features: ["Unlimited Events", "Unlimited Guests", "AI Campaign Generator", "Advanced Analytics", "Team Members"] },
  { name: "Enterprise", price: "Custom", desc: "For large organizations", features: ["Custom Limits", "Dedicated Support", "Custom Integrations", "SLA"] }
];

// ═══════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════
export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      <Navbar />

      <main className="flex-1">
        <HeroSection />

        {/* Stats Band */}
        <section className="py-12 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/40 to-transparent" />
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  className="glass-card py-6 px-4 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="text-3xl md:text-4xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 relative">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              className="text-center max-w-2xl mx-auto mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
                <Sparkles className="h-3 w-3" />
                Features
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                Everything you need to<br />
                <span className="gradient-text">hype your space</span>
              </h2>
              <p className="text-muted-foreground">From guest lists to AI campaigns — one gorgeous workspace.</p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto preserve-3d">
              {features.map((feature, i) => (
                <FeatureCard key={i} feature={feature} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 mesh-bg opacity-60 pointer-events-none" />
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              className="text-center max-w-2xl mx-auto mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold uppercase tracking-wider mb-4">
                How it works
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Three steps to unforgettable events</h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto relative">
              {/* Connection line */}
              <div className="hidden md:block absolute top-16 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

              {[
                { step: "01", icon: Calendar, title: "Create your event", desc: "Choose your format, set the details, and customize your public RSVP page." },
                { step: "02", icon: Mail, title: "Invite & promote", desc: "Use AI campaigns, social scheduling, and shareable links to fill seats." },
                { step: "03", icon: BarChart, title: "Track & engage", desc: "Monitor RSVPs in real time, send reminders, and measure your success." },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="relative glass-card p-6 text-center"
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                >
                  <div className="relative inline-flex">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-primary/30">
                      <item.icon className="h-7 w-7" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shadow">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div
              className="text-center max-w-2xl mx-auto mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
                Pricing
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">Simple, transparent pricing</h2>
              <p className="text-muted-foreground">Choose the plan that fits your ambition.</p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
              {plans.map((plan, i) => (
                <motion.div
                  key={i}
                  className={`relative glass-card p-6 flex flex-col ${plan.popular ? 'ring-2 ring-primary/40 scale-[1.03]' : ''}`}
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-0.5 bg-gradient-to-r from-primary to-accent text-white text-[10px] font-bold rounded-full shadow-lg shadow-primary/30 uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.desc}</p>
                  </div>
                  <div className="mb-5 flex items-baseline">
                    <span className={`text-4xl font-bold ${plan.popular ? "gradient-text" : ""}`}>{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground ml-1 text-sm">{plan.period}</span>}
                  </div>
                  <ul className="mb-6 space-y-2.5 flex-1">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center text-sm">
                        <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center mr-2.5 shrink-0">
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <Button className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20' : ''}`} variant={plan.popular ? 'default' : 'outline'}>
                      Get Started
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust Strip */}
        <section className="py-14">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {[
                { icon: Shield, title: "SOC 2 Compliant", desc: "Enterprise-grade security" },
                { icon: Globe, title: "Global CDN", desc: "Fast everywhere" },
                { icon: Zap, title: "99.9% Uptime", desc: "Always reliable" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="glass-card flex items-center gap-4 p-5"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-primary shrink-0">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{item.title}</h4>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 mesh-bg" />
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full bg-primary/20 blur-[100px] top-0 right-1/4"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full bg-accent/20 blur-[100px] bottom-0 left-1/4"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          />
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              className="glass-card max-w-4xl mx-auto text-center py-14 px-8 md:px-12"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold uppercase tracking-wider mb-5">
                <Sparkles className="h-3 w-3" />
                Ready when you are
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                Ready to create <span className="gradient-text">some hype?</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Join 10,000+ organizers launching unforgettable events with HypeSpace.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/register">
                  <Button size="lg" className="text-base h-14 px-8 bg-primary hover:bg-primary/90 shadow-[0_10px_40px_-8px_rgba(124,58,237,0.5)] border-0 group">
                    Start your free trial
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="text-base h-14 px-7 border-primary/20 hover:bg-primary/5">
                    Book a demo
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-10 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src={logoSrc} alt="HypeSpace Logo" className="h-6 opacity-70" />
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
            <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} HypeSpace. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
