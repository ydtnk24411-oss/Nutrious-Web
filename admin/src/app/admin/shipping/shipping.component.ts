import { Component, OnInit, OnDestroy, ElementRef, ViewChild, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import {
  ShippingApiService,
  ShippingConfigData,
  DistanceTier,
  OrderDiscountTier,
  NominatimPlace,
} from '../../shared/services/shipping-api.service';

@Component({
  selector: 'app-admin-shipping',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shipping.component.html',
  styleUrl: './shipping.component.css',
})
export class AdminShippingComponent implements OnInit, OnDestroy {
  @ViewChild('adminMapContainer', { static: false }) mapContainerRef!: ElementRef<HTMLDivElement>;

  private shippingApi = inject(ShippingApiService);

  // State
  loading = signal(true);
  saving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  // Config data
  warehouseName = signal('Tổng kho Evergreen Mart TP.HCM');
  warehouseAddress = signal('Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh');
  warehouseLat = signal(10.8703);
  warehouseLng = signal(106.7782);
  maxRadiusKm = signal(10);
  foodPreservationPolicy = signal(
    'Bảo quản nghiêm ngặt trong thùng xốp cách nhiệt & túi gel lạnh chuyên dụng. Vận chuyển xe lạnh giao nhanh trong ngày để đảm bảo 100% độ tươi ngon cho nông sản và thực phẩm tươi sống.'
  );

  distanceTiers = signal<DistanceTier[]>([
    { minKm: 0, maxKm: 2, fee: 15000, label: 'Giao gần nội khu' },
    { minKm: 2, maxKm: 5, fee: 20000, label: 'Bán kính trung bình' },
    { minKm: 5, maxKm: 8, fee: 25000, label: 'Bán kính mở rộng' },
    { minKm: 8, maxKm: 10, fee: 30000, label: 'Giới hạn giao tươi' },
  ]);

  orderDiscounts = signal<OrderDiscountTier[]>([
    { minOrderValue: 199000, discountAmount: 5000, label: 'Đơn từ 199k: Giảm 5.000đ' },
    { minOrderValue: 299000, discountAmount: 10000, label: 'Đơn từ 299k: Giảm 10.000đ' },
    { minOrderValue: 499000, discountAmount: 15000, label: 'Đơn từ 499k: Giảm 15.000đ' },
  ]);

  // Address search
  searchQuery = signal('');
  searchResults = signal<NominatimPlace[]>([]);
  searchingAddress = signal(false);

  // Leaflet
  private map: L.Map | null = null;
  private warehouseMarker: L.Marker | null = null;
  private radiusCircle: L.Circle | null = null;

  ngOnInit(): void {
    this.loadConfig();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  loadConfig(): void {
    this.loading.set(true);
    this.shippingApi.getConfig().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          const cfg = res.data;
          if (cfg.warehouse) {
            this.warehouseName.set(cfg.warehouse.name || this.warehouseName());
            this.warehouseAddress.set(cfg.warehouse.address || this.warehouseAddress());
            if (cfg.warehouse.lat && cfg.warehouse.lng) {
              this.warehouseLat.set(cfg.warehouse.lat);
              this.warehouseLng.set(cfg.warehouse.lng);
            }
          }
          if (cfg.maxDeliveryRadiusKm) {
            this.maxRadiusKm.set(cfg.maxDeliveryRadiusKm);
          }
          if (cfg.foodPreservationPolicy) {
            this.foodPreservationPolicy.set(cfg.foodPreservationPolicy);
          }
          if (cfg.distanceTiers && cfg.distanceTiers.length > 0) {
            this.distanceTiers.set([...cfg.distanceTiers]);
          }
          if (cfg.orderDiscounts && cfg.orderDiscounts.length > 0) {
            this.orderDiscounts.set([...cfg.orderDiscounts]);
          }
        }
        setTimeout(() => this.initMap(), 150);
      },
      error: () => {
        this.loading.set(false);
        setTimeout(() => this.initMap(), 150);
      },
    });
  }

  private initMap(): void {
    if (!this.mapContainerRef) return;
    const el = this.mapContainerRef.nativeElement;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    const lat = this.warehouseLat();
    const lng = this.warehouseLng();

    this.map = L.map(el, {
      center: [lat, lng],
      zoom: 13,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this.map);

    const warehouseIcon = L.divIcon({
      className: 'admin-wh-pin',
      html: `
        <div style="background:#15803d;color:#fff;border:3px solid #fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.35);font-size:18px;cursor:grab;">
          🏭
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    this.warehouseMarker = L.marker([lat, lng], {
      icon: warehouseIcon,
      draggable: true,
    }).addTo(this.map);

    this.warehouseMarker.bindPopup(`<b>${this.warehouseName()}</b><br>Kéo thả marker để đổi vị trí kho`).openPopup();

    this.warehouseMarker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      this.updateWarehouseCoords(pos.lat, pos.lng);
    });

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.updateWarehouseCoords(e.latlng.lat, e.latlng.lng);
    });

    this.drawRadiusCircle();
    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  private drawRadiusCircle(): void {
    if (!this.map) return;
    if (this.radiusCircle) {
      this.radiusCircle.remove();
    }
    const radiusMeters = this.maxRadiusKm() * 1000;
    this.radiusCircle = L.circle([this.warehouseLat(), this.warehouseLng()], {
      radius: radiusMeters,
      color: '#16a34a',
      fillColor: '#86efac',
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '6, 6',
    }).addTo(this.map);
  }

  updateWarehouseCoords(lat: number, lng: number): void {
    this.warehouseLat.set(Number(lat.toFixed(6)));
    this.warehouseLng.set(Number(lng.toFixed(6)));

    if (this.warehouseMarker) {
      this.warehouseMarker.setLatLng([lat, lng]);
    }
    if (this.map) {
      this.map.panTo([lat, lng]);
    }
    this.drawRadiusCircle();

    // Reverse geocode để cập nhật địa chỉ kho nếu admin chưa gõ
    this.shippingApi.reverseGeocodeNominatim(lat, lng).subscribe((addr) => {
      if (addr) {
        this.warehouseAddress.set(addr);
      }
    });
  }

  onSearchInput(val: string): void {
    this.searchQuery.set(val);
    if (!val || val.trim().length < 3) {
      this.searchResults.set([]);
      return;
    }
    this.searchingAddress.set(true);
    this.shippingApi.searchAddressNominatim(val).subscribe((res) => {
      this.searchingAddress.set(false);
      this.searchResults.set(res || []);
    });
  }

  selectPlace(p: NominatimPlace): void {
    const lat = parseFloat(p.lat);
    const lng = parseFloat(p.lon);
    this.warehouseAddress.set(p.display_name);
    this.updateWarehouseCoords(lat, lng);
    this.searchResults.set([]);
    this.searchQuery.set('');
  }

  onMaxRadiusChange(val: number): void {
    this.maxRadiusKm.set(Number(val));
    this.drawRadiusCircle();
  }

  // Tiers manipulation
  updateTierFee(index: number, val: number): void {
    const arr = [...this.distanceTiers()];
    arr[index].fee = Number(val);
    this.distanceTiers.set(arr);
  }

  updateTierLabel(index: number, label: string): void {
    const arr = [...this.distanceTiers()];
    arr[index].label = label;
    this.distanceTiers.set(arr);
  }

  updateDiscountAmount(index: number, val: number): void {
    const arr = [...this.orderDiscounts()];
    arr[index].discountAmount = Number(val);
    this.orderDiscounts.set(arr);
  }

  updateDiscountMin(index: number, val: number): void {
    const arr = [...this.orderDiscounts()];
    arr[index].minOrderValue = Number(val);
    this.orderDiscounts.set(arr);
  }

  saveConfig(): void {
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    const payload: Partial<ShippingConfigData> = {
      warehouse: {
        name: this.warehouseName().trim(),
        address: this.warehouseAddress().trim(),
        lat: this.warehouseLat(),
        lng: this.warehouseLng(),
      },
      maxDeliveryRadiusKm: this.maxRadiusKm(),
      foodPreservationPolicy: this.foodPreservationPolicy().trim(),
      distanceTiers: this.distanceTiers(),
      orderDiscounts: this.orderDiscounts(),
      isServiceActive: true,
    };

    this.shippingApi.updateConfig(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.successMsg.set('Cập nhật cấu hình vận chuyển & tọa độ kho thành công vào MongoDB!');
          setTimeout(() => this.successMsg.set(''), 4000);
        } else {
          this.errorMsg.set(res.message || 'Không thể lưu cấu hình.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err.error?.message || 'Lỗi khi gửi yêu cầu lưu cấu hình.');
      },
    });
  }

  formatPrice(v: number): string {
    return (v || 0).toLocaleString('vi-VN') + 'đ';
  }
}
