import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { ArrowRight, Star, Shield, Users, Rocket, Globe, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const values = [
  {
    icon: Sparkles,
    title: "The Aesthetic Standard",
    desc: "We believe that software should be beautiful enough to inspire the work it hosts. Every pixel is an invitation to greatness."
  },
  {
    icon: Zap,
    title: "Viral Engineering",
    desc: "We don't leave connection to chance. Our tools are designed based on the psychological triggers of community and status."
  },
  {
    icon: Shield,
    title: "Elite Infrastructure",
    desc: "Luxury is reliability. Our stack is hardened for the world's most critical event launches and community movements."
  }
];

const team = [
  { name: "Julian Thorne", role: "Design Visionary", initials: "JT" },
  { name: "Elena Vance", role: "Engineering Lead", initials: "EV" },
  { name: "Marcus Gray", role: "Growth Architect", initials: "MG" }
];

export default function About() {
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      <Navbar />

      <main className="flex-1">
        {/* Editorial Hero */}
        <section className="pt-40 pb-20 relative">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-[0.2em] mb-8"
              >
                Our Manifesto
              </motion.div>
              <motion.h1 
                className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Hype is the <br /> 
                <span className="italic font-serif font-normal shimmer-text">New Currency.</span>
              </motion.h1>
              <motion.p 
                className="text-2xl md:text-3xl text-muted-foreground/80 leading-relaxed font-light max-w-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                In a world of infinite distraction, the ability to manufacture attention and foster deep connection is the ultimate superpower. 
              </motion.p>
            </div>
          </div>
        </section>

        {/* Narrative Section */}
        <section className="py-24 border-t border-border/40 relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <img 
                  src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop" 
                  alt="Future of technology" 
                  className="rounded-[3rem] shadow-2xl grayscale hover:grayscale-0 transition-all duration-700"
                />
              </motion.div>
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-8 tracking-tight">The Origin of HypeSpace</h2>
                <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                  <p>
                    HypeSpace was born from a simple realization: the tools we use to organize our most important moments were fundamentally broken. They were cold, generic, and uninspiring.
                  </p>
                  <p>
                    We set out to build an OS that doesn't just manage events, but maximizes the emotional impact of every interaction. From the first invitation to the final post-event notification, HypeSpace is designed to create a sense of belonging and status.
                  </p>
                  <p className="font-bold text-foreground">
                    Today, we power the launches of the world's most innovative companies and the gatherings of high-intent communities.
                  </p>
                </div>
              </div>
            </div>

            {/* AI SEO Technical Framework Section */}
            <div className="mt-32 pt-24 border-t border-border/40">
              <div className="grid md:grid-cols-3 gap-12">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-6">AI Architecture</h3>
                  <ul className="space-y-4 text-muted-foreground font-medium">
                    <li>• Context-Aware Event Scaffolding</li>
                    <li>• AI-Driven Narrative Generation</li>
                    <li>• Automated Guest Behavioral Analysis</li>
                    <li>• Strategic Viral Loop Engineering</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-6">Ecosystem Sync</h3>
                  <ul className="space-y-4 text-muted-foreground font-medium">
                    <li>• Native HubSpot & Salesforce Integration</li>
                    <li>• Bidirectional CRM Data Flow</li>
                    <li>• Zero-Code Marketing Automation</li>
                    <li>• Enterprise Security & Compliance</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-6">Performance Core</h3>
                  <ul className="space-y-4 text-muted-foreground font-medium">
                    <li>• 90-Second Event Launch Speed</li>
                    <li>• 40% Increase in Organic Attendance</li>
                    <li>• Real-Time ROI Tracking</li>
                    <li>• Millisecond Analytics Precision</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="py-24 bg-muted/20 relative">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 italic font-serif">The Standard.</h2>
              <p className="text-muted-foreground text-lg">The principles that guide every pixel we craft and every line of code we ship.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {values.map((v, i) => (
                <motion.div
                  key={i}
                  className="glass-card p-12 text-center group hover:scale-[1.02] transition-transform"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="h-20 w-20 rounded-3xl bg-primary/5 flex items-center justify-center text-primary mx-auto mb-8 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-xl shadow-primary/5">
                    <v.icon className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{v.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Modern Team Grid */}
        <section className="py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 underline-decoration">Crafted by Collectors.</h2>
                <p className="text-muted-foreground text-lg">We are a small, elite team of designers and engineers obsessed with the intersection of human psychology and high-fidelity technology.</p>
              </div>
              <Link href="/careers">
                <Button variant="outline" size="lg" className="rounded-2xl h-14 px-8 group border-primary/20 hover:bg-primary/5">
                  Join the Mission
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {team.map((member, i) => (
                <motion.div
                  key={i}
                  className="relative aspect-square rounded-[3rem] overflow-hidden group cursor-pointer"
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="absolute inset-0 bg-muted flex items-center justify-center text-7xl font-black text-white/20 select-none group-hover:scale-110 transition-transform duration-700">
                    {member.initials}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute bottom-10 left-10 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <p className="text-white font-bold text-2xl">{member.name}</p>
                    <p className="text-white/60 text-sm font-medium tracking-widest uppercase">{member.role}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 noise-overlay opacity-20" />
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-12">Ready to raise the <br /><span className="italic font-serif font-normal">Standard?</span></h2>
            <Link href="/register">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 h-16 px-12 rounded-2xl text-lg font-bold shadow-2xl">
                Get Started for Free
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-border/40 text-center text-sm text-muted-foreground font-medium">
        © 2026 HypeSpace OS. All rights reserved.
      </footer>
    </div>
  );
}
