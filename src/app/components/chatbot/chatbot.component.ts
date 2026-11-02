import {
  Component,
  inject,
  signal,
  effect,
  ViewChild,
  ElementRef,
  AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChatbotService, ChatProduct, ChatMessage, AIProvider, AIPersona } from '../../shared/services/chatbot.service';
import { CartService } from '../../shared/services/cart.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css',
})
export class ChatbotComponent implements AfterViewChecked {
  protected chat = inject(ChatbotService);
  private cart = inject(CartService);
  private router = inject(Router);

  @ViewChild('messagesScroll') private messagesScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') private fileInputRef?: ElementRef<HTMLInputElement>;

  inputText = signal('');
  copiedId = signal('');
  selectedImageBase64 = signal<string | null>(null);
  selectedImageName = signal<string | null>(null);

  private shouldScroll = false;

  constructor() {
    effect(() => {
      this.chat.messages();
      this.chat.loading();
      this.shouldScroll = true;
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  scrollToBottom(): void {
    try {
      if (this.messagesScrollContainer) {
        this.messagesScrollContainer.nativeElement.scrollTop =
          this.messagesScrollContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitMessage();
    }
  }

  // ── Image Upload Handling (NutriBot Food & Beverage Vision) ──────────
  triggerImagePicker(): void {
    this.fileInputRef?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh (JPEG, PNG, WebP).');
      return;
    }

    this.selectedImageName.set(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      this.selectedImageBase64.set(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected if removed
    input.value = '';
  }

  removeSelectedImage(): void {
    this.selectedImageBase64.set(null);
    this.selectedImageName.set(null);
  }

  // ── Send Message ─────────────────────────────────────────────────────
  submitMessage(): void {
    const text = this.inputText().trim();
    const image = this.selectedImageBase64();

    if (!text && !image) return;
    if (this.chat.loading()) return;

    this.inputText.set('');
    this.selectedImageBase64.set(null);
    this.selectedImageName.set(null);

    this.chat.sendMessage(text, image || undefined);
  }

  selectSuggestion(s: string): void {
    if (s.includes('Nhận diện ảnh')) {
      this.triggerImagePicker();
      return;
    }
    this.chat.sendMessage(s);
  }

  copyMessage(id: string, text: string): void {
    const cleanText = text.replace(/[*_#`]/g, '');
    navigator.clipboard?.writeText(cleanText).then(() => {
      this.copiedId.set(id);
      setTimeout(() => this.copiedId.set(''), 2000);
    }).catch(() => {});
  }

  addChatProductToCart(p: ChatProduct): void {
    const prod: XanhLaProduct = {
      id: p.id || p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      priceNumber: p.priceNumber,
      image: p.image,
      category: p.category || '',
      categoryVi: p.categoryVi || '',
      container: '',
      cutType: '',
      cutting: '',
      packSize: '',
      packaging: '',
      preparation: 'Raw',
      quantity: '1',
      ripeness: 'Fresh',
      sizeGroup: 'Medium',
      thickness: 'Standard',
      type: 'Fresh',
      weight: '500g',
      description: '',
    };
    this.cart.addItem(prod, 1);
  }

  formatMessageText(text: string): string {
    if (!text) return '';
    // Format bold **text**
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Format italic *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Format markdown link [text](url)
    formatted = formatted.replace(
      /\[(.*?)\]\((.*?)\)/g,
      '<a href="$2" style="color:#176b3a;text-decoration:underline;font-weight:600">$1</a>'
    );
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br/>');
    return formatted;
  }

  formatTime(date: Date): string {
    const d = new Date(date);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // Profile update helpers
  updateProfileField(field: string, value: any): void {
    this.chat.updateProfile({ [field]: value });
  }
}
