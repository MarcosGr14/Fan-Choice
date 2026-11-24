// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: TYPED API CLIENT (WITH SAFE LOCAL FALLBACK)
// ==============================================================================

export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export type ApiResponse<T> = { data: T | null; error: string | null; errorCode?: string | null };

export class ApiRequestError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export class ApiClient {
  private token: string | null = null;
  private pendingGets = new Map<string, Promise<ApiResponse<unknown>>>();

  setToken(token: string | null) {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem('league_auth_token', token);
      else localStorage.removeItem('league_auth_token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('league_auth_token');
    }
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (method === 'GET') {
      const key = `${token || 'public'} ${url}`;
      const pending = this.pendingGets.get(key);
      if (pending) return pending as Promise<ApiResponse<T>>;
      const request = this.fetchRequest<T>(url, method, options, headers);
      this.pendingGets.set(key, request as Promise<ApiResponse<unknown>>);
      try { return await request; }
      finally { if (this.pendingGets.get(key) === request) this.pendingGets.delete(key); }
    }

    return this.fetchRequest<T>(url, method, options, headers);
  }

  private async fetchRequest<T>(url: string, method: string, options: RequestInit, headers: Record<string, string>): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, { ...options, method, headers, ...(method === 'GET' ? { cache: 'no-store' as RequestCache } : {}) });
      if (!response.ok) {
        if (response.status === 401) this.setToken(null);
        const payload: unknown = await response.json().catch(() => null);
        const errorJson = payload && typeof payload === 'object'
          ? payload as { error?: unknown; errors?: unknown; code?: unknown; errorCode?: unknown }
          : {};
        const validationMessage = Array.isArray(errorJson.errors)
          ? errorJson.errors.filter((item): item is string => typeof item === 'string').join(' ')
          : null;
        return {
          data: null,
          error: typeof errorJson.error === 'string' ? errorJson.error : validationMessage || `No se pudo completar la solicitud (${response.statusText || 'error del servidor'}).`,
          errorCode: typeof errorJson.code === 'string' ? errorJson.code : typeof errorJson.errorCode === 'string' ? errorJson.errorCode : `HTTP ${response.status}`,
        };
      }
      const data = await response.json();
      return { data, error: null, errorCode: null };
    } catch {
      return { data: null, error: 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.', errorCode: 'NETWORK' };
    }
  }

  // Auth
  async login(username: string, password: string) {
    return this.request<{ success: boolean; token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async getMe() {
    return this.request<{ success: boolean; user: any }>('/auth/me');
  }

  // League
  async getOverview(date?: string) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request<any>(`/league/overview${query}`);
  }

  async getArtists() {
    return this.request<{ total: number; artists: any[] }>('/league/artists');
  }

  // Votes
  async getTodayVotes() {
    return this.request<any>('/votes/today');
  }

  async getPeriodicCatalog() { return this.request<any>('/periodic'); }
  async getMyPeriodicVotes() { return this.request<any>('/periodic/me'); }
  async submitPeriodicVote(body: {kind:string;seasonId:string;periodKey:string;selections:{male:string[];female:string[]}}) {
    return this.request<{success:boolean}>('/periodic/votes',{method:'POST',body:JSON.stringify(body)});
  }

  async submitBallot(category: 'male' | 'female', items: Array<{ rankPosition: number; artistId: string }>, competitionDate?: string) {
    return this.request<{ success: boolean; message: string; updatedAt: string }>('/votes/ballot', {
      method: 'PUT',
      body: JSON.stringify({ category, items, competitionDate }),
    });
  }

  // Archive
  async getArchivedSeasons() {
    return this.request<{ total: number; seasons: any[] }>('/archive/seasons');
  }

  async getArchivedSeason(seasonId: string) {
    return this.request<{ success: boolean; archive: any }>(`/archive/seasons/${encodeURIComponent(seasonId)}`);
  }

  // Admin
  async triggerSync(date?: string) {
    return this.request<{ success: boolean; message: string; syncResult: any }>('/admin/sync/trigger', {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  }
}

export const apiClient = new ApiClient();
