import {
  User,
  ServerProfile,
  ServerCreateInput,
  ConnectionTestResult,
  ConnectResult,
  SftpFileItem,
  ServerMetrics,
  ServiceTunnel,
  TunnelCreateInput,
  DatabaseQueryInput,
  DatabaseQueryResult,
  DiscoveredService,
  ServiceActionInput,
  ServiceActionOutput,
  ServiceLogsResult
} from '../types';

const TOKEN_KEY = 'ssh_workspace_token';
const USER_KEY = 'ssh_workspace_user';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  getUser: (): User | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user: User) => localStorage.setItem(USER_KEY, JSON.stringify(user))
};

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const data = await response.json();
      if (data.error) errorMsg = data.error;
      else if (data.message) errorMsg = data.message;
    } catch {
      // Ignore json parse error
    }
    throw new Error(errorMsg);
  }

  // Handle empty or void responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return {} as T;
}

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      authStorage.setToken(res.token);
      authStorage.setUser(res.user);
      return res;
    },
    register: async (name: string, email: string, password: string) => {
      const res = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      authStorage.setToken(res.token);
      authStorage.setUser(res.user);
      return res;
    },
    logout: async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } finally {
        authStorage.clearToken();
      }
    },
    me: async () => {
      return apiFetch<User>('/api/auth/me');
    }
  },

  servers: {
    list: async () => apiFetch<ServerProfile[]>('/api/servers'),
    get: async (id: number) => apiFetch<ServerProfile>(`/api/servers/${id}`),
    create: async (input: ServerCreateInput) =>
      apiFetch<ServerProfile>('/api/servers', {
        method: 'POST',
        body: JSON.stringify(input)
      }),
    update: async (id: number, input: Partial<ServerCreateInput>) =>
      apiFetch<ServerProfile>(`/api/servers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
      }),
    delete: async (id: number) =>
      apiFetch<{ message: string }>(`/api/servers/${id}`, { method: 'DELETE' }),
    test: async (id: number, timeoutMs = 5000) =>
      apiFetch<ConnectionTestResult>(`/api/servers/${id}/test?timeoutMs=${timeoutMs}`, { method: 'POST' }),
    checkAllHealth: async (timeoutMs = 5000) =>
      apiFetch<Record<number, ConnectionTestResult>>(`/api/servers/health-check?timeoutMs=${timeoutMs}`, { method: 'POST' }),
    connect: async (id: number) =>
      apiFetch<ConnectResult>(`/api/servers/${id}/connect`, { method: 'POST' }),
    getGroups: async () => apiFetch<string[]>('/api/servers/groups'),
    getTags: async () => apiFetch<string[]>('/api/servers/tags'),
    deleteTag: async (tagName: string) => {
      const clean = encodeURIComponent(tagName.replace(/^#+/, '').trim());
      return apiFetch<{ message: string; tag: string }>(`/api/servers/tags/${clean}`, { method: 'DELETE' });
    },
    removeTag: async (serverId: number, tagName: string) => {
      const clean = encodeURIComponent(tagName.replace(/^#+/, '').trim());
      return apiFetch<ServerProfile>(`/api/servers/${serverId}/tags/${clean}`, { method: 'DELETE' });
    }
  },

  sessions: {
    list: async () => apiFetch<any[]>('/api/sessions'),
    terminate: async (id: string) =>
      apiFetch<{ message: string }>(`/api/sessions/${id}`, { method: 'DELETE' })
  },

  sftp: {
    listFiles: async (serverId: number, path = '.') =>
      apiFetch<{ currentPath: string; files: SftpFileItem[] }>(
        `/api/servers/${serverId}/files?path=${encodeURIComponent(path)}`
      ),
    upload: async (serverId: number, path: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<{ message: string }>(
        `/api/servers/${serverId}/files/upload?path=${encodeURIComponent(path)}`,
        {
          method: 'POST',
          body: formData
        }
      );
    },
    downloadUrl: (serverId: number, path: string) =>
      `/api/servers/${serverId}/files/download?path=${encodeURIComponent(path)}`,
    delete: async (serverId: number, path: string) =>
      apiFetch<{ message: string }>(
        `/api/servers/${serverId}/files?path=${encodeURIComponent(path)}`,
        { method: 'DELETE' }
      ),
    mkdir: async (serverId: number, path: string) =>
      apiFetch<{ message: string }>(`/api/servers/${serverId}/files/mkdir`, {
        method: 'POST',
        body: JSON.stringify({ path })
      }),
    rename: async (serverId: number, oldPath: string, newPath: string) =>
      apiFetch<{ message: string }>(`/api/servers/${serverId}/files/rename`, {
        method: 'PUT',
        body: JSON.stringify({ oldPath, newPath })
      })
  },

  monitoring: {
    get: async (serverId: number) =>
      apiFetch<ServerMetrics>(`/api/servers/${serverId}/monitoring`)
  },

  tunnels: {
    listForServer: async (serverId: number) =>
      apiFetch<ServiceTunnel[]>(`/api/servers/${serverId}/tunnels`),
    listAll: async () =>
      apiFetch<ServiceTunnel[]>('/api/tunnels'),
    create: async (serverId: number, input: TunnelCreateInput) =>
      apiFetch<ServiceTunnel>(`/api/servers/${serverId}/tunnels`, {
        method: 'POST',
        body: JSON.stringify(input)
      }),
    start: async (tunnelId: number) =>
      apiFetch<ServiceTunnel>(`/api/tunnels/${tunnelId}/start`, { method: 'POST' }),
    stop: async (tunnelId: number) =>
      apiFetch<ServiceTunnel>(`/api/tunnels/${tunnelId}/stop`, { method: 'POST' }),
    delete: async (tunnelId: number) =>
      apiFetch<{ message: string }>(`/api/tunnels/${tunnelId}`, { method: 'DELETE' })
  },

  database: {
    query: async (serverId: number, input: DatabaseQueryInput) =>
      apiFetch<DatabaseQueryResult>(`/api/servers/${serverId}/database/query`, {
        method: 'POST',
        body: JSON.stringify(input)
      })
  },

  services: {
    list: async (serverId: number) =>
      apiFetch<DiscoveredService[]>(`/api/servers/${serverId}/services`),
    action: async (serverId: number, input: ServiceActionInput) =>
      apiFetch<ServiceActionOutput>(`/api/servers/${serverId}/services/action`, {
        method: 'POST',
        body: JSON.stringify(input)
      }),
    getLogs: async (serverId: number, serviceName: string, source = 'SYSTEMD') =>
      apiFetch<ServiceLogsResult>(
        `/api/servers/${serverId}/services/${encodeURIComponent(serviceName)}/logs?source=${encodeURIComponent(source)}`
      )
  }
};
