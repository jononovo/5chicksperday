import { Link, useLocation } from "wouter";
import { LogOut, User, Menu, LayoutDashboard, ListTodo, Mail, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
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
  { name: "Replies", href: "/replies", icon: "message" }
];

export function MainNav() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isMobile = useIsMobile();

  return (
    <nav className="flex items-center justify-between border-b mb-4 px-4 py-3">
      <div className="flex items-center">
        <Logo size="sm" className="mr-4 md:mr-8" />
        <div className={`flex ${isMobile ? "justify-center space-x-6" : "space-x-4"}`}>
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
                } ${isMobile ? "px-3" : "px-2"} py-1.5 text-sm font-medium transition-colors`}
              >
                <div className={`flex items-center ${isMobile ? "justify-center" : ""}`}>
                  {item.icon === "dashboard" && <LayoutDashboard className={isMobile ? "h-5 w-5" : "mr-1 h-4 w-4"} />}
                  {item.icon === "mail" && <Mail className={isMobile ? "h-5 w-5" : "mr-1 h-4 w-4"} />}
                  {item.icon === "message" && <MessageCircle className={isMobile ? "h-5 w-5" : "mr-1 h-4 w-4"} />}
                  <span className={isMobile ? "hidden" : "inline"}>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      {/* Always show the menu button, without requiring user authentication */}
      <div className="flex items-center ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {user ? (
              <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                <LogOut className="h-4 w-4 mr-2" />
                <span>Logout</span>
              </DropdownMenuItem>
            ) : (
              <Link href="/login">
                <DropdownMenuItem>
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Login</span>
                </DropdownMenuItem>
              </Link>
            )}
            <DropdownMenuSeparator />
            <Link href="/build">
              <DropdownMenuItem>
                <LayoutDashboard className="h-4 w-4 mr-2" />
                <span>Build</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/account">
              <DropdownMenuItem>
                <User className="h-4 w-4 mr-2" />
                <span>Account</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/lists">
              <DropdownMenuItem>
                <ListTodo className="h-4 w-4 mr-2" />
                <span>Lists</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/campaigns">
              <DropdownMenuItem>
                <Mail className="h-4 w-4 mr-2" />
                <span>Campaigns</span>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}