import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

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

export interface UploadedBannerMedia {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

@Injectable({
  providedIn: 'root',
})
export class BannerApiService {
  private api = inject(ApiService);

  getConfig(): Observable<{ success: boolean; data: BannerConfigData }> {
    return this.api.get<{ success: boolean; data: BannerConfigData }>('/banners');
  }

  updateConfig(payload: { heroSlides?: HeroSlide[]; promoPopup?: PromoPopup }): Observable<{ success: boolean; message: string; data: BannerConfigData }> {
    return this.api.put<{ success: boolean; message: string; data: BannerConfigData }>('/banners', payload);
  }

  togglePopup(): Observable<{ success: boolean; message: string; enabled: boolean }> {
    return this.api.patch<{ success: boolean; message: string; enabled: boolean }>('/banners/toggle-popup', {});
  }

  uploadImage(dataUrl: string, filename: string): Observable<{ success: boolean; message: string; data: UploadedBannerMedia }> {
    return this.api.post<{ success: boolean; message: string; data: UploadedBannerMedia }>(
      '/banners/upload',
      { dataUrl, filename },
      30000
    );
  }
}
