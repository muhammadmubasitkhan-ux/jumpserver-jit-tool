import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <Shield className="h-12 w-12 text-destructive/60 mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">Access Denied</h1>
          <p className="text-sm text-muted-foreground mb-6">You don't have permission to access this page.</p>
          <Link to="/"><Button variant="outline">Go Home</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
