import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventApiService, ApiEvent } from '../../shared/services/event-api.service';

type ModalMode = 'create' | 'edit' | 'registrations';

const EMPTY_FORM = (): Partial<ApiEvent> => ({
  name: '', slug: '', date: '', time: '', location: '',
  description: '', image: '', action: 'Đăng ký', capacity: 50, isActive: true,
});

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css',
})
export class AdminEventsComponent implements OnInit {
  private eventApi = inject(EventApiService);

  events  = signal<ApiEvent[]>([]);
  loading = signal(true);
  saving  = signal(false);
  error   = signal('');
  success = signal('');

  modalOpen = signal(false);
  modalMode = signal<ModalMode>('create');
  editId    = signal('');
  form      = signal<Partial<ApiEvent>>(EMPTY_FORM());
  selected  = signal<ApiEvent | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.eventApi.getAllAdmin().subscribe({
      next:  (r) => { this.events.set(r.data); this.loading.set(false); },
      error: ()  => { this.error.set('Không thể tải sự kiện.'); this.loading.set(false); },
    });
  }

  openCreate(): void { this.form.set(EMPTY_FORM()); this.modalMode.set('create'); this.editId.set(''); this.error.set(''); this.modalOpen.set(true); }

  openEdit(e: ApiEvent): void {
    this.form.set({ ...e });
    this.modalMode.set('edit');
    this.editId.set(e._id);
    this.error.set('');
    this.modalOpen.set(true);
  }

  openRegistrations(e: ApiEvent): void {
    this.selected.set(e);
    this.modalMode.set('registrations');
    this.modalOpen.set(true);
  }

  closeModal(): void { this.modalOpen.set(false); this.error.set(''); }

  setField(key: keyof ApiEvent, val: unknown): void {
    this.form.update(f => ({ ...f, [key]: val }));
  }

  onNameChange(val: string): void {
    this.form.update(f => ({
      ...f, name: val,
      slug: val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    }));
  }

  save(): void {
    const f = this.form();
    if (!f.name || !f.slug || !f.date || !f.time || !f.location) {
      this.error.set('Vui lòng điền đủ thông tin bắt buộc.'); return;
    }
    this.saving.set(true);
    const obs = this.modalMode() === 'create'
      ? this.eventApi.create(f)
      : this.eventApi.update(this.editId(), f);

    obs.subscribe({
      next: () => {
        this.saving.set(false); this.closeModal();
        this.success.set(this.modalMode() === 'create' ? 'Đã thêm sự kiện!' : 'Đã cập nhật!');
        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: (err) => { this.saving.set(false); this.error.set(err.error?.message || 'Lưu thất bại.'); },
    });
  }

  remove(e: ApiEvent): void {
    if (!confirm(`Xóa sự kiện "${e.name}"?`)) return;
    this.eventApi.remove(e._id).subscribe({
      next: () => { this.success.set('Đã xóa sự kiện.'); setTimeout(() => this.success.set(''), 3000); this.load(); },
      error: () => this.error.set('Xóa thất bại.'),
    });
  }
}
