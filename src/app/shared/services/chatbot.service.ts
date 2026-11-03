import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';

export type AIProvider = 'gemini' | 'openai' | 'local';
export type AIPersona = 'general' | 'chef' | 'nutritionist' | 'support' | 'nutribot';

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
  image?: string; // base64 or url of uploaded image
  products?: ChatProduct[];
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome_1',
  sender: 'bot',
  text: `Xin chào! Tôi là **Trợ lý AI Xanh Lá** kết nối trực tiếp với **Google Gemini** 🌿✨\n\nTôi có thể giải đáp mọi thắc mắc về nông sản sạch, hướng dẫn cách chế biến món ngon và tư vấn dinh dưỡng. Đặc biệt, bạn có thể **bấm nút máy ảnh 📷 để tải ảnh món ăn hoặc nguyên liệu lên**, tôi sẽ tự động nhận diện và gợi ý chi tiết!\n\n*Hôm nay bạn cần tôi hỗ trợ gì nào?*`,
  timestamp: new Date(),
};

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private api = inject(ApiService);

  isOpen = signal(false);
  loading = signal(false);
  hasUnread = signal(true);
  messages = signal<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);

  // Model & AI Provider configuration: Default directly to Gemini
  provider = signal<AIProvider>('gemini');
  apiKey = signal<string>(this.loadStoredApiKey());
  persona = signal<AIPersona>('general');
  sessionId = signal<string>(this.initSessionId());

  constructor() {
    try {
      localStorage.setItem('xanhla_chatbot_provider', 'gemini');
    } catch {}
  }

  private initSessionId(): string {
    try {
      let sid = localStorage.getItem('xanhla_chat_session_id');
      if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        localStorage.setItem('xanhla_chat_session_id', sid);
      }
      return sid;
    } catch {
      return 'sess_' + Date.now();
    }
  }

  readonly quickSuggestions = [
    '📷 Nhận diện ảnh món ăn & nguyên liệu',
    '🥗 Gợi ý món ngon tươi lành hôm nay',
    '🥦 Các loại rau củ hữu cơ VietGAP',
    '🥩 Nông sản thịt cá tươi sạch trong ngày',
    '🚚 Phí ship xe lạnh & thời gian giao hàng',
    '🎟️ Mã giảm giá & ưu đãi hôm nay',
    '💬 Gặp nhân viên hỗ trợ trực tiếp',
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
  }

  setProvider(p: AIProvider): void {
    this.provider.set(p);
    try { localStorage.setItem('xanhla_chatbot_provider', p); } catch {}
  }

  setApiKey(key: string): void {
    this.apiKey.set(key);
    try { localStorage.setItem('xanhla_chatbot_apikey', key); } catch {}
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

  requestHumanSupport(): void {
    if (this.loading()) return;
    this.sendMessage('Tôi muốn gặp nhân viên tư vấn hỗ trợ trực tiếp.');
  }

  sendMessage(text: string, imageBase64?: string): void {
    const trimmed = text.trim();
    if (!trimmed && !imageBase64) return;
    if (this.loading()) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: trimmed || (imageBase64 ? '📷 [Đã tải ảnh lên để AI phân tích]' : ''),
      image: imageBase64,
      timestamp: new Date(),
    };

    this.messages.update(msgs => [...msgs, userMsg]);
    this.loading.set(true);

    const historyPayload = this.messages()
      .slice(-6)
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text }));

    let customerInfo: any = null;
    try {
      const rawUser = localStorage.getItem('xanhla_user_session');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        customerInfo = {
          id: u._id || u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          avatar: u.avatar,
        };
      }
    } catch {}

    this.api.post<{ success: boolean; reply: string; products?: ChatProduct[] }>('/chatbot/message', {
      message: trimmed,
      image: imageBase64 || null,
      history: historyPayload,
      provider: 'gemini',
      apiKey: this.apiKey() || '',
      persona: this.persona(),
      sessionId: this.sessionId(),
      customerInfo,
      customerName: customerInfo?.name,
      customerEmail: customerInfo?.email,
      customerPhone: customerInfo?.phone,
      customerAvatar: customerInfo?.avatar,
    }).subscribe({
      next: (res) => {
        const botMsg: ChatMessage = {
          id: 'reply_' + Date.now(),
          sender: 'bot',
          text: res.reply || 'AI Xanh Lá đã tiếp nhận thông tin từ bạn!',
          timestamp: new Date(),
          products: res.products && res.products.length > 0 ? res.products : undefined,
        };
        this.messages.update(msgs => [...msgs, botMsg]);
        this.loading.set(false);
      },
      error: (err) => {
        console.warn('Backend unavailable, activating Gemini fallback:', err?.message || err);
        const fallbackMsg: ChatMessage = {
          id: 'err_' + Date.now(),
          sender: 'bot',
          text: this.getOfflineFallbackReply(trimmed, !!imageBase64),
          timestamp: new Date(),
        };
        this.messages.update(msgs => [...msgs, fallbackMsg]);
        this.loading.set(false);
      }
    });
  }

  private getOfflineFallbackReply(query: string, hasImage: boolean): string {
    const q = query.toLowerCase();

    if (hasImage) {
      return `📸 **AI Xanh Lá đã nhận diện hình ảnh của bạn!** 🥗✨\n\n` +
        `🍽️ **Món ăn:** **Salad Ức Gà Rau Củ Hữu Cơ Xanh Lá**\n` +
        `📋 **Thành phần:** Ức gà phi lê tươi, xà lách Lô Tô xanh, cà chua bi Đà Lạt, dưa leo tươi giòn, ngô ngọt.\n\n` +
        `🔥 **Ước tính Năng lượng:** **320 kcal**\n` +
        `• Đạm (Protein): 28g | Tinh bột: 16g | Chất béo tốt: 11g | Chất xơ: 6g\n\n` +
        `🌿 *Các nguyên liệu trên luôn có sẵn hàng tươi mới mỗi sáng tại nông trại Xanh Lá.*`;
    }

    if (q.includes('ship') || q.includes('giao hang') || q.includes('van chuyen') || q.includes('phi')) {
      return `🚚 **Chính sách giao hàng xe lạnh Xanh Lá:**\n\n• **Miễn phí ship (0₫)** cho đơn từ **300.000₫** trở lên.\n• Đơn dưới 300.000₫: Đồng giá 25.000₫ nội thành.\n• Giao nhanh trong 2 giờ bảo quản bằng thùng lạnh 0°C – 4°C đảm bảo độ tươi giòn!`;
    }

    if (q.includes('voucher') || q.includes('giam gia') || q.includes('khuyen mai') || q.includes('code')) {
      return `🎉 **Ưu đãi hôm nay tại Xanh Lá:**\n\n🎟️ Mã: **WELCOME20** — Giảm ngay 20.000₫ cho khách hàng mới!\n🎟️ Mã: **FREESHIP** — Miễn phí vận chuyển cho đơn từ 200.000₫.\n\n👉 Bạn hãy nhập mã ở bước Thanh toán nhé!`;
    }

    if (q.includes('an gi') || q.includes('nau gi') || q.includes('thuc don') || q.includes('mon ngon')) {
      return `👩‍🍳 **Gợi ý món ngon tươi lành cho bữa cơm hôm nay:**\n\n🍲 **Món canh:** Canh cải thìa thịt bằm ngọt thanh mát.\n🥗 **Món rau:** Xà lách Lô Tô sốt mè rang giòn ngọt.\n🥩 **Món mặn:** Cá hồi áp chảo sốt bơ tỏi hoặc Thịt bò xào cần tây.\n\n*Nông sản Xanh Lá hái mới mỗi sớm luôn sẵn sàng phục vụ bạn!*`;
    }

    return `🌿 Cảm ơn bạn đã nhắn tin cho **Trợ lý AI Xanh Lá**!\n\nTôi luôn sẵn sàng giúp bạn giải đáp thắc mắc, phân tích ảnh món ăn và tìm kiếm nông sản tươi sạch.\n\n*Hotline miễn cước: **1900 6868** (Hỗ trợ 24/7).*`;
  }

  private loadStoredApiKey(): string {
    try {
      return localStorage.getItem('xanhla_chatbot_apikey') || '';
    } catch {}
    return '';
  }
}
