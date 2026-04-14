import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { ArrowRight, Sparkles, Zap, Shield, Heart, Code, Palette, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const roles = [
  {
    category: "Design",
    title: "Brand Interaction Designer",
    type: "Remote / London",
    desc: "Craft the visual language and high-fidelity interactions that define the HypeSpace experience."
  },
  {
    category: "Engineering",
    title: "Full-Stack Performance Engineer",
    type: "Remote / NY",
    desc: "Build the resilient, global infrastructure capable of handling millions of concurrent viral events."
  },
  {
    category: "Growth",
    title: "Status Strategy lead",
    type: "Remote / Global",
    desc: "Analyze the psychology of community growth and build features that manufacture authentic hype."
  }
];

export default function Careers() {
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden font-sans">
      <Navbar />

      <main className="flex-1">
        {/* Editorial Hero */}
        <section className="pt-40 pb-20 relative">
          <div className="absolute top-[20%] left-[10%] w-[400px] h-[400px] bg-accent/5 blur-[120px] rounded-full animate-pulse" />
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-premium text-primary text-[11px] font-black uppercase tracking-[0.25em] mb-10"
            >
              The Next Frontier
            </motion.div>
            <motion.h1
              className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-none mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Build the <br />
              <span className="shimmer-text italic font-serif font-normal">Future of Hype.</span>
            </motion.h1>
            <motion.p
              className="text-xl md:text-2xl text-muted-foreground/80 leading-relaxed font-light max-w-3xl mx-auto mb-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              We are looking for obsessed builders who believe that software can be art and that technology should serve human ambition.
            </motion.p>
          </div>
        </section>

        {/* Perks / Culture Section */}
        <section className="py-24 border-y border-border/40 relative">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
              {[
                { icon: Heart, label: "Radical Autonomy", desc: "We hire adults and trust them to lead their own vision." },
                { icon: Sparkles, label: "Aesthetic-First", desc: "We never compromise on design. Quality is our obsession." },
                { icon: Zap, label: "Infinite Velocity", desc: "Ship daily, learn hourly, and rotate between high-impact projects." },
                { icon: Shield, label: "Elite Stability", desc: "Backed by world-class infrastructure and long-term vision." }
              ].map((perk, i) => (
                <motion.div
                  key={i}
                  className="space-y-4"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary transition-all">
                    <perk.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold">{perk.label}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{perk.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Open Roles */}
        <section id="open-roles" className="py-32 bg-muted/20 relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="flex items-end justify-between mb-20 gap-8">
              <div className="max-w-xl">
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">Open positions.</h2>
                <p className="text-muted-foreground text-lg italic font-serif">Selection is rigorous. The mission is global.</p>
              </div>
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-background border border-border/50">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Searching 24 open roles...</span>
              </div>
            </div>

            <div className="space-y-4 max-w-5xl mx-auto">
              {roles.map((role, i) => (
                <motion.div
                  key={i}
                  className="glass-card p-10 flex flex-col md:flex-row items-center justify-between gap-10 group hover:border-primary/40 transition-all cursor-pointer"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="space-y-2 text-center md:text-left">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{role.category}</span>
                    <h3 className="text-3xl font-bold tracking-tight">{role.title}</h3>
                    <p className="text-muted-foreground max-w-lg">{role.desc}</p>
                  </div>
                  <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
                    <span className="text-sm font-bold opacity-60 italic font-serif">{role.type}</span>
                    <Button className="rounded-2xl h-12 px-8 bg-foreground text-background hover:bg-foreground/90 group transition-all">
                      Apply Now
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-20 text-center">
              <p className="text-muted-foreground mb-6">Don't see your role? Reach out anyway.</p>
              <Button variant="outline" className="h-12 px-8 rounded-2xl border-primary/20 hover:bg-primary/5">
                mission@hypespace.com
              </Button>
            </div>
          </div>
        </section>

        {/* Global CTA */}
        <section className="py-32 relative overflow-hidden bg-background">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[120px] rounded-full" />
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter">Become a <br /><span className="shimmer-text italic font-serif font-normal">Hype Engineer.</span></h2>
              <p className="text-muted-foreground text-xl mb-12 italic">Join the standard of global excellence.</p>
              <Button size="lg" className="h-16 px-12 bg-primary hover:bg-primary/95 text-white font-bold rounded-2xl shadow-2xl shadow-primary/20 text-lg">
                View all departments
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-border/40 text-center text-sm text-muted-foreground font-medium">
        © 2026 HypeSpace OS. All rights reserved.
      </footer>
    </div>
  );
}
