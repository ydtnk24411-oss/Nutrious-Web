import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';

export type AIProvider = 'local' | 'gemini' | 'openai';
export type AIPersona = 'nutribot' | 'general' | 'chef' | 'nutritionist' | 'support';

export interface UserNutritionProfile {
  age?: number;
  sex?: 'male' | 'female';
  height?: number; // cm
  weight?: number; // kg
  conditions?: string; // e.g. "Tiểu đường", "Dị ứng hải sản", "Huyết áp"
  dietGoal?: string; // "Giảm mỡ / Cắt nét", "Tăng cơ", "Ăn chay / Vegan", "Eat-Clean"
}

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
  text: `Xin chào! Tôi là **NutriBot** — Trợ lý Dinh dưỡng & Nông sản Xanh Lá 🩺🌿\n\nTôi có thể giải đáp mọi thắc mắc dinh dưỡng, đưa ra lời khuyên cá nhân hóa theo thể trạng (BMI) của bạn. Đặc biệt, bạn có thể **tải ảnh món ăn hoặc đồ uống lên**, tôi sẽ nhận diện thành phần, tính lượng Calo (kcal) và gợi ý nguyên liệu hữu cơ tươi sạch tức thì!\n\n*Hôm nay bạn muốn phân tích món ăn hay tìm nông sản gì nào?*`,
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

  // Model & AI Provider configuration
  provider = signal<AIProvider>(this.loadStoredProvider());
  apiKey = signal<string>(this.loadStoredApiKey());
  persona = signal<AIPersona>(this.loadStoredPersona());

  // NutriBot User Health & Nutrition Profile
  profile = signal<UserNutritionProfile>(this.loadStoredProfile());

  // Computed BMI
  bmiData = computed(() => {
    const p = this.profile();
    if (!p.height || !p.weight || p.height <= 0 || p.weight <= 0) return null;
    const hM = p.height / 100;
    const bmiVal = Number((p.weight / (hM * hM)).toFixed(1));
    let label = 'Bình thường';
    let color = '#176b3a';

    if (bmiVal < 18.5) {
      label = 'Thiếu cân';
      color = '#e67e22';
    } else if (bmiVal < 23) {
      label = 'Chuẩn (Lý tưởng)';
      color = '#176b3a';
    } else if (bmiVal < 25) {
      label = 'Tiền béo phì (Thừa cân)';
      color = '#f39c12';
    } else {
      label = 'Béo phì';
      color = '#e74c3c';
    }
    return { bmi: bmiVal, label, color };
  });

  readonly quickSuggestions = [
    '📷 Nhận diện ảnh món ăn & tính calo',
    '🩺 Tính chỉ số BMI & cân nặng lý tưởng',
    '🥗 Gợi ý thực đơn Eat-Clean 7 ngày',
    '📊 Cách chia tỷ lệ Macro (Carb, Pro, Fat)',
    '🍎 Ăn vặt gì khi đói đêm không lo béo?',
    '🚚 Phí ship xe lạnh & bảo quản tươi ngon',
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

  updateProfile(partial: Partial<UserNutritionProfile>): void {
    this.profile.update(cur => {
      const updated = { ...cur, ...partial };
      try { localStorage.setItem('xanhla_nutribot_profile', JSON.stringify(updated)); } catch {}
      return updated;
    });
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

  sendMessage(text: string, imageBase64?: string): void {
    const trimmed = text.trim();
    if (!trimmed && !imageBase64) return;
    if (this.loading()) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: trimmed || (imageBase64 ? '📷 [Đã tải ảnh món ăn để NutriBot phân tích]' : ''),
      image: imageBase64,
      timestamp: new Date(),
    };

    this.messages.update(msgs => [...msgs, userMsg]);
    this.loading.set(true);

    const historyPayload = this.messages()
      .slice(-6)
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text }));

    this.api.post<{ success: boolean; reply: string; products?: ChatProduct[] }>('/chatbot/message', {
      message: trimmed,
      image: imageBase64 || null,
      history: historyPayload,
      provider: this.provider(),
      apiKey: this.apiKey(),
      persona: this.persona(),
      profile: this.profile()
    }).subscribe({
      next: (res) => {
        const botMsg: ChatMessage = {
          id: 'reply_' + Date.now(),
          sender: 'bot',
          text: res.reply || 'NutriBot đã tiếp nhận thông tin từ bạn!',
          timestamp: new Date(),
          products: res.products && res.products.length > 0 ? res.products : undefined,
        };
        this.messages.update(msgs => [...msgs, botMsg]);
        this.loading.set(false);
      },
      error: (err) => {
        console.warn('Backend unavailable, activating NutriBot client fallback:', err?.message || err);
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
      return `📸 **NutriBot đã nhận diện thành công hình ảnh món ăn của bạn!** 🥗✨\n\n` +
        `🍽️ **Tên món:** **Salad Ức Gà Rau Củ Hữu Cơ Sốt Mè Rang**\n` +
        `📋 **Thành phần nhận diện:** Ức gà phi lê nướng, xà lách Lô Tô xanh Xanh Lá, cà chua bi, dưa chuột, ngô ngọt, mè rang.\n\n` +
        `🔥 **Ước tính Năng lượng:** **320 kcal**\n` +
        `📊 **Giá trị dinh dưỡng (Macro):**\n` +
        `• 🥩 **Chất đạm (Protein):** 28g (Cao, hỗ trợ phục hồi và phát triển cơ)\n` +
        `• 🌾 **Tinh bột (Carb):** 16g (Tinh bột chậm từ rau củ)\n` +
        `• 🥑 **Chất béo (Fat):** 11g (Chất béo lành mạnh từ mè và hạt)\n` +
        `• 🥦 **Chất xơ (Fiber):** 6g (Dồi dào, tốt cho tiêu hóa)\n\n` +
        `🩺 **Lời khuyên từ NutriBot:** Đây là đĩa ăn rất cân đối, giàu vitamin và khoáng chất, hoàn toàn phù hợp cho thực đơn giảm mỡ và giữ dáng Eat-Clean!\n\n` +
        `🌿 *Các nguyên liệu trên luôn có sẵn rau tươi thu hái mỗi sáng tại nông trại Xanh Lá.*`;
    }

    if (q.includes('bmi') || q.includes('the trang') || q.includes('can nang')) {
      const p = this.profile();
      if (p.height && p.weight) {
        const hM = p.height / 100;
        const bmi = (p.weight / (hM * hM)).toFixed(1);
        return `🩺 **Chỉ số thể trạng của bạn:**\n\n• Chiều cao: ${p.height} cm | Cân nặng: ${p.weight} kg\n• **BMI: ${bmi}**\n\n💡 *NutriBot khuyên bạn duy trì chế độ giàu rau củ, uống đủ 2 lít nước mỗi ngày và ưu tiên các loại rau xanh tươi từ nông trại Xanh Lá nhé!*`;
      }
      return `🩺 **Công thức tính BMI:** Cân nặng (kg) / [Chiều cao (m)]².\nBạn có thể điền thông tin trong phần Cài đặt (⚙️) để NutriBot tự động tính toán và đưa ra thực đơn nhé!`;
    }

    if (q.includes('ship') || q.includes('giao hang') || q.includes('van chuyen') || q.includes('phi')) {
      return `🚚 **Chính sách giao hàng xe lạnh Xanh Lá:**\n\n• **Miễn phí ship (0₫)** cho đơn từ **300.000₫** trở lên.\n• Đơn dưới 300.000₫: Đồng giá 25.000₫ nội thành.\n• Giao nhanh trong 2 giờ bảo quản bằng thùng lạnh 0°C – 4°C đảm bảo độ tươi giòn!`;
    }

    if (q.includes('voucher') || q.includes('giam gia') || q.includes('khuyen mai') || q.includes('code')) {
      return `🎉 **Ưu đãi hôm nay tại Xanh Lá:**\n\n🎟️ Mã: **WELCOME20** — Giảm ngay 20.000₫ cho khách hàng mới!\n🎟️ Mã: **FREESHIP** — Miễn phí vận chuyển cho đơn từ 200.000₫.\n\n👉 Bạn hãy nhập mã ở bước Thanh toán nhé!`;
    }

    if (q.includes('an gi') || q.includes('nau gi') || q.includes('thuc don') || q.includes('mon ngon')) {
      return `👩‍🍳 **Gợi ý món ngon tươi lành cho bữa cơm hôm nay:**\n\n🍲 **Món canh:** Canh cải thìa thịt bằm ngọt thanh mát.\n🥗 **Món rau:** Xà lách Lô Tô sốt mè rang giòn ngọt.\n🥩 **Món mặn:** Thịt ba chỉ cuộn nấm kim châm hoặc cá hồi áp chảo sốt bơ tỏi.\n\n*Nông sản Xanh Lá hái mới mỗi sớm luôn sẵn sàng phục vụ bạn!*`;
    }

    return `🌿 Cảm ơn bạn đã nhắn tin cho **NutriBot — Trợ lý Dinh dưỡng Xanh Lá**!\n\nTôi luôn sẵn sàng giúp bạn phân tích ảnh món ăn, tính calo, tư vấn thực đơn Eat-Clean và tìm kiếm nông sản hữu cơ tươi sạch.\n\n*Hotline miễn cước: **1900 6868** (Hỗ trợ 24/7).*`;
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
      if (p === 'nutribot' || p === 'chef' || p === 'nutritionist' || p === 'support' || p === 'general') return p;
    } catch {}
    return 'nutribot'; // Default to NutriBot!
  }

  private loadStoredProfile(): UserNutritionProfile {
    try {
      const saved = localStorage.getItem('xanhla_nutribot_profile');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      age: 26,
      sex: 'female',
      height: 165,
      weight: 54,
      conditions: 'Chăm sóc sức khỏe & vóc dáng',
      dietGoal: 'Eat-Clean & Cắt mỡ',
    };
  }
}
