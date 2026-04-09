import { Link } from "wouter";
import logoSrc from "@assets/HS_logo_1775759732611.png";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img src={logoSrc} alt="HypeSpace Logo" className="h-8 object-contain" />
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How it works</a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
        </nav>
        
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="hidden sm:flex">Log in</Button>
          </Link>
          <Link href="/register">
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity border-0">Get Started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
