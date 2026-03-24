import { useEffect, useState } from 'react';
import { adminApi, type AccessRequest, type ActiveGrant, ApiError } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Ban } from 'lucide-react';

export default function Approvals() {
  const { toast } = useToast();
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [auditHistory, setAuditHistory] = useState<AccessRequest[]>([]);
  const [activeGrants, setActiveGrants] = useState<ActiveGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [auditStatusFilter, setAuditStatusFilter] = useState<string>('all');
  const [auditReviewerFilter, setAuditReviewerFilter] = useState<string>('');
  const [auditAssetFilter, setAuditAssetFilter] = useState<string>('');

  // Revoke modal
  const [revokeTarget, setRevokeTarget] = useState<ActiveGrant | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [reqs, grants] = await Promise.all([
        adminApi.getRequests(undefined, 500),
        adminApi.getActiveGrants(),
      ]);
      const pending = reqs.filter((r) => r.status === 'pending');
      const history = reqs
        .filter((r) => r.status !== 'pending')
        .sort((a, b) => {
          const aTime = new Date(a.updated_at || a.created_at).getTime();
          const bTime = new Date(b.updated_at || b.created_at).getTime();
          return bTime - aTime;
        });
      setPendingRequests(pending);
      setAuditHistory(history);
      setActiveGrants(grants);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (id: string, action: 'approve' | 'deny') => {
    setActionLoading(id);
    try {
      const fn = action === 'approve' ? adminApi.approveRequest : adminApi.denyRequest;
      await fn(id, comments[id]);
      toast({ title: `Request ${action}d`, description: `Request ${id.slice(0, 8)} has been ${action}d.` });
      load();
    } catch (e) {
      toast({ title: 'Action failed', description: e instanceof ApiError ? e.message : 'Something went wrong.', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setActionLoading(revokeTarget.id);
    try {
      await adminApi.revokeRequest(revokeTarget.id);
      toast({ title: 'Grant revoked', description: `Access for ${revokeTarget.asset_name} has been revoked.` });
      setRevokeTarget(null);
      load();
    } catch (e) {
      toast({ title: 'Revoke failed', description: e instanceof ApiError ? e.message : 'Something went wrong.', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  const filteredAuditHistory = auditHistory.filter((entry) => {
    if (auditStatusFilter !== 'all' && entry.status !== auditStatusFilter) return false;
    if (auditReviewerFilter && !(entry.reviewer || '').toLowerCase().includes(auditReviewerFilter.toLowerCase())) return false;
    if (auditAssetFilter && !(entry.asset_name || '').toLowerCase().includes(auditAssetFilter.toLowerCase())) return false;
    return true;
  });

  const exportAuditCsv = () => {
    const headers = ['id', 'requester', 'asset', 'status', 'reviewer', 'review_comment', 'created_at', 'updated_at'];
    const escapeField = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filteredAuditHistory.map((entry) => [
      entry.id,
      entry.requester || '',
      entry.asset_name,
      entry.status,
      entry.reviewer || '',
      entry.reviewer_comment || '',
      entry.created_at || '',
      entry.updated_at || '',
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => escapeField(cell)).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jit-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">Review pending requests and manage active grants</p>
      </div>

      {/* Pending Requests */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">Pending Requests ({pendingRequests.length})</h2>
        {pendingRequests.length === 0 ? (
          <EmptyState title="No pending requests" description="All caught up!" />
        ) : (
          <div className="grid gap-4">
            {pendingRequests.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{r.asset_name}</CardTitle>
                    <StatusBadge status={r.status} />
                  </div>
                  <CardDescription>
                    <span className="font-mono text-xs">{r.id.slice(0, 8)}</span> · {r.account_names?.join(', ')} · {r.duration_minutes}m · {new Date(r.created_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-foreground">{r.reason}</p>
                  <Textarea
                    placeholder="Add a comment (optional)..."
                    value={comments[r.id] || ''}
                    onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction(r.id, 'approve')}
                      disabled={!!actionLoading}
                      className="gap-1"
                    >
                      {actionLoading === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(r.id, 'deny')}
                      disabled={!!actionLoading}
                      className="gap-1"
                    >
                      {actionLoading === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      Deny
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Active Grants */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">Active Grants ({activeGrants.length})</h2>
        {activeGrants.length === 0 ? (
          <EmptyState title="No active grants" />
        ) : (
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeGrants.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.asset_name}</TableCell>
                    <TableCell className="text-sm">{g.account_names?.join(', ')}</TableCell>
                    <TableCell className="text-sm">{g.requester}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(g.expires_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => setRevokeTarget(g)} className="gap-1">
                        <Ban className="h-3 w-3" /> Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Audit History */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="text-lg font-medium text-foreground">Audit History ({filteredAuditHistory.length})</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={auditStatusFilter} onValueChange={setAuditStatusFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Filter reviewer"
              value={auditReviewerFilter}
              onChange={(event) => setAuditReviewerFilter(event.target.value)}
            />
            <Input
              placeholder="Filter asset"
              value={auditAssetFilter}
              onChange={(event) => setAuditAssetFilter(event.target.value)}
            />
            <Button variant="outline" onClick={exportAuditCsv}>Export CSV</Button>
          </div>
        </div>
        {filteredAuditHistory.length === 0 ? (
          <EmptyState title="No audit history yet" description="Approved/denied/revoked requests will appear here." />
        ) : (
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuditHistory.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{r.requester || '—'}</TableCell>
                    <TableCell className="font-medium">{r.asset_name}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-sm">{r.reviewer || '—'}</TableCell>
                    <TableCell className="text-sm max-w-[320px] truncate">{r.reviewer_comment || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.updated_at || r.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Revoke Confirmation */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Access</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke access to <strong>{revokeTarget?.asset_name}</strong> for <strong>{revokeTarget?.requester}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={!!actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
