import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BannerApiService, HeroSlide, PromoPopup, BannerConfigData } from '../../shared/services/banner-api.service';
import { AdminAuthService } from '../../shared/services/admin-auth.service';
import { API_BASE } from '../../shared/services/api.service';

@Component({
  selector: 'app-admin-banners',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './banners.component.html',
  styleUrl: './banners.component.css',
})
export class AdminBannersComponent implements OnInit {
  private bannerApi = inject(BannerApiService);
  protected auth = inject(AdminAuthService);
  private readonly backendOrigin = API_BASE.replace(/\/api\/?$/, '');

  resolveBannerImage(raw?: string): string {
    const clean = (raw || '').trim();
    if (!clean) return '';
    if (clean.startsWith('/')) return `${this.backendOrigin}${clean}`;
    return clean;
  }

  activeTab = signal<'hero' | 'popup'>('hero');
  loading = signal(false);
  saving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  // Slides State
  slides = signal<HeroSlide[]>([]);
  activePreviewIndex = signal(0);

  // Popup State
  popup = signal<PromoPopup>({
    title: '',
    description: '',
    image: '',
    badge: 'ƯU ĐÃI ĐẶC BIỆT',
    voucherCode: 'EVG20K',
    buttonText: 'Lưu mã & Mua sắm',
    buttonLink: '/vouchers',
    enabled: false,
  });

  // Modal Slide Editor
  modalOpen = signal(false);
  isEditingSlide = signal(false);
  editIndex = signal(-1);
  slideImageMode = signal<'file' | 'url'>('file');
  popupImageMode = signal<'file' | 'url'>('file');
  uploadingTarget = signal<'slide' | 'popup' | null>(null);
  uploadErrorMsg = signal('');
  slideForm = signal<HeroSlide>({
    title: '',
    subtitle: '',
    eyebrow: 'TƯƠI SẠCH MỖI NGÀY - GIAO NHANH 2H',
    cta: 'Mua sắm ngay',
    link: '/online-ordering',
    image: '',
    active: true,
    sortOrder: 1,
  });

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig(): void {
    this.loading.set(true);
    this.bannerApi.getConfig().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.slides.set(res.data.heroSlides || []);
          if (res.data.promoPopup) {
            this.popup.set(res.data.promoPopup);
            this.popupImageMode.set(
              res.data.promoPopup.image?.startsWith('/api/banners/media/') || !res.data.promoPopup.image ? 'file' : 'url'
            );
          }
        }
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Không thể tải cấu hình Banner.');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: 'hero' | 'popup'): void {
    this.activeTab.set(tab);
  }

  // Slide actions
  openAddSlide(): void {
    this.isEditingSlide.set(false);
    this.editIndex.set(-1);
    this.uploadErrorMsg.set('');
    this.slideImageMode.set('file');
    this.slideForm.set({
      title: '',
      subtitle: '',
      eyebrow: 'TƯƠI SẠCH MỖI NGÀY - GIAO NHANH 2H',
      cta: 'Mua sắm ngay',
      link: '/online-ordering',
      image: '',
      active: true,
      sortOrder: (this.slides().length + 1),
    });
    this.modalOpen.set(true);
  }

  openEditSlide(index: number): void {
    this.isEditingSlide.set(true);
    this.editIndex.set(index);
    this.uploadErrorMsg.set('');
    const item = this.slides()[index];
    this.slideImageMode.set(item?.image?.startsWith('/api/banners/media/') || !item?.image ? 'file' : 'url');
    this.slideForm.set({ ...item });
    this.modalOpen.set(true);
  }

  onImageFileSelected(event: Event, target: 'slide' | 'popup'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.uploadImageFile(file, target);
    }
  }

  onImageDrop(event: DragEvent, target: 'slide' | 'popup'): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.uploadImageFile(file, target);
    }
  }

  clearImage(target: 'slide' | 'popup'): void {
    this.uploadErrorMsg.set('');
    if (target === 'slide') {
      this.slideForm.update((f) => ({ ...f, image: '' }));
    } else {
      this.popup.update((p) => ({ ...p, image: '' }));
    }
  }

  private uploadImageFile(file: File, target: 'slide' | 'popup'): void {
    this.uploadErrorMsg.set('');
    if (!file.type.startsWith('image/')) {
      this.uploadErrorMsg.set('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WEBP, GIF, AVIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadErrorMsg.set('Kích thước ảnh tối đa là 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        this.uploadErrorMsg.set('Không thể đọc dữ liệu ảnh đã chọn.');
        return;
      }
      this.uploadingTarget.set(target);
      this.bannerApi.uploadImage(dataUrl, file.name).subscribe({
        next: (res) => {
          this.uploadingTarget.set(null);
          const url = res?.data?.url || '';
          if (res.success && url) {
            if (target === 'slide') {
              this.slideForm.update((f) => ({ ...f, image: url }));
            } else {
              this.popup.update((p) => ({ ...p, image: url }));
            }
            const saveHint = target === 'slide'
              ? 'Đã tải ảnh lên MongoDB. Hãy bấm "Lưu Banner" để cập nhật lên trang chủ!'
              : 'Đã tải ảnh lên MongoDB. Hãy bấm "Lưu cấu hình Pop-up" để cập nhật lên trang chủ!';
            this.showSuccess(saveHint);
          } else {
            this.uploadErrorMsg.set('Tải ảnh thất bại. Vui lòng thử lại.');
          }
        },
        error: (err) => {
          this.uploadingTarget.set(null);
          this.uploadErrorMsg.set(err?.error?.message || 'Lỗi khi tải ảnh lên MongoDB.');
        },
      });
    };
    reader.onerror = () => {
      this.uploadErrorMsg.set('Không thể đọc tệp ảnh từ thiết bị.');
    };
    reader.readAsDataURL(file);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  saveSlide(): void {
    const form = this.slideForm();
    if (!form.title.trim() || !form.image.trim()) {
      alert('Vui lòng nhập tiêu đề và tải ảnh hoặc gắn link ảnh banner.');
      return;
    }

    const current = [...this.slides()];
    if (this.isEditingSlide() && this.editIndex() >= 0) {
      current[this.editIndex()] = { ...form };
    } else {
      current.push({ ...form });
    }

    this.saveSlidesToBackend(current);
    this.closeModal();
  }

  toggleSlideActive(index: number): void {
    const current = [...this.slides()];
    current[index].active = !current[index].active;
    this.saveSlidesToBackend(current);
  }

  deleteSlide(index: number): void {
    if (!confirm('Bạn có chắc chắn muốn xóa banner này?')) return;
    const current = this.slides().filter((_, i) => i !== index);
    this.saveSlidesToBackend(current);
  }

  private saveSlidesToBackend(slides: HeroSlide[]): void {
    this.saving.set(true);
    this.bannerApi.updateConfig({ heroSlides: slides }).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.slides.set(res.data.heroSlides);
          this.showSuccess('Đã lưu danh sách banner trượt thành công!');
        }
      },
      error: () => {
        this.saving.set(false);
        this.errorMsg.set('Lỗi khi lưu danh sách banner.');
      },
    });
  }

  // Popup actions
  togglePopup(): void {
    this.bannerApi.togglePopup().subscribe({
      next: (res) => {
        if (res.success) {
          this.popup.update((p) => ({ ...p, enabled: res.enabled }));
          this.showSuccess(res.message);
        }
      },
      error: () => alert('Lỗi khi cập nhật trạng thái Pop-up.'),
    });
  }

  savePopupConfig(): void {
    this.saving.set(true);
    this.bannerApi.updateConfig({ promoPopup: this.popup() }).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.popup.set(res.data.promoPopup);
          this.showSuccess('Đã cập nhật cấu hình Pop-up khuyến mãi thành công!');
        }
      },
      error: () => {
        this.saving.set(false);
        this.errorMsg.set('Lỗi khi lưu cấu hình Pop-up.');
      },
    });
  }

  private showSuccess(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(''), 3500);
  }
}
