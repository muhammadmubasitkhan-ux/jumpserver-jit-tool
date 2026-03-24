import { useEffect, useState } from 'react';
import { adminApi, type DashboardStats, type ActiveGrant, type HealthStatus, type AuthTestResult, ApiError } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, Shield, Clock, FileText, RefreshCw, Loader2, CheckCircle, XCircle } from 'lucide-react';

function KpiCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [grants, setGrants] = useState<ActiveGrant[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [authTest, setAuthTest] = useState<AuthTestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testingAuth, setTestingAuth] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, g, h] = await Promise.all([
        adminApi.getStats(),
        adminApi.getActiveGrants(),
        adminApi.getHealth(),
      ]);
      setStats(s);
      setGrants(g);
      setHealth(h);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runAuthTest = async () => {
    setTestingAuth(true);
    try {
      const result = await adminApi.testAuth();
      setAuthTest(result);
    } catch {
      setAuthTest(null);
    } finally {
      setTestingAuth(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of JIT access activity</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Total Requests" value={stats.total_requests} icon={FileText} />
          <KpiCard label="Active Grants" value={stats.active_grants} icon={Shield} />
          <KpiCard label="Pending Approvals" value={stats.pending_approvals} icon={Clock} />
        </div>
      )}

      {/* Health */}
      {health && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Badge variant={health.jumpserver_connected ? 'default' : 'destructive'} className="gap-1">
                {health.jumpserver_connected ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                JumpServer
              </Badge>
              <Badge variant={health.database_connected ? 'default' : 'destructive'} className="gap-1">
                {health.database_connected ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                Database
              </Badge>
              <Badge variant="outline" className="capitalize">{health.status}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Grants */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Grants ({grants.length})</CardTitle>
          <CardDescription>Currently active privileged access sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {grants.length === 0 ? (
            <EmptyState title="No active grants" />
          ) : (
            <div className="rounded-lg border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Accounts</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grants.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.asset_name}</TableCell>
                      <TableCell>{g.requester}</TableCell>
                      <TableCell className="text-sm">{g.account_names?.join(', ')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(g.expires_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auth Test */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Test Auth Endpoints</CardTitle>
            <Button variant="outline" size="sm" onClick={runAuthTest} disabled={testingAuth} className="gap-2">
              {testingAuth ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Run Test
            </Button>
          </div>
        </CardHeader>
        {authTest && (
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {authTest.endpoints.map((ep) => (
                <Badge key={ep.name} variant={ep.status === 'ok' ? 'default' : 'destructive'} className="gap-1">
                  {ep.status === 'ok' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {ep.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
