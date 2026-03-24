import { Link, useLocation, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Shield, FileText, ClipboardList, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function AppShell() {
  const { user, loading, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;

  const navItems = isAdmin
    ? [
        { to: '/approvals', label: 'Approvals', icon: ClipboardList },
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ]
    : [
        { to: '/request', label: 'Request Access', icon: FileText },
        { to: '/request/my', label: 'My Requests', icon: ClipboardList },
      ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground hidden sm:inline">JumpServer JIT</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to}>
                <Button
                  variant={location.pathname === item.to ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.username}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-card p-2">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>
                <Button
                  variant={location.pathname === item.to ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-2 mb-1"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
