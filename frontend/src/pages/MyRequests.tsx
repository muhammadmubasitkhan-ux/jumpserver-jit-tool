import { useEffect, useState } from 'react';
import { requesterApi, type AccessRequest, ApiError } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function MyRequests() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = () => {
    setLoading(true);
    setError('');
    requesterApi.getMyRequests()
      .then(setRequests)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter === 'all'
    ? requests
    : requests.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">View your access request history</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No requests found" description={statusFilter !== 'all' ? 'Try changing the filter.' : 'Submit your first access request to get started.'} />
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request ID</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Accounts</TableHead>
                <TableHead className="hidden md:table-cell">Reason</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Reviewer</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{r.asset_name}</TableCell>
                  <TableCell className="text-sm">{r.account_names?.join(', ') || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">{r.reason}</TableCell>
                  <TableCell>{r.duration_minutes}m</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{r.reviewer || '—'}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
