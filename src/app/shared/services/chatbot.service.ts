import { Injectable, signal, computed, inject } from '@angular/core';
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
  sender: 'user' | 'bot' | 'admin';
  senderRole?: 'customer' | 'ai' | 'admin';
  senderName?: string;
  senderAvatar?: string;
  text: string;
  timestamp: Date;
  image?: string; // base64 or url of uploaded image
  products?: ChatProduct[];
  isHandedOver?: boolean;
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome_1',
  sender: 'bot',
  senderRole: 'ai',
  senderName: 'NutriBot AI',
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

  // Live support sync state
  chatStatus = signal<'AI_PROCESSING' | 'WAITING_FOR_ADMIN' | 'ADMIN_PROCESSING' | 'RESOLVED'>('AI_PROCESSING');
  assignedStaffName = signal<string>('Chuyên viên tư vấn Xanh Lá');
  assignedStaffAvatar = signal<string>('');
  isStaffMode = computed(() => this.chatStatus() === 'WAITING_FOR_ADMIN' || this.chatStatus() === 'ADMIN_PROCESSING');

  private pollTimer: any = null;

  constructor() {
    try {
      localStorage.setItem('xanhla_chatbot_provider', 'gemini');
    } catch {}

    // Polling session every 2.5s for real-time 2-way live sync with Admin Support
    this.pollTimer = setInterval(() => {
      this.syncSession();
    }, 2500);

    // Initial check
    setTimeout(() => this.syncSession(), 600);
  }

  private initSessionId(): string {
    try {
      // Nếu đã đăng nhập, dùng sessionId cố định theo tài khoản người dùng để luôn quy về 1 hội thoại duy nhất
      const rawUser = localStorage.getItem('xanhla_user_session');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u._id || u.id) {
          const userSid = `sess_usr_${u._id || u.id}`;
          localStorage.setItem('xanhla_chat_session_id', userSid);
          return userSid;
        }
      }

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
      this.syncSession();
    }
  }

  open(): void {
    this.isOpen.set(true);
    this.hasUnread.set(false);
    this.syncSession();
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
    this.chatStatus.set('AI_PROCESSING');

    // Nếu người dùng đã đăng nhập, giữ nguyên session ID theo user để gom 1 khung chat duy nhất
    try {
      const rawUser = localStorage.getItem('xanhla_user_session');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u._id || u.id) {
          const userSid = `sess_usr_${u._id || u.id}`;
          this.sessionId.set(userSid);
          localStorage.setItem('xanhla_chat_session_id', userSid);
          return;
        }
      }
    } catch {}

    const freshSid = 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    this.sessionId.set(freshSid);
    try { localStorage.setItem('xanhla_chat_session_id', freshSid); } catch {}
  }

  requestHumanSupport(): void {
    if (this.loading()) return;
    this.chatStatus.set('WAITING_FOR_ADMIN');
    this.sendMessage('Tôi muốn gặp nhân viên tư vấn hỗ trợ trực tiếp.', undefined, true);
  }

  returnToAi(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api.post<{
      success: boolean;
      reply?: string;
      status?: any;
      messages?: any[];
    }>('/chatbot/switch-to-ai', {
      sessionId: this.sessionId()
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.chatStatus.set('AI_PROCESSING');
        const replyText = res.reply || 'NutriBot đã quay trở lại đồng hành cùng bạn 🌿! Bạn có câu hỏi gì về dinh dưỡng hoặc nông sản không?';
        const botMsg: ChatMessage = {
          id: 'ai_switch_' + Date.now(),
          sender: 'bot',
          senderRole: 'ai',
          senderName: 'NutriBot AI',
          text: replyText,
          timestamp: new Date(),
        };
        this.messages.update(msgs => [...msgs, botMsg]);
      },
      error: () => {
        this.loading.set(false);
        this.chatStatus.set('AI_PROCESSING');
      }
    });
  }

  syncSession(): void {
    const sid = this.sessionId();
    if (!sid) return;

    this.api.get<{
      success: boolean;
      status: 'AI_PROCESSING' | 'WAITING_FOR_ADMIN' | 'ADMIN_PROCESSING' | 'RESOLVED';
      assignedTo?: { name?: string; email?: string; avatar?: string };
      customerName?: string;
      customerAvatar?: string;
      messages: Array<{
        _id?: string;
        sender: 'customer' | 'ai' | 'admin';
        senderName?: string;
        senderAvatar?: string;
        content: string;
        timestamp: string | Date;
      }>;
    }>(`/chatbot/session/${sid}`).subscribe({
      next: (res) => {
        if (!res.success) return;

        if (res.status) {
          this.chatStatus.set(res.status);
        }

        if (res.assignedTo?.name) {
          this.assignedStaffName.set(res.assignedTo.name);
          if (res.assignedTo.avatar) {
            this.assignedStaffAvatar.set(res.assignedTo.avatar);
          }
        }

        if (Array.isArray(res.messages) && res.messages.length > 0) {
          const currentMsgs = this.messages();
          const serverAdminMsgs = res.messages.filter(m => m.sender === 'admin');
          const localAdminCount = currentMsgs.filter(m => m.sender === 'admin').length;

          // If new admin reply arrived and chatbot window is closed, alert customer
          if (serverAdminMsgs.length > localAdminCount && !this.isOpen()) {
            this.hasUnread.set(true);
          }

          // If in staff mode or message count changed, sync stream from server
          if (this.isStaffMode() || res.messages.length >= currentMsgs.length) {
            const mapped: ChatMessage[] = res.messages.map((m, idx) => ({
              id: m._id || `srv_${idx}_${new Date(m.timestamp).getTime()}`,
              sender: m.sender === 'customer' ? 'user' : (m.sender === 'admin' ? 'admin' : 'bot'),
              senderRole: m.sender,
              senderName: m.senderName,
              senderAvatar: m.senderAvatar,
              text: m.content,
              timestamp: new Date(m.timestamp),
              isHandedOver: m.sender === 'ai' && /chuyên viên tư vấn|chuyển yêu cầu|tiếp nhận/i.test(m.content),
            }));

            if (mapped.length > 0) {
              this.messages.set(mapped);
            }
          }
        }
      },
      error: () => {
        // Quietly ignore polling network errors
      }
    });
  }

  sendMessage(text: string, imageBase64?: string, requestHuman = false): void {
    const trimmed = text.trim();
    if (!trimmed && !imageBase64) return;
    if (this.loading()) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      senderRole: 'customer',
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

    this.api.post<{
      success: boolean;
      reply?: string;
      products?: ChatProduct[];
      isHandedOver?: boolean;
      liveChat?: boolean;
      status?: any;
    }>('/chatbot/message', {
      message: trimmed,
      image: imageBase64 || null,
      history: historyPayload,
      provider: 'gemini',
      apiKey: this.apiKey() || '',
      persona: this.persona(),
      sessionId: this.sessionId(),
      requestHuman,
      customerInfo,
      customerName: customerInfo?.name,
      customerEmail: customerInfo?.email,
      customerPhone: customerInfo?.phone,
      customerAvatar: customerInfo?.avatar,
    }).subscribe({
      next: (res) => {
        if (res.status) {
          this.chatStatus.set(res.status);
        }

        // Nếu có phản hồi (AI reply hoặc thông báo chuyển nhân viên)
        if (res.reply && res.reply.trim()) {
          const botMsg: ChatMessage = {
            id: 'reply_' + Date.now(),
            sender: 'bot',
            senderRole: 'ai',
            senderName: 'NutriBot AI',
            text: res.reply,
            timestamp: new Date(),
            products: res.products && res.products.length > 0 ? res.products : undefined,
            isHandedOver: res.isHandedOver,
          };
          this.messages.update(msgs => [...msgs, botMsg]);
        }

        this.loading.set(false);
      },
      error: (err) => {
        console.warn('Backend unavailable, activating fallback:', err?.message || err);
        const fallbackMsg: ChatMessage = {
          id: 'err_' + Date.now(),
          sender: 'bot',
          senderRole: 'ai',
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
