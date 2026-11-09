import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface ProvinceItem {
  code: number;
  name: string;
  divisionType: string;
  codename: string;
}

export interface WardItem {
  code: number;
  name: string;
  divisionType: string;
  codename: string;
  provinceCode: number;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private api = inject(ApiService);

  getProvinces(): Observable<ProvinceItem[]> {
    return this.api.get<{ success: boolean; data: ProvinceItem[] }>('/locations/provinces').pipe(
      map((res) => res?.data || [])
    );
  }

  getWards(provinceCode: number): Observable<WardItem[]> {
    return this.api.get<{ success: boolean; data: WardItem[] }>(`/locations/provinces/${provinceCode}/wards`).pipe(
      map((res) => res?.data || [])
    );
  }
}

