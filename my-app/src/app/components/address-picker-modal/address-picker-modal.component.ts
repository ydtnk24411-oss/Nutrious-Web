import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { XanhLaAddress } from '../../shared/models/xanh-la.models';
import { LocationService, ProvinceItem, WardItem } from '../../shared/services/location.service';
import { NominatimPlace, ShippingApiService } from '../../shared/services/shipping-api.service';

export const PROVINCE_CENTERS: Record<string, { lat: number; lng: number }> = {
  'Hồ Chí Minh': { lat: 10.8231, lng: 106.6297 },
  'Hà Nội': { lat: 21.0285, lng: 105.8542 },
  'Đà Nẵng': { lat: 16.0544, lng: 108.2022 },
  'Bình Dương': { lat: 10.9804, lng: 106.6519 },
  'Đồng Nai': { lat: 10.9574, lng: 106.8427 },
  'Cần Thơ': { lat: 10.0452, lng: 105.7469 },
  'Hải Phòng': { lat: 20.8449, lng: 106.6881 },
  'Bà Rịa': { lat: 10.4114, lng: 107.1362 },
  'Long An': { lat: 10.5362, lng: 106.4116 },
  'Tây Ninh': { lat: 11.3347, lng: 106.0989 },
  'Tiền Giang': { lat: 10.4493, lng: 106.3421 },
  'Bến Tre': { lat: 10.2433, lng: 106.3753 },
  'Vĩnh Long': { lat: 10.2537, lng: 105.9722 },
  'Đồng Tháp': { lat: 10.4576, lng: 105.6329 },
  'An Giang': { lat: 10.3888, lng: 105.4359 },
  'Kiên Giang': { lat: 9.9482, lng: 105.1492 },
  'Hậu Giang': { lat: 9.7844, lng: 105.4701 },
  'Sóc Trăng': { lat: 9.6033, lng: 105.9745 },
  'Bạc Liêu': { lat: 9.2941, lng: 105.7278 },
  'Cà Mau': { lat: 9.1769, lng: 105.1524 },
  'Trà Vinh': { lat: 9.9347, lng: 106.3455 },
  'Lâm Đồng': { lat: 11.9404, lng: 108.4583 },
  'Khánh Hòa': { lat: 12.2388, lng: 109.1967 },
  'Đắk Lắk': { lat: 12.6667, lng: 108.05 },
  'Đắk Nông': { lat: 12.0044, lng: 107.6875 },
  'Gia Lai': { lat: 13.9833, lng: 108.0 },
  'Kon Tum': { lat: 14.35, lng: 108.0 },
  'Bình Thuận': { lat: 10.9333, lng: 108.1 },
  'Ninh Thuận': { lat: 11.5667, lng: 108.9833 },
  'Bình Phước': { lat: 11.7511, lng: 106.9066 },
  'Thừa Thiên Huế': { lat: 16.4637, lng: 107.5909 },
  'Quảng Nam': { lat: 15.5667, lng: 108.2 },
  'Quảng Ngãi': { lat: 15.1167, lng: 108.8 },
  'Bình Định': { lat: 13.7833, lng: 109.2167 },
  'Phú Yên': { lat: 13.0833, lng: 109.3 },
  'Nghệ An': { lat: 18.6667, lng: 105.6667 },
  'Thanh Hóa': { lat: 19.8, lng: 105.7833 },
  'Hà Tĩnh': { lat: 18.3333, lng: 105.9 },
  'Quảng Bình': { lat: 17.4833, lng: 106.6 },
  'Quảng Trị': { lat: 16.8167, lng: 107.1 },
};

export interface AddressPickerResult {
  fullAddress: string;
  street: string;
  provinceName: string;
  provinceCode?: number;
  wardName: string;
  wardCode?: number;
  lat: number;
  lng: number;
  receiverName: string;
  receiverPhone: string;
  otherReceiverChecked: boolean;
  label: string;
  isDefault: boolean;
  isGps: boolean;
}

@Component({
  selector: 'app-address-picker-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './address-picker-modal.component.html',
  styleUrl: './address-picker-modal.component.css',
})
export class AddressPickerModalComponent implements OnChanges, OnDestroy {
  private locationService = inject(LocationService);
  private shippingApi = inject(ShippingApiService);

  @Input() open = false;
  @Input() mode: 'checkout' | 'addressBook' = 'checkout';
  @Input() defaultReceiverName = '';
  @Input() defaultReceiverPhone = '';
  @Input() servedProvinces: string[] = [];
  @Input() initialAddress: Partial<XanhLaAddress> | null = null;
  @Input() forceDefaultOnNew = false;

  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<AddressPickerResult>();

  protected view = signal<'form' | 'province' | 'ward' | 'map'>('form');

  // Province & Ward pickers
  protected provincesList = signal<ProvinceItem[]>([]);
  protected provinceSearch = signal('');
  protected showOldProvinceNames = signal(false);
  protected selectedProvince = signal<ProvinceItem | null>(null);

  protected wardsList = signal<WardItem[]>([]);
  protected wardSearch = signal('');
  protected selectedWard = signal<WardItem | null>(null);

  protected streetInput = signal('');

  // Address Book metadata (used when mode === 'addressBook')
  protected addrLabel = signal('Nhà riêng');
  protected addrIsDefault = signal(false);

  // Checkout "other receiver" controls (used when mode === 'checkout')
  protected otherReceiverChecked = signal(false);
  protected otherReceiverName = signal('');
  protected otherReceiverPhone = signal('');

  // Autocomplete suggestions
  protected streetSuggestions = signal<NominatimPlace[]>([]);
  protected isSearchingSuggestions = signal(false);
  protected showSuggestionsDropdown = signal(false);
  protected selectedSuggestion = signal<NominatimPlace | null>(null);
  private searchStreetTimer: ReturnType<typeof setTimeout> | null = null;

  // GPS & Map confirmation state
  protected isLocating = signal(false);
  protected locationError = signal('');
  protected isGeocoding = signal(false);
  protected mapConfirmLat = signal<number>(10.8703);
  protected mapConfirmLng = signal<number>(106.7782);
  protected userEnteredAddress = signal<string>('');
  protected referenceAddress = signal<string>('');
  protected wardCenterCoords = signal<{ lat: number; lng: number } | null>(null);
  protected matchQuality = signal<'exact' | 'street_match' | 'approximate' | 'manual' | 'gps'>('exact');
  protected isMapResolving = signal(false);

  private confirmMap: L.Map | null = null;
  private confirmMarker: L.Marker | null = null;

  protected readonly modalTitle = computed(() => {
    if (this.mode === 'checkout') return 'Địa chỉ nhận hàng';
    return this.initialAddress?.id ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới';
  });

  protected readonly modalSubtitle = computed(() =>
    this.mode === 'checkout'
      ? 'Thông tin vị trí giúp Evergreen Mart giao hàng đúng giờ và tính phí giao chính xác hơn.'
      : 'Chọn Tỉnh/Thành phố, Phường/Xã, nhập số nhà và ghim vị trí chính xác trên bản đồ.'
  );

  protected readonly servedProvincesSummary = computed<string>(() =>
    (this.servedProvinces || [])
      .map((p) => p.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim())
      .join(', ')
  );

  protected readonly isSelectedProvinceServed = computed<boolean>(() => {
    if (this.mode !== 'checkout' || !this.servedProvinces?.length) return true;
    const prov = this.selectedProvince();
    if (!prov?.name) return true;
    const normTarget = this.normalizeSearchText(prov.name).replace(/^(tinh|thanh pho|tp)\s+/i, '').trim();
    return this.servedProvinces.some((sp) => {
      const normSp = this.normalizeSearchText(sp).replace(/^(tinh|thanh pho|tp)\s+/i, '').trim();
      return normSp === normTarget || normSp.includes(normTarget) || normTarget.includes(normSp);
    });
  });

  protected readonly filteredProvinces = computed(() => {
    const q = this.provinceSearch().trim().toLowerCase();
    const list = this.provincesList();
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q) || (p.codename && p.codename.includes(q)));
  });

  protected readonly filteredWards = computed(() => {
    const q = this.wardSearch().trim().toLowerCase();
    const list = this.wardsList();
    if (!q) return list;
    return list.filter((w) => w.name.toLowerCase().includes(q) || (w.codename && w.codename.includes(q)));
  });

  protected readonly currentReceiverName = computed(() => {
    if (this.mode === 'addressBook') {
      return this.initialAddress?.fullName || this.defaultReceiverName || 'Khách hàng';
    }
    if (this.otherReceiverChecked() && this.otherReceiverName().trim()) {
      return this.otherReceiverName().trim();
    }
    return this.defaultReceiverName || 'Khách hàng';
  });

  protected readonly currentReceiverPhone = computed(() => {
    if (this.mode === 'addressBook') {
      return this.initialAddress?.phone || this.defaultReceiverPhone || '';
    }
    if (this.otherReceiverChecked() && this.otherReceiverPhone().trim()) {
      return this.otherReceiverPhone().trim();
    }
    return this.defaultReceiverPhone || '';
  });

  protected readonly canProceedToMap = computed(() => {
    const hasProvince = !!this.selectedProvince();
    const hasWard = !!this.selectedWard();
    const hasStreet = !!this.streetInput().trim();
    if (!hasProvince || !hasWard || !hasStreet) return false;
    if (this.mode === 'checkout' && this.otherReceiverChecked()) {
      if (!this.otherReceiverName().trim() || !this.otherReceiverPhone().trim()) return false;
    }
    return true;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.resetForOpen();
      } else {
        this.cleanupModalState();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.searchStreetTimer) clearTimeout(this.searchStreetTimer);
    this.destroyConfirmMap();
  }

  private resetForOpen(): void {
    this.view.set('form');
    this.locationError.set('');
    this.showSuggestionsDropdown.set(false);
    this.streetSuggestions.set([]);
    this.selectedSuggestion.set(null);
    this.referenceAddress.set('');

    const init = this.initialAddress;
    this.addrLabel.set(init?.label || 'Nhà riêng');
    this.addrIsDefault.set(init ? Boolean(init.isDefault) : this.forceDefaultOnNew);
    this.otherReceiverChecked.set(false);
    this.otherReceiverName.set('');
    this.otherReceiverPhone.set('');

    this.userEnteredAddress.set(init?.address || '');
    this.streetInput.set(init?.street || (!init?.province && init?.address ? init.address : ''));
    if (init?.lat && init?.lng) {
      this.mapConfirmLat.set(init.lat);
      this.mapConfirmLng.set(init.lng);
    } else {
      this.mapConfirmLat.set(10.8703);
      this.mapConfirmLng.set(106.7782);
    }

    if (this.provincesList().length === 0) {
      this.loadProvinces(init);
    } else {
      this.applyInitialProvinceAndWard(this.provincesList(), init);
    }
  }

  private cleanupModalState(): void {
    this.view.set('form');
    this.showSuggestionsDropdown.set(false);
    this.streetSuggestions.set([]);
    this.destroyConfirmMap();
  }

  close(): void {
    this.cleanupModalState();
    this.closed.emit();
  }

  private loadProvinces(init?: Partial<XanhLaAddress> | null): void {
    this.locationService.getProvinces().subscribe({
      next: (data) => {
        this.provincesList.set(data);
        this.applyInitialProvinceAndWard(data, init);
      },
      error: (err) => console.error('Lỗi tải Tỉnh/Thành phố:', err),
    });
  }

  private applyInitialProvinceAndWard(provinces: ProvinceItem[], init?: Partial<XanhLaAddress> | null): void {
    const targetProvName = init?.province || init?.city || '';
    let matchedProv = init?.provinceCode
      ? provinces.find((p) => p.code === init.provinceCode)
      : undefined;
    if (!matchedProv && targetProvName) {
      const norm = this.normalizeSearchText(targetProvName);
      matchedProv = provinces.find((p) => {
        const pNorm = this.normalizeSearchText(p.name);
        return pNorm === norm || pNorm.includes(norm) || norm.includes(pNorm);
      });
    }
    if (!matchedProv) {
      matchedProv = this.selectedProvince() ?? provinces.find((p) => p.name.includes('Hồ Chí Minh') || p.code === 79);
    }

    if (matchedProv) {
      this.selectedProvince.set(matchedProv);
      this.loadWards(matchedProv.code, init);
    }
  }

  loadWards(provinceCode: number, init?: Partial<XanhLaAddress> | null): void {
    this.locationService.getWards(provinceCode).subscribe({
      next: (data) => {
        this.wardsList.set(data);
        if (init?.wardCode || init?.ward) {
          const matchedWard =
            (init.wardCode ? data.find((w) => w.code === init.wardCode) : undefined) ||
            (init.ward
              ? data.find((w) => this.normalizeSearchText(w.name) === this.normalizeSearchText(init.ward || ''))
              : undefined);
          if (matchedWard) {
            this.selectedWard.set(matchedWard);
            if (!init.lat || !init.lng) {
              this.resolveWardCenter(matchedWard);
            }
          }
        } else if (init && !init.ward && this.selectedWard()?.provinceCode !== provinceCode) {
          this.selectedWard.set(null);
        }
      },
      error: (err) => console.error('Lỗi tải Phường/Xã:', err),
    });
  }

  openProvincePicker(): void {
    this.provinceSearch.set('');
    this.view.set('province');
  }

  selectProvince(p: ProvinceItem): void {
    this.selectedProvince.set(p);
    this.selectedWard.set(null);
    this.wardCenterCoords.set(null);
    this.streetSuggestions.set([]);
    this.showSuggestionsDropdown.set(false);
    this.selectedSuggestion.set(null);
    this.loadWards(p.code);
    this.view.set('form');
  }

  openWardPicker(): void {
    if (!this.selectedProvince()) return;
    this.wardSearch.set('');
    this.view.set('ward');
  }

  selectWard(w: WardItem): void {
    this.selectedWard.set(w);
    this.streetSuggestions.set([]);
    this.showSuggestionsDropdown.set(false);
    this.selectedSuggestion.set(null);
    this.view.set('form');
    this.resolveWardCenter(w);
  }

  private resolveWardCenter(w: WardItem): void {
    const prov = this.selectedProvince();
    const bias = this.getProvinceBiasCoords();
    const provName = prov?.name || '';
    const query = `${w.name}, ${provName}, Việt Nam`;

    this.shippingApi.searchAddressNominatim(query, bias.lat, bias.lng).subscribe({
      next: (places) => {
        const match = places.find((p) => this.isProvinceMatch(p, provName));
        if (match) {
          this.wardCenterCoords.set({ lat: parseFloat(match.lat), lng: parseFloat(match.lon) });
        } else if (places.length > 0) {
          this.wardCenterCoords.set({ lat: parseFloat(places[0].lat), lng: parseFloat(places[0].lon) });
        } else {
          this.wardCenterCoords.set(bias);
        }
      },
      error: () => this.wardCenterCoords.set(bias),
    });
  }

  backToForm(): void {
    this.view.set('form');
    this.destroyConfirmMap();
  }

  getCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.locationError.set('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    this.isLocating.set(true);
    this.locationError.set('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.mapConfirmLat.set(lat);
        this.mapConfirmLng.set(lng);

        this.shippingApi.reverseGeocodeNominatim(lat, lng).subscribe({
          next: (resolved) => {
            this.isLocating.set(false);
            const addressString = resolved || `Vị trí tọa độ (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
            this.userEnteredAddress.set(addressString);
            this.referenceAddress.set(addressString);
            this.matchQuality.set('gps');
            this.view.set('map');
            this.initConfirmMap();
          },
          error: () => {
            this.isLocating.set(false);
            const addressString = `Vị trí tọa độ (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
            this.userEnteredAddress.set(addressString);
            this.referenceAddress.set(addressString);
            this.matchQuality.set('gps');
            this.view.set('map');
            this.initConfirmMap();
          },
        });
      },
      (err) => {
        this.isLocating.set(false);
        let msg = 'Không thể lấy vị trí hiện tại.';
        if (err.code === 1) {
          msg = 'Bạn đã từ chối cấp quyền vị trí. Vui lòng bật vị trí hoặc chọn Tỉnh/Thành bên dưới.';
        } else if (err.code === 2) {
          msg = 'Không tìm thấy tín hiệu vị trí.';
        } else if (err.code === 3) {
          msg = 'Quá thời gian lấy vị trí GPS. Vui lòng thử lại.';
        }
        this.locationError.set(msg);
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  }

  private getProvinceBiasCoords(): { lat: number; lng: number } {
    const prov = this.selectedProvince();
    if (prov) {
      for (const [key, coords] of Object.entries(PROVINCE_CENTERS)) {
        if (prov.name.includes(key) || key.includes(prov.name)) {
          return coords;
        }
      }
    }
    return { lat: 10.8703, lng: 106.7782 };
  }

  private normalizeSearchText(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
  }

  private isProvinceMatch(p: NominatimPlace, provName: string): boolean {
    if (!provName) return true;
    const normProv = this.normalizeSearchText(provName).replace(/^(tinh|thanh pho|tp)\s+/i, '').trim();
    const allText = this.normalizeSearchText(`${p.state || ''} ${p.city || ''} ${p.district || ''} ${p.subtitle || ''} ${p.display_name}`);

    if (normProv.includes('ho chi minh') || normProv === 'hcm') {
      return allText.includes('ho chi minh') || allText.includes('hcm') || allText.includes('sai gon') || allText.includes('thu duc');
    }
    return allText.includes(normProv);
  }

  private parseAddressInput(rawInput: string, provName: string, wardName: string): {
    rawInput: string;
    cleanedText: string;
    fullNumber: string | null;
    baseNumber: string | null;
    streetName: string;
  } {
    let text = (rawInput || '').trim();

    const toStrip: string[] = [];
    if (provName) {
      toStrip.push(provName);
      const unPrefixed = provName.replace(/^(tỉnh|thành phố|tp)\s+/i, '').trim();
      toStrip.push(unPrefixed);
      toStrip.push(this.normalizeSearchText(unPrefixed));
    }
    if (wardName) {
      toStrip.push(wardName);
      const unPrefixedW = wardName.replace(/^(phường|xã|thị trấn)\s+/i, '').trim();
      toStrip.push(unPrefixedW);
      toStrip.push(this.normalizeSearchText(unPrefixedW));
    }
    toStrip.push('việt nam', 'viet nam', 'nha trang', 'hồ chí minh', 'hcm', 'hà nội', 'đà nẵng', 'khánh hòa');

    for (const s of toStrip) {
      if (!s || s.length < 2) continue;
      const escaped = s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      const rx = new RegExp('(\\s*,?\\s*)\\b' + escaped + '(\\b|$)', 'gi');
      text = text.replace(rx, ' ').trim();
    }
    text = text.replace(/[\s,]+$/g, '').trim();

    const numMatch = text.match(/^(?:(?:so|số|hẻm|hem|ngách|ngach|ngõ|ngo|thôn|thon|tổ|to|ấp|ap)\s*)?([0-9]+[a-zA-Z]?(?:\/[0-9]+[a-zA-Z]?)*)\b(?:\s*,?\s*(?:đường|duong)\b|\s*,?\s*)/i);

    let fullNumber: string | null = null;
    let baseNumber: string | null = null;
    let streetName = text;

    if (numMatch) {
      fullNumber = numMatch[1];
      baseNumber = fullNumber.split('/')[0].replace(/[^\d]/g, '') || null;
      streetName = text.substring(numMatch[0].length).trim();
    }

    streetName = streetName.replace(/^(đường|duong)\s+/i, '').trim();
    streetName = streetName.replace(/[\s,]+$/g, '').trim();

    return {
      rawInput,
      cleanedText: text,
      fullNumber,
      baseNumber,
      streetName,
    };
  }

  private matchesStreetPhrase(pText: string, streetName: string): boolean {
    if (!streetName || streetName.length < 2) return true;
    const normStreet = this.normalizeSearchText(streetName);
    const cleanPText = this.normalizeSearchText(pText);

    if (normStreet.length >= 3 && cleanPText.includes(normStreet)) {
      return true;
    }

    const streetTokens = normStreet
      .split(/\s+/)
      .filter((w) => w.length > 1 && !['duong', 'so', 'nha', 'hem', 'ngach'].includes(w));
    if (streetTokens.length === 0) return true;

    const pWords = cleanPText.split(/\s+/);
    return streetTokens.every((tok) => pWords.includes(tok));
  }

  private scoreCandidatePlace(
    place: NominatimPlace,
    parsed: { fullNumber: string | null; baseNumber: string | null; streetName: string },
    provName: string
  ): number {
    const pText = `${place.title || ''} ${place.streetName || ''} ${place.display_name || ''}`;

    if (!this.isProvinceMatch(place, provName)) return -1;
    if (parsed.streetName && parsed.streetName.length >= 3 && !this.matchesStreetPhrase(pText, parsed.streetName)) {
      return -1;
    }

    let score = 100;
    const cleanPText = this.normalizeSearchText(pText);
    const foundNums: string[] = (place.title || '').match(/\d+/g) || [];

    if (parsed.fullNumber && cleanPText.includes(this.normalizeSearchText(parsed.fullNumber))) {
      score += 1000;
    } else if (parsed.baseNumber && foundNums.includes(parsed.baseNumber)) {
      score += 800;
    } else if (parsed.baseNumber && foundNums.length > 0) {
      const target = parseInt(parsed.baseNumber, 10);
      let minDiff = 9999;
      for (const fn of foundNums) {
        const diff = Math.abs(parseInt(fn, 10) - target);
        if (diff < minDiff) minDiff = diff;
      }
      score += Math.max(200, 600 - minDiff * 2);
    } else {
      score += 300;
    }

    return score;
  }

  onStreetInput(val: string): void {
    this.streetInput.set(val);
    this.selectedSuggestion.set(null);

    if (this.searchStreetTimer) {
      clearTimeout(this.searchStreetTimer);
    }

    const query = val.trim();
    if (query.length < 2) {
      this.streetSuggestions.set([]);
      this.showSuggestionsDropdown.set(false);
      this.isSearchingSuggestions.set(false);
      return;
    }

    this.isSearchingSuggestions.set(true);
    this.searchStreetTimer = setTimeout(() => {
      const prov = this.selectedProvince();
      const ward = this.selectedWard();
      const wardCenter = this.wardCenterCoords();
      const bias = wardCenter || this.getProvinceBiasCoords();
      const provName = prov?.name || '';
      const wardName = ward?.name || '';

      const parsed = this.parseAddressInput(query, provName, wardName);
      const searchTarget = parsed.baseNumber
        ? `${parsed.baseNumber} ${parsed.streetName || query}`
        : (parsed.streetName || query);

      const searchQuery = provName ? `${searchTarget}, ${provName}` : searchTarget;

      this.shippingApi.searchAddressNominatim(searchQuery, bias.lat, bias.lng).subscribe({
        next: (places) => {
          const filtered = (places || []).filter((p) => {
            const pText = `${p.title || ''} ${p.streetName || ''} ${p.display_name || ''}`;
            if (!this.isProvinceMatch(p, provName)) return false;
            if (parsed.streetName && parsed.streetName.length >= 3) {
              if (!this.matchesStreetPhrase(pText, parsed.streetName)) return false;
            }
            return true;
          });

          const ranked = [...filtered].sort(
            (a, b) => this.scoreCandidatePlace(b, parsed, provName) - this.scoreCandidatePlace(a, parsed, provName)
          );

          this.isSearchingSuggestions.set(false);
          this.streetSuggestions.set(ranked);
          this.showSuggestionsDropdown.set(ranked.length > 0);
        },
        error: () => {
          this.isSearchingSuggestions.set(false);
          this.streetSuggestions.set([]);
          this.showSuggestionsDropdown.set(false);
        },
      });
    }, 280);
  }

  onStreetFocus(): void {
    if (this.streetSuggestions().length > 0) {
      this.showSuggestionsDropdown.set(true);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showSuggestionsDropdown()) return;
    const target = event.target as HTMLElement;
    if (target && !target.closest('.bhx-street-input-wrap')) {
      this.showSuggestionsDropdown.set(false);
    }
  }

  dismissSuggestions(): void {
    this.showSuggestionsDropdown.set(false);
  }

  onStreetEnter(e: Event): void {
    e.preventDefault();
    this.dismissSuggestions();
    if (this.canProceedToMap()) {
      this.proceedToMapConfirmation();
    }
  }

  clearStreetInput(): void {
    this.streetInput.set('');
    this.streetSuggestions.set([]);
    this.showSuggestionsDropdown.set(false);
    this.selectedSuggestion.set(null);
  }

  selectStreetSuggestion(item: NominatimPlace): void {
    this.selectedSuggestion.set(item);
    this.mapConfirmLat.set(parseFloat(item.lat));
    this.mapConfirmLng.set(parseFloat(item.lon));

    const displayStreet = item.title || item.streetName || item.display_name.split(',')[0] || item.display_name;
    this.streetInput.set(displayStreet);

    this.showSuggestionsDropdown.set(false);
    this.streetSuggestions.set([]);
  }

  proceedToMapConfirmation(): void {
    const prov = this.selectedProvince();
    const ward = this.selectedWard();
    const street = this.streetInput().trim();

    if (!prov || !ward || !street) return;

    this.showSuggestionsDropdown.set(false);

    const fullEnteredAddress = `${street}, ${ward.name}, ${prov.name}`;
    this.userEnteredAddress.set(fullEnteredAddress);

    const parsed = this.parseAddressInput(street, prov.name, ward.name);
    const wardCenter = this.wardCenterCoords();
    const bias = wardCenter || this.getProvinceBiasCoords();

    const chosen = this.selectedSuggestion();
    if (chosen && chosen.lat && chosen.lon) {
      const chosenText = `${chosen.title || ''} ${chosen.streetName || ''} ${chosen.display_name || ''}`;
      if (this.matchesStreetPhrase(chosenText, parsed.streetName)) {
        const lat = parseFloat(chosen.lat);
        const lng = parseFloat(chosen.lon);
        this.mapConfirmLat.set(lat);
        this.mapConfirmLng.set(lng);
        this.matchQuality.set('exact');
        this.resolveReferenceAddress(lat, lng);
        this.view.set('map');
        this.initConfirmMap();
        return;
      }
    }

    this.isGeocoding.set(true);

    const queryBaseNumber = parsed.baseNumber
      ? `${parsed.baseNumber} ${parsed.streetName}, ${prov.name}`
      : `${parsed.streetName || street}, ${prov.name}`;

    this.shippingApi.searchAddressNominatim(queryBaseNumber, bias.lat, bias.lng).subscribe({
      next: (places) => {
        const matchingPlaces = (places || []).filter((p) => {
          const pText = `${p.title || ''} ${p.streetName || ''} ${p.display_name || ''}`;
          return this.isProvinceMatch(p, prov.name) && this.matchesStreetPhrase(pText, parsed.streetName);
        });

        if (matchingPlaces.length > 0) {
          matchingPlaces.sort((a, b) => this.scoreCandidatePlace(b, parsed, prov.name) - this.scoreCandidatePlace(a, parsed, prov.name));
          const best = matchingPlaces[0];
          const lat = parseFloat(best.lat);
          const lng = parseFloat(best.lon);
          this.mapConfirmLat.set(lat);
          this.mapConfirmLng.set(lng);
          this.matchQuality.set(parsed.baseNumber ? 'street_match' : 'exact');
          this.isGeocoding.set(false);
          this.resolveReferenceAddress(lat, lng);
          this.view.set('map');
          this.initConfirmMap();
          return;
        }

        const queryStreetOnly = `${parsed.streetName || street}, ${prov.name}`;
        this.shippingApi.searchAddressNominatim(queryStreetOnly, bias.lat, bias.lng).subscribe({
          next: (places2) => {
            const streetPlaces = (places2 || []).filter((p) => {
              const pText = `${p.title || ''} ${p.streetName || ''} ${p.display_name || ''}`;
              return this.isProvinceMatch(p, prov.name) && this.matchesStreetPhrase(pText, parsed.streetName);
            });

            if (streetPlaces.length > 0) {
              const bestStreet = streetPlaces[0];
              const lat = parseFloat(bestStreet.lat);
              const lng = parseFloat(bestStreet.lon);
              this.mapConfirmLat.set(lat);
              this.mapConfirmLng.set(lng);
              this.matchQuality.set('street_match');
              this.isGeocoding.set(false);
              this.resolveReferenceAddress(lat, lng);
              this.view.set('map');
              this.initConfirmMap();
              return;
            }

            this.fallbackToWardCenter(bias);
          },
          error: () => this.fallbackToWardCenter(bias),
        });
      },
      error: () => this.fallbackToWardCenter(bias),
    });
  }

  private fallbackToWardCenter(bias: { lat: number; lng: number }): void {
    const wardCenter = this.wardCenterCoords() || bias;
    this.isGeocoding.set(false);
    this.mapConfirmLat.set(wardCenter.lat);
    this.mapConfirmLng.set(wardCenter.lng);
    this.matchQuality.set('approximate');
    this.resolveReferenceAddress(wardCenter.lat, wardCenter.lng);
    this.view.set('map');
    this.initConfirmMap();
  }

  private initConfirmMap(): void {
    setTimeout(() => {
      const el = document.getElementById('bhxConfirmMap');
      if (!el) return;

      this.destroyConfirmMap();

      const lat = this.mapConfirmLat();
      const lng = this.mapConfirmLng();

      this.confirmMap = L.map(el, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
      });

      const cartoKey = 'cb1_52qy_1_f631c7c88a518151e7549366';
      L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`, {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(this.confirmMap);

      const redPinIcon = L.divIcon({
        className: 'bhx-confirm-pin',
        html: `
          <div style="background:#e11d48;color:#fff;width:38px;height:38px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.35);border:2px solid #fff;cursor:grab;">
            <div style="width:12px;height:12px;background:#fff;border-radius:50%;transform:rotate(45deg);"></div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      this.confirmMarker = L.marker([lat, lng], {
        icon: redPinIcon,
        draggable: true,
      }).addTo(this.confirmMap);

      this.confirmMarker.on('dragend', () => {
        const pos = this.confirmMarker?.getLatLng();
        if (pos) {
          this.mapConfirmLat.set(pos.lat);
          this.mapConfirmLng.set(pos.lng);
          this.matchQuality.set('manual');
          this.resolveReferenceAddress(pos.lat, pos.lng);
        }
      });

      this.confirmMap.on('click', (e: L.LeafletMouseEvent) => {
        this.mapConfirmLat.set(e.latlng.lat);
        this.mapConfirmLng.set(e.latlng.lng);
        this.confirmMarker?.setLatLng(e.latlng);
        this.matchQuality.set('manual');
        this.resolveReferenceAddress(e.latlng.lat, e.latlng.lng);
      });

      this.confirmMap.invalidateSize();
    }, 150);
  }

  private resolveReferenceAddress(lat: number, lng: number): void {
    this.isMapResolving.set(true);
    this.shippingApi.reverseGeocodeNominatim(lat, lng).subscribe({
      next: (addr) => {
        this.isMapResolving.set(false);
        this.referenceAddress.set(addr || `Tọa độ (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      },
      error: () => {
        this.isMapResolving.set(false);
        this.referenceAddress.set(`Tọa độ (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      },
    });
  }

  private destroyConfirmMap(): void {
    if (this.confirmMap) {
      this.confirmMap.remove();
      this.confirmMap = null;
      this.confirmMarker = null;
    }
  }

  confirmComplete(): void {
    const finalAddr =
      this.userEnteredAddress().trim() ||
      [this.streetInput().trim(), this.selectedWard()?.name, this.selectedProvince()?.name].filter(Boolean).join(', ') ||
      this.referenceAddress().trim();

    this.confirmed.emit({
      fullAddress: finalAddr,
      street: this.streetInput().trim(),
      provinceName: this.selectedProvince()?.name || '',
      provinceCode: this.selectedProvince()?.code,
      wardName: this.selectedWard()?.name || '',
      wardCode: this.selectedWard()?.code,
      lat: this.mapConfirmLat(),
      lng: this.mapConfirmLng(),
      receiverName: this.currentReceiverName(),
      receiverPhone: this.currentReceiverPhone(),
      otherReceiverChecked: this.otherReceiverChecked(),
      label: this.addrLabel(),
      isDefault: this.addrIsDefault(),
      isGps: this.matchQuality() === 'gps',
    });

    this.close();
  }
}
