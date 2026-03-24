import * as SecureStore from 'expo-secure-store';
import { API_URL, localTunnelHeaders } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  public_key: string | null;
  is_online: boolean;
  created_at: string;
}

export interface Partner {
  id: string;
  name: string;
  avatar: string | null;
  public_key: string | null;
  is_online: boolean;
}

export interface PairStatus {
  paired: boolean;
  pair_id: string | null;
  partner: Partner | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface PairingCode {
  code: string;
  expires_at: string;
}

export interface JoinPairResponse {
  pair_id: string;
  partner: Partner;
}

export interface Message {
  id: string;
  encrypted_payload: string;
  sender_id: string;
  sender_name?: string;
  time: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  reactions: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  media_uri?: string;
  media_type?: string;
  caption?: string;
  duration?: number;
  is_deleted: boolean;
}

// ─── API Client ──────────────────────────────────────────────────
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('auth_token');
    } catch {
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...localTunnelHeaders(),
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add timeout to prevent infinite loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new ApiError(response.status, error.detail || 'Request failed');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new ApiError(408, 'Request timeout - please check your connection');
      }
      throw error;
    }
  }

  // ─── Auth ────────────────────────────────────────────────────
  async register(name: string, email: string, password: string, publicKey?: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, public_key: publicKey }),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async updateProfile(data: { name?: string; avatar?: string }): Promise<User> {
    return this.request<User>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
  }

  // ─── Pairing ─────────────────────────────────────────────────
  async generatePairingCode(): Promise<PairingCode> {
    return this.request<PairingCode>('/pair/generate', {
      method: 'POST',
    });
  }

  async joinPair(code: string): Promise<JoinPairResponse> {
    return this.request<JoinPairResponse>('/pair/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getPairStatus(): Promise<PairStatus> {
    return this.request<PairStatus>('/pair/status');
  }

  async getPartner(): Promise<Partner> {
    return this.request<Partner>('/pair/partner');
  }

  async unpair(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/pair/unpair', {
      method: 'DELETE',
    });
  }

  // ─── Users ───────────────────────────────────────────────────
  async searchUsers(query: string): Promise<User[]> {
    return this.request<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  }

  async updatePushToken(pushToken: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/users/push-token', {
      method: 'PATCH',
      body: JSON.stringify({ push_token: pushToken }),
    });
  }

  async updatePublicKey(publicKey: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/users/public-key', {
      method: 'PATCH',
      body: JSON.stringify({ public_key: publicKey }),
    });
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export const api = new ApiClient();

// Mood & anniversary are not HTTP — use Socket.IO (`mood:update`, `anniversary:update`).
// Types: `@/services/realtimeEvents`; crypto helpers: `@/services/pairCrypto`; emits: `useSocket`.
