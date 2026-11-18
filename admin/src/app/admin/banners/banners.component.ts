import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BannerApiService, HeroSlide, PromoPopup, BannerConfigData } from '../../shared/services/banner-api.service';
import { AdminAuthService } from '../../shared/services/admin-auth.service';

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
    this.slideForm.set({
      title: '',
      subtitle: '',
      eyebrow: 'TƯƠI SẠCH MỖI NGÀY - GIAO NHANH 2H',
      cta: 'Mua sắm ngay',
      link: '/online-ordering',
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=90',
      active: true,
      sortOrder: (this.slides().length + 1),
    });
    this.modalOpen.set(true);
  }

  openEditSlide(index: number): void {
    this.isEditingSlide.set(true);
    this.editIndex.set(index);
    const item = this.slides()[index];
    this.slideForm.set({ ...item });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  saveSlide(): void {
    const form = this.slideForm();
    if (!form.title.trim() || !form.image.trim()) {
      alert('Vui lòng nhập tiêu đề và link ảnh banner.');
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
