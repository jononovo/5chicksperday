import { Link, useLocation } from "wouter";
import { Bird, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Planning", href: "/planning" },
  { name: "Build", href: "/build" },
  { name: "Search", href: "/" },
  { name: "Lists", href: "/lists" },
  { name: "Campaigns", href: "/campaigns" },
  { name: "Approaches", href: "/approaches" },
  { name: "Outreach", href: "/outreach" }
];

export function MainNav() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  return (
    <nav className="flex items-center justify-between border-b mb-4 px-4 py-3">
      <div className="flex items-center space-x-4">
        <Link href="/" className="group flex items-center gap-2 mr-8">
          <Bird className="h-7 w-7 text-primary transition-colors group-hover:text-primary/90" 
                style={{ transform: 'scaleX(-1)' }} /> {/* Flip the bird to face right */}
          <span className="font-semibold text-lg transition-colors group-hover:text-primary/90">5 Ducks</span>
        </Link>
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
              {item.name}
            </Link>
          );
        })}
      </div>
      {user && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="ml-auto"
        >
          {logoutMutation.isPending ? (
            "Logging out..."
          ) : (
            <>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </>
          )}
        </Button>
      )}
    </nav>
  );
}