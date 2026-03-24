import { useState, useEffect, useCallback } from 'react';
import { requesterApi, type Asset, type Account, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Search, X } from 'lucide-react';

export default function RequestAccess() {
  const { toast } = useToast();

  // Asset search
  const [assetSearch, setAssetSearch] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetToAdd, setAssetToAdd] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);

  // Accounts
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [useAllAccounts, setUseAllAccounts] = useState(false);
  const [virtualInput, setVirtualInput] = useState(false);
  const [virtualUser, setVirtualUser] = useState(false);
  const [virtualAnon, setVirtualAnon] = useState(false);

  // Form
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(120);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Search assets with debounce
  const searchAssets = useCallback(async (q: string) => {
    if (q.length < 2) { setAssets([]); return; }
    setAssetsLoading(true);
    try {
      const data = await requesterApi.searchAssets(q);
      setAssets(data);
    } catch { /* ignore */ }
    finally { setAssetsLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchAssets(assetSearch), 300);
    return () => clearTimeout(t);
  }, [assetSearch, searchAssets]);

  // Load accounts when one or more assets selected
  useEffect(() => {
    if (selectedAssets.length === 0) { setAccounts([]); return; }
    setAccountsLoading(true);
    setSelectedAccountIds([]);
    setUseAllAccounts(false);
    const uniqueAccounts = new Map<string, Account>();
    Promise.all(
      selectedAssets.map((asset) =>
        requesterApi.getAccounts(asset.id).catch(() => [] as Account[])
      )
    )
      .then((groups) => {
        for (const group of groups) {
          for (const account of group) {
            const key = account.id || `${account.username}:${account.name}`;
            if (!uniqueAccounts.has(key)) uniqueAccounts.set(key, account);
          }
        }
        setAccounts(Array.from(uniqueAccounts.values()));
      })
      .catch(() => setAccounts([]))
      .finally(() => setAccountsLoading(false));
  }, [selectedAssets]);

  const addSelectedAsset = (assetId: string) => {
    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset) return;
    setSelectedAssets((prev) => {
      if (prev.some((entry) => entry.id === asset.id)) return prev;
      return [...prev, asset];
    });
    setAssetToAdd('');
  };

  const removeSelectedAsset = (assetId: string) => {
    setSelectedAssets((prev) => prev.filter((entry) => entry.id !== assetId));
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const virtualCount = Number(virtualInput) + Number(virtualUser) + Number(virtualAnon);
  const hasAccountSelection = useAllAccounts || selectedAccountIds.length > 0 || virtualCount > 0;
  const canSubmit = selectedAssets.length > 0 && hasAccountSelection && reason.length >= 10 && duration >= 15 && duration <= 480;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await requesterApi.createRequest({
        asset_ids: selectedAssets.map((asset) => asset.id),
        asset_names: selectedAssets.map((asset) => asset.name),
        account_ids: selectedAccountIds,
        reason,
        duration_minutes: duration,
        use_all_accounts: useAllAccounts,
        virtual_accounts: [
          ...(virtualInput ? ["@INPUT"] : []),
          ...(virtualUser ? ["@USER"] : []),
          ...(virtualAnon ? ["@ANON"] : []),
        ],
      });
      setCreatedId(result.id);
      toast({ title: 'Request submitted', description: `Request ${result.id} created successfully.` });
    } catch (err) {
      toast({
        title: 'Failed to submit',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (createdId) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-success mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">Request Submitted</h3>
          <p className="text-sm text-muted-foreground mb-4">Your request has been created and is pending approval.</p>
          <code className="bg-muted px-3 py-1.5 rounded text-sm font-mono text-foreground mb-6">{createdId}</code>
          <Button variant="outline" onClick={() => { setCreatedId(null); setSelectedAssets([]); setReason(''); setDuration(120); setSelectedAccountIds([]); setUseAllAccounts(false); setVirtualInput(false); setVirtualUser(false); setVirtualAnon(false); }}>
            Submit Another Request
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Request Access</h1>
        <p className="text-sm text-muted-foreground mt-1">Submit a just-in-time privileged access request</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Asset search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Target Asset</CardTitle>
            <CardDescription>Search for the asset you need access to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets by name..."
                className="pl-9"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
              />
            </div>
            {assetsLoading && <p className="text-sm text-muted-foreground">Searching...</p>}
            {selectedAssets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedAssets.map((asset) => (
                  <span key={asset.id} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-foreground">
                    {asset.name}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-primary/20"
                      onClick={() => removeSelectedAsset(asset.id)}
                      aria-label={`Remove ${asset.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {assets.length > 0 && (
              <div className="flex gap-2">
                <Select value={assetToAdd} onValueChange={setAssetToAdd}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets
                      .filter((asset) => !selectedAssets.some((selected) => selected.id === asset.id))
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.address})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" disabled={!assetToAdd} onClick={() => addSelectedAsset(assetToAdd)}>
                  Add
                </Button>
              </div>
            )}
            {assets.length === 0 && assetSearch.length >= 2 && !assetsLoading && (
              <p className="text-sm text-muted-foreground">No matching assets found.</p>
            )}
          </CardContent>
        </Card>

        {/* Accounts */}
        {selectedAssets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Accounts</CardTitle>
              <CardDescription>Select the accounts you need access to</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 space-y-2">
                <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer border-border hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={virtualUser}
                    onChange={(e) => setVirtualUser(e.target.checked)}
                    className="rounded border-input"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Same-name account (@USER)</div>
                    <div className="text-xs text-muted-foreground">Use account matching your JumpServer username.</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer border-border hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={virtualInput}
                    onChange={(e) => setVirtualInput(e.target.checked)}
                    className="rounded border-input"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Manual input (@INPUT)</div>
                    <div className="text-xs text-muted-foreground">Provide credentials manually when connecting.</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer border-border hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={virtualAnon}
                    onChange={(e) => setVirtualAnon(e.target.checked)}
                    className="rounded border-input"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Anonymous (@ANON)</div>
                    <div className="text-xs text-muted-foreground">Use anonymous/no-credential access if available.</div>
                  </div>
                </label>
              </div>

              {accountsLoading ? (
                <p className="text-sm text-muted-foreground">Loading accounts...</p>
              ) : accounts.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">No accounts found for this asset.</p>
                  <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer border-border hover:border-primary/40">
                    <input
                      type="checkbox"
                      checked={useAllAccounts}
                      onChange={(e) => setUseAllAccounts(e.target.checked)}
                      className="rounded border-input"
                    />
                    <div>
                      <div className="text-sm font-medium text-foreground">Use all accounts (@ALL)</div>
                      <div className="text-xs text-muted-foreground">Submit the request without selecting specific accounts.</div>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {accounts.map((acc) => (
                    <label
                      key={acc.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedAccountIds.includes(acc.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.includes(acc.id)}
                        onChange={() => toggleAccount(acc.id)}
                        className="rounded border-input"
                      />
                      <div>
                        <div className="text-sm font-medium text-foreground">{acc.name}</div>
                        <div className="text-xs text-muted-foreground">{acc.username}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reason & Duration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Request Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Business Justification</Label>
              <Textarea
                id="reason"
                placeholder="Describe why you need this access..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Minimum 10 characters. Be specific about the task.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={15}
                max={480}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Between 15 and 480 minutes (8 hours).</p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={!canSubmit || submitting} className="w-full sm:w-auto">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit Request
        </Button>
      </form>
    </div>
  );
}
