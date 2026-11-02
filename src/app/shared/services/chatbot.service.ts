import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';

export type AIProvider = 'local' | 'gemini' | 'openai';
export type AIPersona = 'general' | 'chef' | 'nutritionist' | 'support';

export interface ChatProduct {
  _id: string;
  id: string;
  name: string;
  slug: string;
  price: string;
  priceNumber: number;
  image: string;
  category: string;
  categoryVi: string;
  stock: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  products?: ChatProduct[];
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome_1',
  sender: 'bot',
  text: `Xin chào! Tôi là **Trợ lý AI Nông trại Xanh Lá** 🌿\n\nTôi có thể giúp bạn chọn nông sản tươi sạch, gợi ý thực đơn gia đình, giải đáp chính sách giao hàng xe lạnh hoặc kiểm tra trạng thái đơn hàng.\n\n*Hôm nay bạn cần tìm rau củ hay món ngon gì nào?*`,
  timestamp: new Date(),
};

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private api = inject(ApiService);

  isOpen = signal(false);
  loading = signal(false);
  hasUnread = signal(true);
  settingsOpen = signal(false);
  messages = signal<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);

  // Model & AI Provider configuration (Chatbox-inspired)
  provider = signal<AIProvider>(this.loadStoredProvider());
  apiKey = signal<string>(this.loadStoredApiKey());
  persona = signal<AIPersona>(this.loadStoredPersona());

  readonly quickSuggestions = [
    '🥗 Gợi ý rau củ tươi sạch hôm nay',
    '🍲 Hôm nay ăn gì? Gợi ý món ngon',
    '🍎 Trái cây tươi đang có loại nào?',
    '🚚 Phí ship & giao hàng xe lạnh thế nào?',
    '🥩 Thịt & hải sản tươi sống',
    '🎫 Có mã giảm giá nào không?',
  ];

  toggle(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) {
      this.hasUnread.set(false);
    }
  }

  open(): void {
    this.isOpen.set(true);
    this.hasUnread.set(false);
  }

  close(): void {
    this.isOpen.set(false);
    this.settingsOpen.set(false);
  }

  toggleSettings(): void {
    this.settingsOpen.update(v => !v);
  }

  setProvider(p: AIProvider): void {
    this.provider.set(p);
    try { localStorage.setItem('xanhla_chatbot_provider', p); } catch {}
  }

  setApiKey(key: string): void {
    this.apiKey.set(key);
    try { localStorage.setItem('xanhla_chatbot_apikey', key); } catch {}
  }

  setPersona(p: AIPersona): void {
    this.persona.set(p);
    try { localStorage.setItem('xanhla_chatbot_persona', p); } catch {}
  }

  clearHistory(): void {
    this.messages.set([
      {
        ...INITIAL_WELCOME_MESSAGE,
        id: 'welcome_' + Date.now(),
        timestamp: new Date(),
      }
    ]);
  }

  sendMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.loading()) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    this.messages.update(msgs => [...msgs, userMsg]);
    this.loading.set(true);

    const historyPayload = this.messages()
      .slice(-6)
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text }));

    this.api.post<{ success: boolean; reply: string; products?: ChatProduct[] }>('/chatbot/message', {
      message: trimmed,
      history: historyPayload,
      provider: this.provider(),
      apiKey: this.apiKey(),
      persona: this.persona(),
    }).subscribe({
      next: (res) => {
        const botMsg: ChatMessage = {
          id: 'reply_' + Date.now(),
          sender: 'bot',
          text: res.reply || 'Dạ, em đã nhận được thông tin từ bạn!',
          timestamp: new Date(),
          products: res.products && res.products.length > 0 ? res.products : undefined,
        };
        this.messages.update(msgs => [...msgs, botMsg]);
        this.loading.set(false);
      },
      error: (err) => {
        console.warn('Chatbot server unreachable, activating offline knowledge fallback:', err?.message || err);
        const fallbackMsg: ChatMessage = {
          id: 'err_' + Date.now(),
          sender: 'bot',
          text: this.getOfflineFallbackReply(trimmed),
          timestamp: new Date(),
        };
        this.messages.update(msgs => [...msgs, fallbackMsg]);
        this.loading.set(false);
      }
    });
  }

  private getOfflineFallbackReply(query: string): string {
    const q = query.toLowerCase();
    if (q.includes('ship') || q.includes('giao hang') || q.includes('van chuyen') || q.includes('phi')) {
      return `🚚 **Chính sách giao hàng xe lạnh Xanh Lá:**\n\n• **Miễn phí ship (0₫)** cho đơn từ **300.000₫** trở lên.\n• Đơn dưới 300.000₫: Đồng giá 25.000₫ nội thành.\n• Giao nhanh trong 2 giờ bảo quản bằng thùng lạnh 0°C – 4°C đảm bảo độ tươi giòn!`;
    }
    if (q.includes('voucher') || q.includes('giam gia') || q.includes('khuyen mai') || q.includes('code')) {
      return `🎉 **Ưu đãi hôm nay tại Xanh Lá:**\n\n🎟️ Mã: **WELCOME20** — Giảm ngay 20.000₫ cho khách hàng mới!\n🎟️ Mã: **FREESHIP** — Miễn phí vận chuyển cho đơn từ 200.000₫.\n\n👉 Bạn hãy nhập mã ở bước Thanh toán nhé!`;
    }
    if (q.includes('an gi') || q.includes('nau gi') || q.includes('thuc don') || q.includes('mon ngon')) {
      return `👩‍🍳 **Gợi ý món ngon tươi lành cho bữa cơm hôm nay:**\n\n🍲 **Món canh:** Canh cải thìa thịt bằm ngọt thanh mát.\n🥗 **Món rau:** Xà lách Lô Tô sốt mè rang giòn ngọt.\n🥩 **Món mặn:** Thịt ba chỉ cuộn nấm kim châm hoặc cá hồi áp chảo sốt bơ tỏi.\n\n*Nông sản Xanh Lá hái mới mỗi sớm luôn sẵn sàng phục vụ bạn!*`;
    }
    if (q.includes('nong trai') || q.includes('nguon goc') || q.includes('huu co') || q.includes('organic')) {
      return `🌱 **Cam kết nông sản Xanh Lá Farm:**\n\n• 100% đạt chuẩn VietGAP & GlobalGAP từ Đà Lạt và Ba Vì.\n• Cam kết 3 KHÔNG: Không thuốc trừ sâu – Không chất kích thích – Không chất bảo quản.\n• Bảo hành 1 đổi 1 trong 24 giờ nếu hàng không đạt độ tươi ngon!`;
    }
    return `🌿 Cảm ơn bạn đã nhắn tin cho **Xanh Lá Farm**!\n\nEm luôn sẵn sàng hỗ trợ bạn chọn nông sản hữu cơ, gợi ý thực đơn, kiểm tra chính sách giao hàng xe lạnh và mã giảm giá.\n\n*Nếu cần hỗ trợ hỏa tốc, bạn cũng có thể gọi Hotline miễn phí **1900 6868** nhé!*`;
  }

  private loadStoredProvider(): AIProvider {
    try {
      const p = localStorage.getItem('xanhla_chatbot_provider') as AIProvider;
      if (p === 'gemini' || p === 'openai' || p === 'local') return p;
    } catch {}
    return 'local';
  }

  private loadStoredApiKey(): string {
    try {
      return localStorage.getItem('xanhla_chatbot_apikey') || '';
    } catch {}
    return '';
  }

  private loadStoredPersona(): AIPersona {
    try {
      const p = localStorage.getItem('xanhla_chatbot_persona') as AIPersona;
      if (p === 'chef' || p === 'nutritionist' || p === 'support' || p === 'general') return p;
    } catch {}
    return 'general';
  }
}
