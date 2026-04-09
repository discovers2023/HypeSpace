import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Calendar, 
  Mail, 
  Share2, 
  Users, 
  Settings,
  LogOut,
  Menu
} from "lucide-react";
import logoSrc from "@assets/HS_logo_1775759732611.png";
import iconSrc from "@assets/hs_icon_1775759732610.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/campaigns", label: "Campaigns", icon: Mail },
  { href: "/social", label: "Social Posts", icon: Share2 },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  const NavLinks = () => (
    <div className="flex flex-col gap-2 w-full">
      {navItems.map((item) => {
        const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
        const Icon = item.icon;
        
        return (
          <Link key={item.href} href={item.href}>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors duration-200 ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src={iconSrc} alt="HypeSpace Icon" className="h-8 w-8 object-contain" />
          <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">HypeSpace</span>
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="p-6 h-full flex flex-col">
              <Link href="/dashboard" className="flex justify-center mb-8">
                <img src={logoSrc} alt="HypeSpace Logo" className="h-10 object-contain" />
              </Link>
              <div className="flex-1">
                <NavLinks />
              </div>
              <div className="pt-6 border-t mt-auto">
                <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive">
                  <LogOut className="h-5 w-5" />
                  Logout
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 border-r bg-card h-screen sticky top-0 p-6 z-40">
        <Link href="/dashboard" className="flex justify-center mb-10 cursor-pointer">
          <img src={logoSrc} alt="HypeSpace Logo" className="h-10 object-contain" />
        </Link>
        
        <div className="flex-1">
          <NavLinks />
        </div>
        
        <div className="pt-6 border-t mt-auto">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}
