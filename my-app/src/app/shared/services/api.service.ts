import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const apiOrigin = environment.apiUrl.replace(/\/+$/, '').replace(/\/api$/, '');
export const API_BASE = `${apiOrigin}/api`;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private headers(): HttpHeaders {
    let h = new HttpHeaders();
    // User auth token takes priority over admin token to avoid cross-account updates
    const token = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('xanhla_auth_token') || localStorage.getItem('xanhla_admin_token'))
      : null;
    if (token) {
      h = h.set('Authorization', `Bearer ${token}`);
    }
    let storeId = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('xanhla_selected_store_id') || '')
      : '';
    if (!storeId && typeof localStorage !== 'undefined') {
      try {
        const userStr = localStorage.getItem('xanhla_user_session');
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u && Array.isArray(u.addresses) && u.addresses.length > 0) {
            const def = u.addresses.find((a: any) => a.isDefault) || u.addresses[0];
            const fullText = `${def?.street || ''} ${def?.ward || ''} ${def?.address || ''} ${def?.city || ''} ${def?.province || ''}`.toLowerCase();
            if (fullText.includes('dĩ an') || fullText.includes('di an') || fullText.includes('bình dương') || fullText.includes('binh duong')) {
              storeId = 'store-dian';
            }
          }
        }
      } catch {}
    }
    storeId = storeId || 'store-thuduc';
    if (storeId) {
      h = h.set('x-store-id', storeId);
    }
    return h;
  }

  get<T>(path: string, params?: Record<string, string | number>): Observable<T> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => p = p.set(k, String(v)));
    return this.http.get<T>(`${API_BASE}${path}`, { headers: this.headers(), params: p });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${API_BASE}${path}`, body, { headers: this.headers() });
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${API_BASE}${path}`, body, { headers: this.headers() });
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${API_BASE}${path}`, body, { headers: this.headers() });
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${API_BASE}${path}`, { headers: this.headers() });
  }
}
