import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import logoSrc from "@assets/HS_logo_1775759732611.png";
import { 
  Calendar, 
  Mail, 
  Share2, 
  Zap, 
  BarChart, 
  Users, 
  CheckCircle2,
  ArrowRight
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Zap className="h-4 w-4" />
                <span>The new standard for event organizers</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
                Launch moments that <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">matter.</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                HypeSpace gives you backstage access to powerful event management. Dynamic, energized, and completely in your control.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all shadow-lg hover:shadow-primary/25 border-0">
                    Start your free trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8">
                    View demo
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to hype your space</h2>
              <p className="text-lg text-muted-foreground">From guest lists to AI-powered email campaigns, we've got you covered.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[
                { icon: Calendar, title: "Event Creation", desc: "Set up onsite, remote, or hybrid events in minutes with beautiful landing pages." },
                { icon: Users, title: "Guest Management", desc: "Track RSVPs, manage waitlists, and keep your VIPs happy with seamless lists." },
                { icon: Mail, title: "AI Campaigns", desc: "Generate high-converting email invitations and reminders tailored to your tone." },
                { icon: Share2, title: "Social Scheduling", desc: "Keep the hype going across Twitter, LinkedIn, and Instagram from one dashboard." },
                { icon: BarChart, title: "Real-time Analytics", desc: "Watch the RSVPs roll in and track engagement metrics as they happen." },
                { icon: Zap, title: "Automated Reminders", desc: "Never let a guest forget. Set up automated workflows to maximize attendance." }
              ].map((feature, i) => (
                <div key={i} className="bg-card p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
              <p className="text-lg text-muted-foreground">Choose the plan that fits your ambition.</p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {[
                { name: "Free", price: "$0", desc: "Perfect for exploring", features: ["1 Active Event", "Up to 50 Guests", "Basic Analytics"] },
                { name: "Starter", price: "$29", period: "/mo", desc: "For growing communities", features: ["5 Active Events", "Up to 500 Guests", "Email Campaigns", "Social Scheduling"] },
                { name: "Professional", price: "$79", period: "/mo", desc: "For serious organizers", popular: true, features: ["Unlimited Events", "Unlimited Guests", "AI Campaign Generator", "Advanced Analytics", "Team Members"] },
                { name: "Enterprise", price: "Custom", desc: "For large organizations", features: ["Custom Limits", "Dedicated Support", "Custom Integrations", "SLA"] }
              ].map((plan, i) => (
                <div key={i} className={`relative bg-card rounded-3xl border p-8 flex flex-col ${plan.popular ? 'shadow-xl shadow-primary/10 border-primary/50' : 'shadow-sm'}`}>
                  {plan.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-primary to-accent text-white text-xs font-bold rounded-full">
                      Most Popular
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.desc}</p>
                  </div>
                  <div className="mb-6 flex items-baseline">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground ml-1">{plan.period}</span>}
                  </div>
                  <ul className="mb-8 space-y-3 flex-1">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mr-3 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <Button className={`w-full ${plan.popular ? 'bg-gradient-to-r from-primary to-accent border-0 hover:opacity-90 text-white' : ''}`} variant={plan.popular ? 'default' : 'outline'}>
                      Get Started
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary to-background" />
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-foreground">Ready to create some hype?</h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join thousands of organizers who are launching unforgettable events with HypeSpace.
            </p>
            <Link href="/register">
              <Button size="lg" className="text-lg h-14 px-10 bg-gradient-to-r from-primary to-accent hover:opacity-90 border-0">
                Create your first event
              </Button>
            </Link>
          </div>
        </section>
      </main>
      
      <footer className="border-t py-12 bg-card">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <img src={logoSrc} alt="HypeSpace Logo" className="h-6 opacity-70 grayscale" />
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground">Terms</a>
              <a href="#" className="hover:text-foreground">Privacy</a>
              <a href="#" className="hover:text-foreground">Contact</a>
            </div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} HypeSpace. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
