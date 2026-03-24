import { Card, CardContent } from '@/components/ui/card';
import { Inbox } from 'lucide-react';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
        {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      </CardContent>
    </Card>
  );
}
