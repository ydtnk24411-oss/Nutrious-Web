import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
   * Tìm kiếm địa chỉ bằng dữ liệu OpenStreetMap (Photon API siêu tốc, không bị chặn DNS tại VN)
   */
  searchAddressNominatim(query: string): Observable<NominatimPlace[]> {
    if (!query || !query.trim()) return of([]);
    const encoded = encodeURIComponent(query.trim());
    const photonUrl = `https://photon.komoot.io/api/?q=${encoded}&limit=5`;
    return this.http.get<any>(photonUrl).pipe(
      map((res) => {
        const features = res?.features || [];
        return features.map((f: any) => {
          const p = f.properties || {};
          const parts = [p.name, p.street, p.district || p.suburb, p.city || p.county, p.country].filter(Boolean);
          const unique = Array.from(new Set(parts));
          return {
            place_id: p.osm_id || Math.floor(Math.random() * 100000),
            lat: String(f.geometry?.coordinates?.[1] ?? 0),
            lon: String(f.geometry?.coordinates?.[0] ?? 0),
            display_name: unique.join(', '),
          };
        });
      }),
      catchError(() => {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=vn&limit=5&addressdetails=1`;
        return this.http.get<NominatimPlace[]>(nominatimUrl).pipe(catchError(() => of([])));
      })
    );
  }

  /**
   * Chuyển tọa độ thành địa chỉ chi tiết bằng dữ liệu OpenStreetMap
   */
  reverseGeocodeNominatim(lat: number, lon: number): Observable<string | null> {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
    return this.http.get<any>(photonUrl).pipe(
      map((res) => {
        const p = res?.features?.[0]?.properties;
        if (!p) return null;
        const parts = [p.name, p.street, p.locality || p.district, p.city || p.county, p.country].filter(Boolean);
        const unique = Array.from(new Set(parts));
        return unique.length > 0 ? unique.join(', ') : null;
      }),
      catchError(() => {
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
        return this.http.get<any>(nominatimUrl).pipe(
          map((res) => res?.display_name || null),
          catchError(() => of(null))
        );
      })
    );
  }
}

