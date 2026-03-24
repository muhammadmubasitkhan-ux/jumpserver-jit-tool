import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  pending: 'status-badge-pending',
  approved: 'status-badge-approved',
  denied: 'status-badge-denied',
  revoked: 'status-badge-revoked',
  expired: 'status-badge-expired',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('capitalize text-xs font-medium', statusStyles[status] || '')}>
      {status}
    </Badge>
  );
}
