import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface WarehouseLocation {
  id?: string;
  name: string;
  address: string;
  province?: string;
  district?: string;
  lat: number;
  lng: number;
  phone?: string;
  openingHours?: string;
  readyTime?: string;
  isHeadquarter?: boolean;
}

export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export const DEFAULT_WAREHOUSES: WarehouseLocation[] = [
  // TP. Hồ Chí Minh
  {
    id: 'store-thuduc',
    name: 'Tổng kho Evergreen Mart Thủ Đức (Trụ sở chính)',
    address: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'TP. Thủ Đức',
    lat: 10.8703,
    lng: 106.7782,
    phone: '0962 299 122',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
    isHeadquarter: true,
  },
  {
    id: 'store-q1',
    name: 'Cửa hàng Evergreen Mart Quận 1',
    address: '128 Hai Bà Trưng, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận 1',
    lat: 10.7865,
    lng: 106.6998,
    phone: '028 3822 5588',
    openingHours: '07:30 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-binhthanh',
    name: 'Cửa hàng Evergreen Mart Bình Thạnh',
    address: '45 Điện Biên Phủ, Phường 15, Quận Bình Thạnh, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận Bình Thạnh',
    lat: 10.7981,
    lng: 106.7058,
    phone: '028 3514 6677',
    openingHours: '07:00 - 21:00',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-q7',
    name: 'Cửa hàng Evergreen Mart Quận 7',
    address: '105 Nguyễn Thị Thập, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận 7',
    lat: 10.7382,
    lng: 106.7196,
    phone: '028 5410 8899',
    openingHours: '07:30 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-tanbinh',
    name: 'Cửa hàng Evergreen Mart Tân Bình',
    address: '32 Phổ Quang, Phường 2, Quận Tân Bình, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận Tân Bình',
    lat: 10.8038,
    lng: 106.6662,
    phone: '028 3844 1122',
    openingHours: '07:00 - 21:00',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-govap',
    name: 'Cửa hàng Evergreen Mart Gò Vấp',
    address: '366 Phan Văn Trị, Phường 5, Quận Gò Vấp, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận Gò Vấp',
    lat: 10.8228,
    lng: 106.6908,
    phone: '028 3894 3355',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-binhtan',
    name: 'Cửa hàng Evergreen Mart Bình Tân',
    address: 'Số 1 Đường Số 17A, Phường Bình Trị Đông B, Quận Bình Tân, TP. Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận Bình Tân',
    lat: 10.7516,
    lng: 106.6083,
    phone: '028 3752 9988',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },

  // Bình Dương
  {
    id: 'store-dian',
    name: 'Kho Evergreen Mart Dĩ An',
    address: '01/08 Quốc Lộ 1K, Phường Tân Hòa, TP. Dĩ An, Bình Dương',
    province: 'Tỉnh Bình Dương',
    district: 'TP. Dĩ An',
    lat: 10.8986,
    lng: 106.7865,
    phone: '0274 377 8899',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-thudaumot',
    name: 'Kho Evergreen Mart Thủ Dầu Một',
    address: '230 Đại lộ Bình Dương, Phường Phú Hòa, TP. Thủ Dầu Một, Bình Dương',
    province: 'Tỉnh Bình Dương',
    district: 'TP. Thủ Dầu Một',
    lat: 10.9805,
    lng: 106.6745,
    phone: '0274 382 1234',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },

  // Đồng Nai
  {
    id: 'store-bienhoa',
    name: 'Kho Evergreen Mart Biên Hòa',
    address: '104 Đồng Khởi, Phường Tân Hiệp, TP. Biên Hòa, Đồng Nai',
    province: 'Tỉnh Đồng Nai',
    district: 'TP. Biên Hòa',
    lat: 10.9631,
    lng: 106.8488,
    phone: '0251 388 6677',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },

  // Hà Nội
  {
    id: 'store-dongda',
    name: 'Kho Evergreen Mart Đống Đa - Hà Nội',
    address: '12 Chùa Bộc, Phường Quang Trung, Quận Đống Đa, Hà Nội',
    province: 'Thành phố Hà Nội',
    district: 'Quận Đống Đa',
    lat: 21.0074,
    lng: 105.8285,
    phone: '024 3852 4466',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
  {
    id: 'store-caugiay',
    name: 'Kho Evergreen Mart Cầu Giấy - Hà Nội',
    address: '165 Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội',
    province: 'Thành phố Hà Nội',
    district: 'Quận Cầu Giấy',
    lat: 21.0336,
    lng: 105.7946,
    phone: '024 3767 1122',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },

  // Đà Nẵng
  {
    id: 'store-danang',
    name: 'Kho Evergreen Mart Đà Nẵng',
    address: '48 Điện Biên Phủ, Phường Chính Gián, Quận Thanh Khê, TP. Đà Nẵng',
    province: 'Thành phố Đà Nẵng',
    district: 'Quận Thanh Khê',
    lat: 16.0678,
    lng: 108.1963,
    phone: '0236 374 8899',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },

  // Khánh Hòa (Nha Trang)
  {
    id: 'store-nhatrang',
    name: 'Kho Evergreen Mart Nha Trang',
    address: 'Số 82 Lê Hồng Phong, Phường Phước Hải, TP. Nha Trang, Khánh Hòa',
    province: 'Tỉnh Khánh Hòa',
    district: 'TP. Nha Trang',
    lat: 12.2355,
    lng: 109.1865,
    phone: '0258 387 9900',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },

  // Đắk Lắk (Buôn Ma Thuột)
  {
    id: 'store-daklak',
    name: 'Kho Evergreen Mart Buôn Ma Thuột',
    address: '35 Nguyễn Tất Thành, Phường Tân An, TP. Buôn Ma Thuột, Đắk Lắk',
    province: 'Tỉnh Đắk Lắk',
    district: 'TP. Buôn Ma Thuột',
    lat: 12.6934,
    lng: 108.0538,
    phone: '0262 395 7788',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },

  // Cần Thơ
  {
    id: 'store-cantho',
    name: 'Kho Evergreen Mart Cần Thơ',
    address: '209 Đường 30 Tháng 4, Phường Xuân Khánh, Quận Ninh Kiều, Cần Thơ',
    province: 'Thành phố Cần Thơ',
    district: 'Quận Ninh Kiều',
    lat: 10.0278,
    lng: 105.7725,
    phone: '0292 383 6677',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },

  // Bà Rịa - Vũng Tàu
  {
    id: 'store-vungtau',
    name: 'Kho Evergreen Mart Vũng Tàu',
    address: '155 Nguyễn Thái Học, Phường 7, TP. Vũng Tàu, Bà Rịa - Vũng Tàu',
    province: 'Tỉnh Bà Rịa - Vũng Tàu',
    district: 'TP. Vũng Tàu',
    lat: 10.3542,
    lng: 107.0863,
    phone: '0254 357 8899',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },

  // Lâm Đồng (Đà Lạt)
  {
    id: 'store-dalat',
    name: 'Kho Evergreen Mart Đà Lạt',
    address: 'Số 10 Phan Chu Trinh, Phường 9, TP. Đà Lạt, Lâm Đồng',
    province: 'Tỉnh Lâm Đồng',
    district: 'TP. Đà Lạt',
    lat: 11.9442,
    lng: 108.4552,
    phone: '0263 382 3344',
    openingHours: '07:00 - 21:30',
    readyTime: 'Chuẩn bị hàng: 15 - 30 phút',
  },
];

export function findNearestWarehouse(
  customerLat: number,
  customerLng: number,
  warehouses: WarehouseLocation[] = DEFAULT_WAREHOUSES
): WarehouseLocation {
  const list = warehouses && warehouses.length > 0 ? warehouses : DEFAULT_WAREHOUSES;
  let nearest = list[0];
  let minDistance = Infinity;

  for (const wh of list) {
    if (typeof wh.lat !== 'number' || typeof wh.lng !== 'number') continue;
    const dist = calculateHaversineKm(customerLat, customerLng, wh.lat, wh.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = wh;
    }
  }
  return nearest;
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
  standardRadiusKm?: number;
  maxAllowedKm?: number;
  isFarDelivery?: boolean;
  farSurcharge?: number;
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
  title?: string;
  subtitle?: string;
  streetName?: string;
  state?: string;
  city?: string;
  district?: string;
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
  searchAddressNominatim(query: string, biasLat?: number, biasLng?: number): Observable<NominatimPlace[]> {
    if (!query || !query.trim()) return of([]);
    const encoded = encodeURIComponent(query.trim());
    let photonUrl = `https://photon.komoot.io/api/?q=${encoded}&limit=6`;
    if (typeof biasLat === 'number' && typeof biasLng === 'number') {
      photonUrl += `&lat=${biasLat}&lon=${biasLng}`;
    }
    return this.http.get<any>(photonUrl).pipe(
      map((res) => {
        const features = res?.features || [];
        return features.map((f: any) => {
          const p = f.properties || {};
          const title = p.name || p.street || (p.housenumber ? `Số ${p.housenumber}` : '') || 'Địa điểm';
          const subParts = [
            p.housenumber && p.name && p.name !== p.housenumber ? `Số ${p.housenumber}` : '',
            p.street && p.street !== p.name ? p.street : '',
            p.district || p.suburb || p.locality,
            p.city || p.county || p.state,
            p.country
          ].filter(Boolean);
          const uniqueSub = Array.from(new Set(subParts));

          const allParts = [p.name, p.housenumber, p.street, p.district || p.suburb, p.city || p.county, p.country].filter(Boolean);
          const uniqueAll = Array.from(new Set(allParts));

          return {
            place_id: p.osm_id || Math.floor(Math.random() * 100000),
            lat: String(f.geometry?.coordinates?.[1] ?? 0),
            lon: String(f.geometry?.coordinates?.[0] ?? 0),
            display_name: uniqueAll.length > 0 ? uniqueAll.join(', ') : title,
            title,
            subtitle: uniqueSub.join(', '),
            streetName: p.street || p.name || '',
            state: p.state || '',
            city: p.city || p.county || '',
            district: p.district || p.suburb || p.locality || '',
          };
        });
      }),
      catchError(() => of([]))
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
        const parts = [
          p.housenumber ? `Số ${p.housenumber}` : '',
          p.name && p.name !== p.housenumber ? p.name : '',
          p.street && p.street !== p.name ? p.street : '',
          p.locality || p.district || p.suburb,
          p.city || p.county || p.state,
          p.country
        ].filter(Boolean);
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

