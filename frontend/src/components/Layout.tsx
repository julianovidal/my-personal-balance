import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/accounts", label: "Accounts" },
  { to: "/transactions", label: "Transactions" },
  { to: "/classifier", label: "Classifier" },
  { to: "/profile", label: "Profile" }
];

export function Layout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="text-lg font-semibold">Balance</div>
          <nav className="flex items-center gap-3">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded px-3 py-2 text-sm ${location.pathname === link.to ? "bg-muted font-semibold" : "hover:bg-muted"}`}
              >
                {link.label}
              </Link>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                logout();
                nav("/login");
              }}
            >
              Logout
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
