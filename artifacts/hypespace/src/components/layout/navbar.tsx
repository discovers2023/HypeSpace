import { Link } from "wouter";
import logoSrc from "@assets/HS_logo_1775759732611.png";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 md:px-6 pointer-events-none">
      <div className="container max-w-7xl">
        <div className="glass-card flex items-center justify-between h-14 px-6 md:px-8 pointer-events-auto rounded-full border border-white/10 shadow-2xl backdrop-blur-2xl">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute -inset-2 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
              <img src={logoSrc} alt="HypeSpace Logo" className="h-7 md:h-8 object-contain relative transition-transform group-hover:scale-105" />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            <Link href="/about" className="text-[11px] uppercase tracking-[0.2em] font-black text-foreground/80 hover:text-primary transition-all relative group">
              About
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary transition-all group-hover:w-full" />
            </Link>
            <Link href="/careers" className="text-[11px] uppercase tracking-[0.2em] font-black text-foreground/80 hover:text-primary transition-all relative group">
              Careers
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary transition-all group-hover:w-full" />
            </Link>
            <a href="/#features" className="text-[11px] uppercase tracking-[0.2em] font-black text-foreground/80 hover:text-primary transition-all relative group">
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary transition-all group-hover:w-full" />
            </a>
            <a href="/#pricing" className="text-[11px] uppercase tracking-[0.2em] font-black text-foreground/80 hover:text-primary transition-all relative group">
              Pricing
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary transition-all group-hover:w-full" />
            </a>
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:flex text-[11px] uppercase tracking-[0.2em] text-foreground/70 hover:text-foreground hover:bg-foreground/5 font-black">
                Log in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-primary text-white hover:bg-primary/90 shadow-2xl shadow-primary/30 transition-all px-8 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em]">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
