import { Link, useLocation } from "wouter";
import { LogOut, User, Menu, LayoutDashboard, Mail, MessageCircle, Target, Headphones, Flame } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRegistrationModal } from "@/hooks/use-registration-modal";
import { useStrategyOverlay } from "@/features/strategy-chat";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { CreditUpgradeDropdown } from "@/components/credit-upgrade-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigation = [
  { name: "Search", href: "/app", icon: "dashboard" },
  { name: "Outreach", href: "/outreach", icon: "mail" },
  { name: "Streak", href: "/streak", icon: "flame" },
  // { name: "Replies", href: "/replies", icon: "message" }
];

export function MainNav() {
  const [location] = useLocation();
  
  // Safe auth hook usage with error handling
  let user = null;
  let logoutMutation = null;
  let openRegistrationModal = null;
  let strategyOverlay = null;
  
  try {
    const auth = useAuth();
    user = auth.user;
    logoutMutation = auth.logoutMutation;
    
    // Registration modal for login functionality
    const { openModal } = useRegistrationModal();
    openRegistrationModal = openModal;
    
    // Strategy overlay for chat trigger
    strategyOverlay = useStrategyOverlay();
  } catch (error) {
    // MainNav is being rendered outside AuthProvider context
    // This is acceptable for public routes - just don't show user menu
  }

  return (
    <nav className="flex items-center justify-between border-b mb-2 px-4 py-1.5">
      <div className="flex items-center space-x-4">
        <Logo size="sm" className="mr-8" />
        {navigation.map((item) => {
          const isActive = item.href === location || 
            (item.href === "/" && location === "/");

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`${
                isActive
                  ? "text-primary font-semibold border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              } px-2 py-1.5 text-sm font-medium transition-colors`}
            >
              <div className="flex items-center">
                {item.icon === "dashboard" && <LayoutDashboard className="mr-1 h-4 w-4" />}
                {item.icon === "mail" && <Mail className="mr-1 h-4 w-4" />}
                {item.icon === "flame" && <Flame className="mr-1 h-4 w-4" />}
                {item.icon === "target" && <Target className="mr-1 h-4 w-4" />}
                {item.icon === "message" && <MessageCircle className="mr-1 h-4 w-4" />}
                <span className="md:inline hidden">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="flex items-center ml-auto gap-3">
        {user ? (
          <>
            <CreditUpgradeDropdown />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {logoutMutation && (
                  <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <Link href="/account">
                  <DropdownMenuItem>
                    <User className="h-4 w-4 mr-2" />
                    <span>Account</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/strategy">
                  <DropdownMenuItem>
                    <Target className="h-4 w-4 mr-2" />
                    <span>Strategy</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem
                  onClick={() => window.open('/contact', '_blank')}
                  className="cursor-pointer"
                >
                  <Headphones className="h-4 w-4 mr-2" />
                  <span>Contact</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          openRegistrationModal && (
            <Button 
              variant="outline" 
              onClick={openRegistrationModal}
              className="h-8 px-4 text-sm text-muted-foreground hover:text-foreground"
            >
              Login
            </Button>
          )
        )}
      </div>
    </nav>
  );
}