import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface WarehouseLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface DistanceTier {
  minKm: number;
  maxKm: number;
  fee: number;
  label?: string;
}

export interface OrderDiscountTier {
  minOrderValue: number;
  discountAmount: number;
  label?: string;
}

export interface ShippingConfigData {
  key: string;
  warehouse: WarehouseLocation;
  distanceTiers: DistanceTier[];
  maxDeliveryRadiusKm: number;
  orderDiscounts: OrderDiscountTier[];
  foodPreservationPolicy?: string;
  isServiceActive?: boolean;
}

export interface ShippingCalculationResult {
  supported: boolean;
  distanceKm: number;
  durationMin?: number;
  estimatedDeliveryTime?: string;
  baseFee: number;
  tierLabel?: string;
  discount: number;
  discountReason?: string;
  finalFee: number;
  warehouse: WarehouseLocation;
  routeGeometry?: {
    type: string;
    coordinates: [number, number][];
  } | null;
  foodPreservationPolicy?: string;
  message?: string;
}

export interface NominatimPlace {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

@Injectable({ providedIn: 'root' })
export class ShippingApiService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  getConfig(): Observable<{ success: boolean; data: ShippingConfigData }> {
    return this.api.get<{ success: boolean; data: ShippingConfigData }>('/shipping/config');
  }

  updateConfig(body: Partial<ShippingConfigData>): Observable<{ success: boolean; message: string; data: ShippingConfigData }> {
    return this.api.put<{ success: boolean; message: string; data: ShippingConfigData }>('/shipping/config', body);
  }

  calculate(lat: number, lng: number, subtotal: number): Observable<{ success: boolean; data: ShippingCalculationResult }> {
    return this.api.post<{ success: boolean; data: ShippingCalculationResult }>('/shipping/calculate', {
      lat,
      lng,
      subtotal,
    });
  }

  /**
   * Tìm kiếm địa chỉ bằng OpenStreetMap Nominatim miễn phí (giới hạn Việt Nam)
   */
  searchAddressNominatim(query: string): Observable<NominatimPlace[]> {
    if (!query || !query.trim()) return of([]);
    const encoded = encodeURIComponent(query.trim());
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=vn&limit=5&addressdetails=1`;
    return this.http.get<NominatimPlace[]>(url, {
      headers: {
        'Accept-Language': 'vi,en',
      },
    }).pipe(
      catchError(() => of([]))
    );
  }

  /**
   * Chuyển tọa độ thành địa chỉ chi tiết bằng Nominatim
   */
  reverseGeocodeNominatim(lat: number, lon: number): Observable<any> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
    return this.http.get<any>(url, {
      headers: {
        'Accept-Language': 'vi,en',
      },
    }).pipe(
      catchError(() => of(null))
    );
  }
}
