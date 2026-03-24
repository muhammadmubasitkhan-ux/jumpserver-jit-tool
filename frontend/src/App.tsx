import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import Login from "@/pages/Login";
import RequestAccess from "@/pages/RequestAccess";
import MyRequests from "@/pages/MyRequests";
import Approvals from "@/pages/Approvals";
import Dashboard from "@/pages/Dashboard";
import Unauthorized from "@/pages/Unauthorized";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
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
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (!isAdmin) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/dashboard' : '/request'} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/" element={<HomeRedirect />} />

            {/* Authenticated routes */}
            <Route element={<AuthRoute><AppShell /></AuthRoute>}>
              <Route path="/request" element={<RequestAccess />} />
              <Route path="/request/my" element={<MyRequests />} />
              <Route path="/approvals" element={<AdminRoute><Approvals /></AdminRoute>} />
              <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
