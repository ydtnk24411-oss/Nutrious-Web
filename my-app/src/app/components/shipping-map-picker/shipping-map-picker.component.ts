import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import {
  ShippingApiService,
  ShippingCalculationResult,
  NominatimPlace,
  WarehouseLocation,
} from '../../shared/services/shipping-api.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-shipping-map-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shipping-map-picker.component.html',
  styleUrl: './shipping-map-picker.component.css',
})
export class ShippingMapPickerComponent implements OnInit, OnChanges, OnDestroy {
  private shippingApi = inject(ShippingApiService);

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() initialAddress = '';
  @Input() subtotal = 0;

  @Output() locationChanged = new EventEmitter<{
    address: string;
    lat: number;
    lng: number;
    result: ShippingCalculationResult;
  }>();

  @Output() outOfRange = new EventEmitter<{ message: string; distanceKm: number }>();

  searchQuery = '';
  searchResults = signal<NominatimPlace[]>([]);
  isSearching = signal(false);
  isCalculating = signal(false);
  calculationResult = signal<ShippingCalculationResult | null>(null);

  warehouse = signal<WarehouseLocation>({
    name: 'Kho Nông Sản Evergreen Mart',
    address: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
    lat: 10.8703,
    lng: 106.7782,
  });

  private map: L.Map | null = null;
  private warehouseMarker: L.Marker | null = null;
  private customerMarker: L.Marker | null = null;
  private routeLine: L.Polyline | null = null;
  private coverageCircle: L.Circle | null = null;

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  customerLat: number = 10.852;
  customerLng: number = 106.772;

  ngOnInit(): void {
    this.searchQuery = this.initialAddress || '';
    this.setupSearch();
    this.loadWarehouseConfig();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['subtotal'] && !changes['subtotal'].firstChange) {
      if (this.customerLat && this.customerLng) {
        this.recalculate(this.customerLat, this.customerLng, this.searchQuery);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.searchSub) this.searchSub.unsubscribe();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private loadWarehouseConfig(): void {
    this.shippingApi.getConfig().subscribe({
      next: (res) => {
        if (res.success && res.data?.warehouse) {
          this.warehouse.set(res.data.warehouse);
        }
        this.initMap();
      },
      error: () => {
        this.initMap();
      },
    });
  }

  private initMap(): void {
    if (this.map) return;

    const wh = this.warehouse();
    const mapElement = this.mapContainer.nativeElement;

    // Centered around warehouse in Ho Chi Minh City / Thu Duc, Vietnam
    this.map = L.map(mapElement, {
      center: [wh.lat, wh.lng],
      zoom: 13,
      zoomControl: true,
    });

    // OpenStreetMap tile layer (CartoDB Voyager có kèm API Key bản đồ chính thức)
    const cartoKey = 'cb1_52qy_1_f631c7c88a518151e7549366';
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this.map);

    // 1. Vòng tròn bán kính phục vụ 10km quanh kho (bảo quản tươi thực phẩm)
    this.coverageCircle = L.circle([wh.lat, wh.lng], {
      radius: 10000,
      color: '#15803d',
      fillColor: '#22c55e',
      fillOpacity: 0.07,
      weight: 1.5,
      dashArray: '6, 6',
    }).addTo(this.map);

    // 2. Ghim Kho Hàng (Custom green icon)
    const warehouseIcon = L.divIcon({
      className: 'wh-custom-icon',
      html: `
        <div style="background:#15803d;color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.25);border:2px solid #fff;">
          <i class="bi bi-shop" style="font-size:16px"></i>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    this.warehouseMarker = L.marker([wh.lat, wh.lng], {
      icon: warehouseIcon,
      interactive: true,
    })
      .addTo(this.map)
      .bindPopup(
        `<strong>${wh.name}</strong><br><small style="color:#555">${wh.address}</small>`
      );

    // 3. Ghim Khách Hàng (Draggable custom orange icon)
    const customerIcon = L.divIcon({
      className: 'cust-custom-icon',
      html: `
        <div style="background:#ea580c;color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.3);border:2px solid #fff;cursor:grab;">
          <i class="bi bi-geo-alt-fill" style="font-size:16px"></i>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    // Default customer point ~3.5km from warehouse in Linh Trung / Thu Duc
    this.customerLat = wh.lat - 0.018;
    this.customerLng = wh.lng - 0.015;

    this.customerMarker = L.marker([this.customerLat, this.customerLng], {
      icon: customerIcon,
      draggable: true,
    }).addTo(this.map);

    this.customerMarker.on('dragend', () => {
      const pos = this.customerMarker?.getLatLng();
      if (pos) {
        this.customerLat = pos.lat;
        this.customerLng = pos.lng;
        this.reverseGeocodeAndRecalculate(pos.lat, pos.lng);
      }
    });

    // Cho phép click bản đồ để đặt lại ghim nhận hàng
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.customerLat = e.latlng.lat;
      this.customerLng = e.latlng.lng;
      this.customerMarker?.setLatLng(e.latlng);
      this.reverseGeocodeAndRecalculate(e.latlng.lat, e.latlng.lng);
    });

    // Initial calculation
    setTimeout(() => {
      this.map?.invalidateSize();
      this.recalculate(this.customerLat, this.customerLng, this.initialAddress);
    }, 200);
  }

  private setupSearch(): void {
    this.searchSub = this.searchSubject
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.trim().length < 3) {
            this.isSearching.set(false);
            return [];
          }
          this.isSearching.set(true);
          return this.shippingApi.searchAddressNominatim(query);
        })
      )
      .subscribe({
        next: (results) => {
          this.searchResults.set(results);
          this.isSearching.set(false);
        },
        error: () => {
          this.isSearching.set(false);
          this.searchResults.set([]);
        },
      });
  }

  onSearchInput(text: string): void {
    this.searchQuery = text;
    this.searchSubject.next(text);
  }

  selectPlace(place: NominatimPlace): void {
    this.searchQuery = place.display_name;
    this.searchResults.set([]);
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);

    this.customerLat = lat;
    this.customerLng = lng;

    if (this.customerMarker && this.map) {
      this.customerMarker.setLatLng([lat, lng]);
      this.map.setView([lat, lng], 14);
    }

    this.recalculate(lat, lng, place.display_name);
  }

  private reverseGeocodeAndRecalculate(lat: number, lng: number): void {
    this.shippingApi.reverseGeocodeNominatim(lat, lng).subscribe({
      next: (res: any) => {
        const addr =
          (typeof res === 'string' && res.trim() ? res : res?.display_name) ||
          `Tọa độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        this.searchQuery = addr;
        this.recalculate(lat, lng, addr);
      },
      error: () => {
        const fallback = `Tọa độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        this.searchQuery = fallback;
        this.recalculate(lat, lng, fallback);
      },
    });
  }

  recalculate(lat: number, lng: number, address: string): void {
    this.isCalculating.set(true);
    this.shippingApi.calculate(lat, lng, this.subtotal).subscribe({
      next: (res) => {
        this.isCalculating.set(false);
        if (res.success && res.data) {
          const data = res.data;
          this.calculationResult.set(data);

          // Vẽ tuyến đường OSRM
          this.drawRoute(data.routeGeometry);

          if (data.supported) {
            this.locationChanged.emit({
              address: address || this.searchQuery,
              lat,
              lng,
              result: data,
            });
          } else {
            this.outOfRange.emit({
              message: data.message || 'Vượt quá bán kính 10km.',
              distanceKm: data.distanceKm,
            });
          }
        }
      },
      error: (err) => {
        this.isCalculating.set(false);
        console.error('Calculation error:', err);
      },
    });
  }

  private drawRoute(geometry: any): void {
    if (!this.map) return;

    if (this.routeLine) {
      this.routeLine.remove();
      this.routeLine = null;
    }

    const wh = this.warehouse();
    const isOut = this.calculationResult()?.supported === false;

    if (geometry && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) {
      // OSRM coordinates are [lon, lat] -> Leaflet requires [lat, lon]
      const latLngs: [number, number][] = geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );
      this.routeLine = L.polyline(latLngs, {
        color: isOut ? '#dc2626' : '#16a34a',
        weight: 4.5,
        opacity: 0.85,
        dashArray: isOut ? '8, 8' : undefined,
      }).addTo(this.map);

      this.map.fitBounds(this.routeLine.getBounds(), { padding: [40, 40] });
    } else {
      // Straight line fallback
      this.routeLine = L.polyline(
        [
          [wh.lat, wh.lng],
          [this.customerLat, this.customerLng],
        ],
        {
          color: isOut ? '#dc2626' : '#16a34a',
          weight: 3.5,
          opacity: 0.75,
          dashArray: '6, 6',
        }
      ).addTo(this.map);

      this.map.fitBounds(this.routeLine.getBounds(), { padding: [40, 40] });
    }
  }

  formatPrice(num: number | undefined): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }
}

