import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
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
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/campaigns", label: "Campaigns", icon: Mail },
  { href: "/social", label: "Social Posts", icon: Share2 },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  const NavLinks = () => (
    <div className="flex flex-col gap-1 w-full">
      {navItems.map((item) => {
        const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link key={item.href} href={item.href}>
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
              isActive
                ? 'bg-primary/10 text-primary font-medium shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}>
              <Icon className="h-[18px] w-[18px]" />
              <span className="text-sm">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src={iconSrc} alt="HypeSpace Icon" className="h-8 w-8 object-contain" />
          <span className="font-bold text-xl gradient-text">HypeSpace</span>
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
              <div className="pt-4 border-t border-border/50 mt-auto">
                <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive text-sm">
                  <LogOut className="h-[18px] w-[18px]" />
                  Logout
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-60 border-r border-border/50 bg-card/50 backdrop-blur-sm h-screen sticky top-0 p-5 z-40">
        <Link href="/dashboard" className="flex justify-center mb-8 cursor-pointer">
          <img src={logoSrc} alt="HypeSpace Logo" className="h-9 object-contain" />
        </Link>

        <div className="flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Menu</p>
          <NavLinks />
        </div>

        <div className="pt-4 border-t border-border/50 mt-auto">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive transition-colors text-sm">
            <LogOut className="h-[18px] w-[18px]" />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}
