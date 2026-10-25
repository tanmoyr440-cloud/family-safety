import * as React from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Eye,
  FileText,
  Home,
  IndianRupee,
  Landmark,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Logo, SwipeToRefresh } from "@/shared/ui";
import { InstallPwaPrompt } from "@/shared/ui/InstallPwaPrompt";
import { useCurrentUser } from "@/features/auth/api/useCurrentUser";
import { useLogout } from "@/features/auth/api/useLogout";

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/", icon: <Home className="h-4 w-4" /> },
  { label: "Accounts", to: "/accounts", icon: <Landmark className="h-4 w-4" /> },
  { label: "Loans & EMI", to: "/loans", icon: <IndianRupee className="h-4 w-4" /> },
  { label: "Contacts", to: "/contacts", icon: <Users className="h-4 w-4" /> },
  { label: "Documents", to: "/documents", icon: <FileText className="h-4 w-4" /> },
  { label: "Notifications", to: "/notifications", icon: <Bell className="h-4 w-4" /> },
  { label: "Settings", to: "/settings", icon: <Settings className="h-4 w-4" /> },
];

interface MobileDockItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  ariaLabel?: string;
}

const MOBILE_DOCK_ITEMS: MobileDockItem[] = [
  { label: "Dashboard", to: "/", icon: <Home className="h-4 w-4" /> },
  { label: "Accounts", to: "/accounts", icon: <Landmark className="h-4 w-4" /> },
  { label: "Loans", to: "/loans", icon: <IndianRupee className="h-4 w-4" />, ariaLabel: "Loans & EMI" },
  { label: "Contacts", to: "/contacts", icon: <Users className="h-4 w-4" /> },
  { label: "Documents", to: "/documents", icon: <FileText className="h-4 w-4" /> },
  { label: "Alerts", to: "/notifications", icon: <Bell className="h-4 w-4" />, ariaLabel: "Notifications" },
];

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const { mutate: logout } = useLogout();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleManualRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(15);
      }
    } catch {
      // Haptics optional
    }
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [queryClient]);

  // Active dock index for smooth sliding pill animation
  const activeDockIndex = React.useMemo(() => {
    const path = location.pathname;
    if (path === "/") return 0;
    if (path.startsWith("/accounts")) return 1;
    if (path.startsWith("/loans")) return 2;
    if (path.startsWith("/contacts")) return 3;
    if (path.startsWith("/documents")) return 4;
    if (path.startsWith("/notifications")) return 5;
    return -1;
  }, [location.pathname]);

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout(undefined, {
      onSettled: () => {
        navigate("/login", { replace: true });
      },
    });
  };

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "FS";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 transition-shadow shadow-xs">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          {/* Left: Brand & Desktop Nav */}
          <div className="flex items-center gap-7 lg:gap-8">
            <Link
              to="/"
              className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl py-1"
              aria-label="Family Safety Net Home"
            >
              <span className="sr-only">Family Safety Net</span>
              <Logo variant="icon" />
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden xl:flex items-center gap-1" aria-label="Main navigation">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold shadow-xs border border-blue-200/70"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )
                  }
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Intermediate Screen Navigation (Medium to Large Laptops) */}
            <nav className="hidden md:flex xl:hidden items-center gap-1" aria-label="Compact navigation">
              {NAV_ITEMS.slice(0, 5).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold shadow-xs border border-blue-200/70"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )
                  }
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right: Monitoring Pill, Parent Preview Shortcut, User Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Live Monitoring Indicator with pulse beacon */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-medium text-emerald-800 shadow-2xs">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Monitoring active</span>
            </div>

            {/* Quick Refresh Button (Live Data Sync) */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-xl border border-slate-200/80 bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 hover:border-blue-200 shadow-2xs transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Refresh live financial data (or swipe up anywhere on screen)"
              aria-label="Refresh live data"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300",
                  isRefreshing && "animate-spin text-blue-600",
                )}
              />
            </button>

            {/* Quick Action: Preview as Parent */}
            <Link
              to="/notifications"
              className="hidden lg:flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-700 hover:border-blue-200 transition-all duration-150"
              title="Preview emergency dossier exactly as seen by parents"
            >
              <Eye className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              <span>Parent Preview</span>
            </Link>

            {/* User Profile Pill & Sign Out */}
            {user && (
              <div className="flex items-center gap-2 border-l border-slate-200/80 pl-2.5 sm:pl-3">
                <div
                  className="flex items-center gap-2 rounded-xl bg-slate-50/90 border border-slate-200/60 p-1 sm:px-2.5 sm:py-1"
                  title={`Logged in as ${user.name}`}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-slate-800 to-slate-700 text-white text-[10px] font-bold shadow-2xs">
                    {userInitials}
                  </div>
                  <span className="hidden sm:inline text-xs font-semibold text-slate-800 truncate max-w-[110px]">
                    {user.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 border border-transparent transition-colors text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  title="Sign out of account"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-150">
            {/* Status indicator on mobile */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Monitoring active</span>
              </div>
              <Link
                to="/notifications"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Parent Preview</span>
              </Link>
            </div>

            {/* Navigation links */}
            <div className="grid grid-cols-1 gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/70"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                    )
                  }
                >
                  <span className="text-slate-500" aria-hidden="true">{item.icon}</span>
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              ))}
            </div>

            {/* User & Sign Out on Mobile */}
            {user && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-white text-xs font-bold">
                    {userInitials}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block">{user.name}</span>
                    <span className="text-[10px] text-slate-500 block">{user.email}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs font-medium text-red-600 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area with Swipe Up / Pull Down Refresh and Smooth Page Transitions */}
      <SwipeToRefresh className="flex-1 flex flex-col">
        <main
          id="main-content"
          className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 pb-32 md:pb-12"
        >
          <React.Suspense
            fallback={
              <div
                className="flex items-center justify-center min-h-[40vh]"
                aria-label="Loading content"
              >
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            }
          >
            <div
              key={location.pathname}
              className="animate-in fade-in-50 duration-200 ease-out"
            >
              <Outlet />
            </div>
          </React.Suspense>
        </main>
      </SwipeToRefresh>

      {/* PWA Installation Prompt (Appears on mobile / non-installed browsers) */}
      <InstallPwaPrompt />

      {/* Mobile Bottom Navigation (Liquid Glass macOS Dock with Smooth Sliding Indicator) */}
      <nav
        className="md:hidden fixed z-40 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md rounded-[28px] glass-dock p-1.5 select-none"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
        aria-label="Mobile bottom navigation"
      >
        {/* Specular top light reflection highlight */}
        <div
          className="absolute top-0 inset-x-8 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none rounded-t-full opacity-90"
          aria-hidden="true"
        />

        <div className="grid grid-cols-6 items-center gap-0.5">
          {MOBILE_DOCK_ITEMS.map((item, index) => {
            const isActive = activeDockIndex === index;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                aria-label={item.ariaLabel || item.label}
                className={cn(
                  "glass-dock-tile flex flex-col items-center justify-center py-2 px-1 rounded-2xl min-w-0 select-none overflow-hidden transition-all duration-200 border",
                  isActive
                    ? "bg-blue-600/15 text-blue-600 font-semibold border-blue-400/40 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-white/40",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "transition-transform duration-200",
                    isActive ? "-translate-y-0.5 scale-110" : "",
                  )}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] tracking-tight leading-none truncate max-w-full mt-1">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>Family Safety Net — Automated alerts upon inactivity or missed loan payments.</p>
          <p className="text-slate-400">All data encrypted in transit and at rest.</p>
        </div>
      </footer>
    </div>
  );
};
