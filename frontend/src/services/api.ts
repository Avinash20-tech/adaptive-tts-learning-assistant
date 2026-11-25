import type { Analytics, Bookmark, DocumentResponse, FeedbackAction, UserProfile, Voice } from '../types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText || `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      /* keep the status text */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  voices: () => request<{ voices: Voice[] }>('/voices'),

  createDocument: (userId: string, title: string, text: string) =>
    request<DocumentResponse>('/documents', json('POST', { user_id: userId, title, text })),

  uploadDocument: (userId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<DocumentResponse>(`/documents/upload?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: form,
    });
  },

  feedback: (userId: string, segmentId: string, action: FeedbackAction) =>
    request<{ prosody_offset: number; message: string }>(
      '/feedback',
      json('POST', { user_id: userId, segment_id: segmentId, action_type: action }),
    ),

  bookmarks: (userId: string) =>
    request<{ bookmarks: Bookmark[] }>(`/bookmarks?user_id=${encodeURIComponent(userId)}`),

  analytics: (userId: string) => request<Analytics>(`/analytics/${encodeURIComponent(userId)}`),

  getUser: (userId: string) => request<{ user: UserProfile }>(`/users/${encodeURIComponent(userId)}`),

  updateUser: (userId: string, body: Partial<Pick<UserProfile, 'base_speed' | 'preferred_voice'>>) =>
    request<{ user: UserProfile }>(`/users/${encodeURIComponent(userId)}`, json('PUT', body)),
};

export function audioUrl(segmentId: string, userId: string): string {
  return `${BASE}/segments/${segmentId}/audio?user_id=${encodeURIComponent(userId)}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
