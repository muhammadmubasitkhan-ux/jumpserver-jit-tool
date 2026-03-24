// API Service Layer for JumpServer JIT Access Portal

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const API_PREFIX = '/api';

// ── Types ──────────────────────────────────────────────

export interface Asset {
  id: string;
  name: string;
  address: string;
  platform: string;
  org_name?: string;
  nodes_display?: string;
}

export interface AssetNode {
  id: string;
  name: string;
  value?: string;
  key?: string;
  parent?: string;
  parent_key?: string;
  full_value?: string;
  assets_amount?: number;
}

export interface Account {
  id: string;
  name: string;
  username: string;
  asset: string;
}

export interface AccessRequest {
  id: string;
  requester?: string;
  asset_id: string;
  asset_name: string;
  account_ids: string[];
  account_names: string[];
  reason: string;
  duration_minutes: number;
  status: 'pending' | 'approved' | 'denied' | 'revoked' | 'expired';
  created_at: string;
  updated_at?: string;
  reviewer?: string;
  reviewer_comment?: string;
}

export interface CreateRequestPayload {
  asset_ids: string[];
  asset_names: string[];
  account_ids: string[];
  reason: string;
  duration_minutes: number;
  use_all_accounts?: boolean;
  virtual_accounts?: string[];
}

export interface DashboardStats {
  total_requests: number;
  active_grants: number;
  pending_approvals: number;
}

export interface ActiveGrant {
  id: string;
  asset_name: string;
  account_names: string[];
  requester: string;
  granted_at: string;
  expires_at: string;
  duration_minutes: number;
}

export interface HealthStatus {
  status: string;
  jumpserver_connected: boolean;
  database_connected: boolean;
  details?: Record<string, unknown>;
}

export interface AuthTestResult {
  endpoints: {
    name: string;
    url: string;
    status: 'ok' | 'error';
    message?: string;
  }[];
}

export interface UserInfo {
  username: string;
  role: 'admin' | 'requester';
  is_authenticated: boolean;
}

// ── API Error ──────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Fetch wrapper ──────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${API_PREFIX}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    redirect: 'manual',
  });

  // Handle redirects (303 from backend = unauthenticated)
  if (res.type === 'opaqueredirect' || res.status === 303) {
    window.location.href = '/auth/login';
    throw new ApiError(303, 'Redirecting to login');
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError(res.status, 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new ApiError(res.status, body);
  }

  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text);
}

function mapRequest(raw: Record<string, unknown>): AccessRequest {
  const accounts = String(raw.accounts ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return {
    id: String(raw.id ?? ''),
    requester: String(raw.requester ?? ''),
    asset_id: String(raw.asset_id ?? raw.asset_hostname ?? ''),
    asset_name: String(raw.asset_name ?? raw.asset_hostname ?? ''),
    account_ids: accounts,
    account_names: accounts,
    reason: String(raw.reason ?? ''),
    duration_minutes: Number(raw.duration_minutes ?? 0),
    status: String(raw.status ?? 'pending') as AccessRequest['status'],
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
    reviewer: String(raw.reviewer ?? ''),
    reviewer_comment: String(raw.review_comment ?? ''),
  };
}

function mapActiveGrant(raw: Record<string, unknown>): ActiveGrant {
  const accounts = String(raw.accounts ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return {
    id: String(raw.id ?? ''),
    asset_name: String(raw.asset_hostname ?? ''),
    account_names: accounts,
    requester: String(raw.requester ?? ''),
    granted_at: String(raw.access_start ?? ''),
    expires_at: String(raw.access_expiry ?? ''),
    duration_minutes: Number(raw.duration_minutes ?? 0),
  };
}

// ── Requester APIs ─────────────────────────────────────

export const requesterApi = {
  searchAssets: (search: string) =>
    apiFetch<Asset[]>(`/request/api/jumpserver/assets?search=${encodeURIComponent(search)}`),

  getAccounts: (assetId: string) =>
    apiFetch<Account[]>(`/request/api/jumpserver/accounts/${assetId}`),

  getNodes: () =>
    apiFetch<AssetNode[]>(`/request/api/jumpserver/nodes`),

  createRequest: async (payload: CreateRequestPayload) => {
    if (!payload.asset_ids.length || !payload.asset_names.length) {
      throw new ApiError(400, 'Select at least one asset');
    }
    const uniqueAssetIds = Array.from(new Set(payload.asset_ids));
    const accountGroups = await Promise.all(
      uniqueAssetIds.map((assetId) => requesterApi.getAccounts(assetId).catch(() => [] as Account[]))
    );
    const accounts = accountGroups.flat();
    const selectedAccounts = payload.use_all_accounts
      ? ["@ALL"]
      : accounts
          .filter((entry) => payload.account_ids.includes(entry.id))
          .map((entry) => entry.username || entry.name)
          .filter(Boolean);
    const accountTokens = [...selectedAccounts, ...(payload.virtual_accounts ?? [])];
    if (!accountTokens.length) {
      throw new ApiError(400, 'Select at least one account or use @ALL');
    }
    const me = await authApi.getMe();
    if (!me.is_authenticated) {
      throw new ApiError(401, 'Unauthorized');
    }
    const created = await apiFetch<Record<string, unknown>>('/request/api/requests', {
      method: 'POST',
      body: JSON.stringify({
        requester: me.username,
        requester_email: '',
        jumpserver_user: me.username,
        asset_hostname: payload.asset_names.join(','),
        accounts: accountTokens.join(','),
        reason: payload.reason,
        duration_minutes: payload.duration_minutes,
      }),
    });
    return mapRequest(created);
  },

  getMyRequests: async () => {
    const data = await apiFetch<Record<string, unknown>[]>('/request/api/requests');
    return data.map(mapRequest);
  },

  getRequest: async (id: string) => {
    const data = await apiFetch<Record<string, unknown>>(`/request/api/requests/${id}`);
    return mapRequest(data);
  },
};

// ── Admin APIs ─────────────────────────────────────────

export const adminApi = {
  getRequests: async (status?: string, limit = 200) => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    query.set("limit", String(limit));
    const suffix = query.toString();
    const data = await apiFetch<Record<string, unknown>[]>(
      `/request/api/requests${suffix ? `?${suffix}` : ""}`
    );
    return data.map(mapRequest);
  },

  approveRequest: async (id: string, comment?: string) => {
    const me = await authApi.getMe();
    const data = await apiFetch<Record<string, unknown>>(`/approvals/api/requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewer: me.username || 'Admin', comment: comment || '' }),
    });
    return mapRequest(data);
  },

  denyRequest: async (id: string, comment?: string) => {
    const me = await authApi.getMe();
    const data = await apiFetch<Record<string, unknown>>(`/approvals/api/requests/${id}/deny`, {
      method: 'POST',
      body: JSON.stringify({ reviewer: me.username || 'Admin', comment: comment || '' }),
    });
    return mapRequest(data);
  },

  revokeRequest: async (id: string, comment?: string) => {
    const data = await apiFetch<Record<string, unknown>>(`/approvals/api/requests/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
    return mapRequest(data);
  },

  getStats: () =>
    apiFetch<DashboardStats>('/dashboard/api/stats'),

  getActiveGrants: async () => {
    const data = await apiFetch<Record<string, unknown>[]>('/dashboard/api/active-grants');
    return data.map(mapActiveGrant);
  },

  getHealth: async () => {
    const data = await apiFetch<Record<string, unknown>>('/dashboard/api/health');
    return {
      status: String(data.jumpserver ?? 'unknown'),
      jumpserver_connected: String(data.jumpserver ?? '').toLowerCase() === 'ok',
      database_connected: String(data.jit_tool ?? '').toLowerCase() === 'ok',
      details: data,
    };
  },

  testAuth: async () => {
    const data = await apiFetch<Record<string, { status: unknown; body: unknown }>>('/dashboard/api/test-auth');
    return {
      endpoints: Object.entries(data).map(([name, value]) => ({
        name,
        url: name,
        status: typeof value?.status === 'number' && value.status >= 200 && value.status < 400 ? 'ok' : 'error',
        message: String(value?.body ?? ''),
      })),
    };
  },
};

// ── Auth ───────────────────────────────────────────────

export const authApi = {
  login: async (username: string, password: string) => {
    const body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);

    const response = await fetch(`${API_BASE}${API_PREFIX}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (response.type !== 'opaqueredirect' && response.status !== 303 && response.status !== 200) {
      const text = await response.text().catch(() => 'Login failed');
      throw new ApiError(response.status, text || 'Login failed');
    }
    const me = await authApi.getMe();
    if (!me.is_authenticated) {
      throw new ApiError(401, 'Invalid credentials');
    }
    return me;
  },

  logout: async () => {
    const response = await fetch(`${API_BASE}${API_PREFIX}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    if (response.type !== 'opaqueredirect' && response.status !== 303 && !response.ok) {
      const text = await response.text().catch(() => 'Logout failed');
      throw new ApiError(response.status, text || 'Logout failed');
    }
  },

  getMe: () =>
    apiFetch<UserInfo>('/auth/me'),
};
