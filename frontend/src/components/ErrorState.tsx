import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive/60 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">Something went wrong</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{message}</p>
        {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
      </CardContent>
    </Card>
  );
}
