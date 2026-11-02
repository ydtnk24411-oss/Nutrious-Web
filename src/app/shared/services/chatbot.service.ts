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
      error: () => {
        const fallbackMsg: ChatMessage = {
          id: 'err_' + Date.now(),
          sender: 'bot',
          text: 'Xin lỗi bạn, kết nối của em vừa bị gián đoạn một chút. Bạn vui lòng thử lại hoặc gọi Hotline **1900 6868** để được hỗ trợ nhanh nhất nhé! 🌿',
          timestamp: new Date(),
        };
        this.messages.update(msgs => [...msgs, fallbackMsg]);
        this.loading.set(false);
      }
    });
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
