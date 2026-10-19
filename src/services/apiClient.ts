// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: TYPED API CLIENT (WITH SAFE LOCAL FALLBACK)
// ==============================================================================

export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export class ApiClient {
  private token: string | null = null;

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

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T | null; error: string | null }> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        if (response.status === 401) this.setToken(null);
        const errorJson = await response.json().catch(() => ({}));
        return { data: null, error: errorJson.error || errorJson.errors?.join(' ') || `HTTP ${response.status}: ${response.statusText}` };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Error de conexión con el servidor API.' };
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
