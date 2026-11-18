import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface HeroSlide {
  id?: string;
  title: string;
  subtitle: string;
  eyebrow: string;
  cta: string;
  link: string;
  image: string;
  active: boolean;
  sortOrder: number;
}

export interface PromoPopup {
  title: string;
  description: string;
  image: string;
  badge: string;
  voucherCode: string;
  buttonText: string;
  buttonLink: string;
  enabled: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface BannerConfigData {
  _id?: string;
  heroSlides: HeroSlide[];
  promoPopup: PromoPopup;
  updatedBy?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BannerApiService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/banners';

  getConfig(): Observable<{ success: boolean; data: BannerConfigData }> {
    return this.http.get<{ success: boolean; data: BannerConfigData }>(this.apiUrl);
  }

  updateConfig(payload: { heroSlides?: HeroSlide[]; promoPopup?: PromoPopup }): Observable<{ success: boolean; message: string; data: BannerConfigData }> {
    return this.http.put<{ success: boolean; message: string; data: BannerConfigData }>(this.apiUrl, payload, { withCredentials: true });
  }

  togglePopup(): Observable<{ success: boolean; message: string; enabled: boolean }> {
    return this.http.patch<{ success: boolean; message: string; enabled: boolean }>(`${this.apiUrl}/toggle-popup`, {}, { withCredentials: true });
  }
}
