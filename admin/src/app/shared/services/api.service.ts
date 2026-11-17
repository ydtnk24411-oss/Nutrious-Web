import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

export const API_BASE = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private headers(): HttpHeaders {
    // Only use admin token in admin app; never fall back to customer token
    const token = localStorage.getItem('xanhla_admin_token');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  get<T>(path: string, params?: Record<string, string | number>, customTimeout = 10000): Observable<T> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => p = p.set(k, String(v)));
    return this.http
      .get<T>(`${API_BASE}${path}`, { headers: this.headers(), params: p, withCredentials: true })
      .pipe(timeout(customTimeout));
  }

  post<T>(path: string, body: unknown, customTimeout = 10000): Observable<T> {
    return this.http
      .post<T>(`${API_BASE}${path}`, body, { headers: this.headers(), withCredentials: true })
      .pipe(timeout(customTimeout));
  }

  put<T>(path: string, body: unknown, customTimeout = 10000): Observable<T> {
    return this.http
      .put<T>(`${API_BASE}${path}`, body, { headers: this.headers(), withCredentials: true })
      .pipe(timeout(customTimeout));
  }

  patch<T>(path: string, body: unknown, customTimeout = 10000): Observable<T> {
    return this.http
      .patch<T>(`${API_BASE}${path}`, body, { headers: this.headers(), withCredentials: true })
      .pipe(timeout(customTimeout));
  }

  delete<T>(path: string, customTimeout = 10000): Observable<T> {
    return this.http
      .delete<T>(`${API_BASE}${path}`, { headers: this.headers(), withCredentials: true })
      .pipe(timeout(customTimeout));
  }
}
