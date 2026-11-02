const router = require('express').Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Voucher = require('../models/Voucher');

// Status dictionary for orders
const ORDER_STATUS_MAP = {
  pending:   'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị hàng',
  shipping:  'Đang giao hàng xe lạnh',
  delivered: 'Đã giao thành công',
  cancelled: 'Đã hủy',
};

// Helper: Normalize Vietnamese search
function removeDiacritics(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

// Build system prompt based on persona and catalog
function buildSystemPrompt(catalogSnippet, persona = 'general') {
  let personaInstruction = '';
  if (persona === 'chef') {
    personaInstruction = 'Bạn đóng vai trò Bếp trưởng Xanh Lá, chuyên gia ẩm thực hữu cơ, hướng dẫn công thức nấu ăn sáng tạo, cách kết hợp rau củ thịt cá thành món ngon chuẩn vị gia đình.';
  } else if (persona === 'nutritionist') {
    personaInstruction = 'Bạn đóng vai trò Chuyên gia Dinh dưỡng Xanh Lá, tư vấn thực phẩm giàu vitamin, thực đơn eat-clean, kiểm soát calo và lợi ích sức khỏe từ rau củ quả tươi.';
  } else if (persona === 'support') {
    personaInstruction = 'Bạn đóng vai trò Hỗ trợ viên chăm sóc khách hàng Xanh Lá, giải đáp về vận chuyển xe lạnh, kiểm tra đơn hàng, chính sách 1 đổi 1 và voucher ưu đãi.';
  } else {
    personaInstruction = 'Bạn là Trợ lý AI Nông sản Xanh Lá thông thái và thân thiện, hỗ trợ khách hàng tìm kiếm nông sản sạch, gợi ý thực đơn, tư vấn mua sắm và giải đáp thắc mắc.';
  }

  return `${personaInstruction}

THÔNG TIN HỆ SINH THÁI XANH LÁ FARM:
- Nông sản 100% hữu cơ chuẩn VietGAP & GlobalGAP từ Đà Lạt và Ba Vì.
- Sản phẩm thu hoạch tươi mới mỗi sáng, bảo quản bằng xe lạnh chuyên dụng 0°C – 4°C.
- Miễn phí giao hàng (0₫) cho đơn từ 300.000₫. Đơn dưới 300.000₫ đồng giá 25.000₫ nội thành.
- Đổi trả 1-1 trong 24 giờ nếu hàng không đạt cam kết tươi ngon.
- Hỗ trợ tra cứu đơn hàng nhanh qua mã đơn (ví dụ: #XL123456).

DANH MỤC TIÊU BIỂU TẠI NÔNG TRẠI:
${catalogSnippet}

YÊU CẦU TRẢ LỜI:
- Trả lời bằng tiếng Việt lịch thiệp, ấm áp, dùng các emoji tươi mát (🌿, 🥗, 🍎, 🍲, ✨).
- Định dạng Markdown rõ ràng (dùng in đậm, gạch đầu dòng).
- Khi gợi ý món ăn, hãy nhắc tên các nguyên liệu có sẵn tại Xanh Lá để khách hàng dễ lựa chọn.`;
}

// POST /api/chatbot/message
router.post('/message', async (req, res, next) => {
  try {
    const { message, history = [], provider = 'local', apiKey = '', persona = 'general' } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không hợp lệ.' });
    }

    const trimmed = message.trim();
    const cleanLower = removeDiacritics(trimmed);

    // ── 1. External LLM Provider (Gemini / OpenAI) nếu được chọn ──────────
    if (provider === 'gemini' && (apiKey || process.env.GEMINI_API_KEY)) {
      try {
        const reply = await callGeminiAI(trimmed, history, apiKey || process.env.GEMINI_API_KEY, persona);
        if (reply && reply.text) {
          const prods = await findRelatedProducts(cleanLower);
          return res.json({ success: true, reply: reply.text, products: prods });
        }
      } catch (aiErr) {
        console.warn('Gemini AI fallback:', aiErr.message);
      }
    } else if (provider === 'openai' && (apiKey || process.env.OPENAI_API_KEY)) {
      try {
        const reply = await callOpenAIAI(trimmed, history, apiKey || process.env.OPENAI_API_KEY, persona);
        if (reply && reply.text) {
          const prods = await findRelatedProducts(cleanLower);
          return res.json({ success: true, reply: reply.text, products: prods });
        }
      } catch (aiErr) {
        console.warn('OpenAI fallback:', aiErr.message);
      }
    }

    // ── 2. Xanh Lá Smart Knowledge Engine (Built-in 24/7) ─────────────────

    // 2.1. Tra cứu đơn hàng
    const orderMatch = trimmed.match(/([a-zA-Z0-9]{6,24})/g);
    const isOrderQuery = cleanLower.includes('don hang') || cleanLower.includes('kiem tra don') || cleanLower.includes('ma don') || cleanLower.includes('order');
    if (isOrderQuery && orderMatch) {
      for (const code of orderMatch) {
        const order = await Order.findOne({
          $or: [
            { orderCode: code },
            { orderCode: code.toUpperCase() },
            ...(code.length === 24 ? [{ _id: code }] : [])
          ]
        }).populate('items.product');

        if (order) {
          const statusVi = ORDER_STATUS_MAP[order.status] || order.status;
          const itemsSummary = (order.items || [])
            .map(i => `• ${i.productName} (x${i.quantity}) - ${(i.priceNumber * i.quantity).toLocaleString('vi-VN')}₫`)
            .join('\n');

          const replyText = `📦 **Thông tin đơn hàng #${order.orderCode}**\n\n` +
            `• **Trạng thái:** ${statusVi}\n` +
            `• **Khách hàng:** ${order.guestName || 'Quý khách'}\n` +
            `• **Tổng thanh toán:** ${order.total.toLocaleString('vi-VN')}₫\n` +
            `• **Hình thức:** ${order.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 'Chuyển khoản / Đã thanh toán'}\n` +
            `• **Thời gian đặt:** ${new Date(order.createdAt).toLocaleString('vi-VN')}\n\n` +
            `**Danh sách món trong đơn:**\n${itemsSummary}\n\n` +
            `🚛 *Xanh Lá cam kết bảo quản bằng xe lạnh chuyên dụng từ nông trại đến tận cửa nhà bạn.*`;

          return res.json({ success: true, reply: replyText, products: [] });
        }
      }
    }

    // 2.2. Hỏi về Mã giảm giá / Voucher / Khuyến mãi
    if (cleanLower.includes('voucher') || cleanLower.includes('giam gia') || cleanLower.includes('khuyen mai') || cleanLower.includes('uu dai') || cleanLower.includes('ma code')) {
      const activeVouchers = await Voucher.find({
        isActive: { $ne: false },
        endDate: { $gte: new Date() }
      }).limit(4);

      if (activeVouchers && activeVouchers.length > 0) {
        const voucherList = activeVouchers.map(v => {
          const val = v.discountType === 'percentage' ? `${v.discountValue}%` : `${v.discountValue.toLocaleString('vi-VN')}₫`;
          const minVal = v.minOrderValue ? `(Đơn từ ${v.minOrderValue.toLocaleString('vi-VN')}₫)` : '';
          return `🎟️ Mã: **${v.code}** — Giảm **${val}** ${minVal} - *${v.name}*`;
        }).join('\n');

        const replyText = `🎉 **Xanh Lá Farm hiện đang có các ưu đãi hấp dẫn dành riêng cho bạn:**\n\n${voucherList}\n\n` +
          `💡 *Bạn có thể nhập mã này tại bước Thanh toán (Checkout) hoặc xem thêm ở trang [Ưu đãi / Vouchers](/vouchers).*`;

        return res.json({ success: true, reply: replyText, products: [] });
      } else {
        return res.json({
          success: true,
          reply: `🌿 Hiện tại Xanh Lá đang áp dụng chính sách **Miễn phí vận chuyển xe lạnh toàn thành phố cho đơn hàng từ 300.000₫** và tích điểm thành viên hạng Kim cương nhận chiết khấu đến 10%!`,
          products: []
        });
      }
    }

    // 2.3. Hỏi về Chính sách giao hàng, Phí vận chuyển, Bảo quản
    if (cleanLower.includes('giao hang') || cleanLower.includes('phi ship') || cleanLower.includes('van chuyen') || cleanLower.includes('xe lanh') || cleanLower.includes('bao quan') || cleanLower.includes('bao lau')) {
      const replyText = `🚚 **Chính sách Giao nhận & Bảo quản tại Xanh Lá Farm:**\n\n` +
        `1. **Giao hàng xe lạnh chuyên dụng:** Toàn bộ rau củ, quả, thịt cá tươi sống được vận chuyển ở nhiệt độ chuẩn 0°C – 4°C, cam kết độ giòn ngọt nguyên bản như vừa hái tại vườn.\n` +
        `2. **Tốc độ giao hàng:**\n` +
        `   • Giao hỏa tốc 2 giờ tại nội thành Hà Nội & TP. Hồ Chí Minh.\n` +
        `   • Các khung giờ giao linh hoạt theo yêu cầu khách hàng.\n` +
        `3. **Phí vận chuyển:**\n` +
        `   • **Miễn phí ship (0₫)** cho đơn hàng từ **300.000₫** trở lên.\n` +
        `   • Đơn dưới 300.000₫: Đồng giá hỗ trợ 25.000₫ nội thành.\n` +
        `4. **Bảo hành 1 đổi 1 trong 24 giờ:** Nếu rau củ bị dập nát, héo úa hoặc không tươi ngon, Xanh Lá đổi mới ngay lập tức mà không thu thêm phí!`;

      return res.json({ success: true, reply: replyText, products: [] });
    }

    // 2.4. Hỏi về Nông trại, Nguồn gốc, Canh tác hữu cơ, Tham quan
    if (cleanLower.includes('nguon goc') || cleanLower.includes('huu co') || cleanLower.includes('organic') || cleanLower.includes('nong trai') || cleanLower.includes('tham quan') || cleanLower.includes('dat lich')) {
      const replyText = `🌱 **Về Xanh Lá Farm — Khởi nguồn từ tình yêu đất mẹ:**\n\n` +
        `• **Vùng trồng:** Hệ thống nông trại hữu cơ chuẩn VietGAP & GlobalGAP tại Đà Lạt và Ba Vì với nguồn nước khoáng tự nhiên và thổ nhưỡng giàu dinh dưỡng.\n` +
        `• **Quy trình 3 KHÔNG:** Không thuốc trừ sâu hóa học – Không chất kích thích tăng trưởng – Không chất bảo quản sau thu hoạch.\n` +
        `• **Tour trải nghiệm nông trại:** Xanh Lá mở cửa đón khách tham quan, tự tay hái rau quả vào mỗi Thứ Bảy & Chủ Nhật hàng tuần.\n\n` +
        `👉 Bạn có thể đặt lịch hẹn trải nghiệm tại trang [Đặt lịch tham quan](/book-online) nhé!`;

      return res.json({ success: true, reply: replyText, products: [] });
    }

    // 2.5. Gợi ý món ăn, Nấu ăn ("Hôm nay ăn gì", "Công thức", "Món ngon", "Cook with what you have")
    if (cleanLower.includes('an gi') || cleanLower.includes('nau gi') || cleanLower.includes('thuc don') || cleanLower.includes('mon ngon') || cleanLower.includes('cong thuc') || cleanLower.includes('nau an')) {
      const [freshVeggies, freshMeats] = await Promise.all([
        Product.find({ isActive: { $ne: false }, category: 'vegetables' }).limit(2),
        Product.find({ isActive: { $ne: false }, category: { $in: ['meat', 'seafood'] } }).limit(2)
      ]);

      const recommended = [...freshVeggies, ...freshMeats].slice(0, 4);

      const replyText = `👩‍🍳 **Gợi ý thực đơn tươi lành, giàu năng lượng hôm nay cho gia đình bạn:**\n\n` +
        `🍲 **Món chính:** Ba chỉ bò Mỹ cuộn nấm kim châm / Phi lê cá hồi áp chảo sốt bơ chanh thơm lừng.\n` +
        `🥗 **Món rau:** Canh rau cải thìa baby non ngọt nấu thịt bằm hoặc salad xà lách Lô Tô xanh sốt mè rang thanh mát.\n` +
        `🍎 **Tráng miệng:** Táo Envy giòn ngọt hoặc chuối Laba Đà Lạt dồi dào kali.\n\n` +
        `*Dưới đây là một số nguyên liệu tươi sạch thu hoạch trong ngày đang có sẵn tại nông trại, bạn có thể bấm xem hoặc thêm ngay vào giỏ hàng:*`;

      return res.json({
        success: true,
        reply: replyText,
        products: recommended.map(formatProductForChat)
      });
    }

    // 2.6. Tìm kiếm sản phẩm thông minh dựa trên từ khóa trong câu hỏi
    const matchedProducts = await findRelatedProducts(cleanLower);

    if (matchedProducts.length > 0) {
      const productNames = matchedProducts.map(p => `• **${p.name}** - ${p.price}`).join('\n');
      const replyText = `🌿 **Xanh Lá tìm thấy những sản phẩm tươi ngon chuẩn hữu cơ phù hợp nhất với bạn:**\n\n` +
        `${productNames}\n\n` +
        `*Tất cả đều được tuyển chọn kỹ lưỡng vào sáng sớm nay. Bạn có thể bấm vào thẻ sản phẩm bên dưới để xem chi tiết hoặc thêm vào giỏ hàng ngay nhé!*`;

      return res.json({
        success: true,
        reply: replyText,
        products: matchedProducts
      });
    }

    // 2.7. Lời chào và phản hồi thông minh mặc định (Friendly Assistant)
    const featured = await Product.find({ isActive: { $ne: false } }).sort({ stock: -1 }).limit(3);

    const defaultReply = `Xin chào bạn! Em là **Trợ lý AI Nông trại Xanh Lá** 🌿\n\n` +
      `Em có thể đồng hành cùng bạn:\n` +
      `• 🥗 **Tìm nông sản tươi:** Rau củ hữu cơ, trái cây sạch, thịt cá, sữa hạt, gia vị chuẩn sạch.\n` +
      `• 🍲 **Lên thực đơn dinh dưỡng:** Gợi ý món ăn ngon mỗi ngày cho bữa cơm gia đình đầm ấm.\n` +
      `• 🚚 **Kiểm tra đơn hàng:** Bạn chỉ cần gửi mã đơn (ví dụ: *#XL123456*), em sẽ tra cứu lộ trình xe lạnh ngay.\n` +
      `• 🎟️ **Ưu đãi & Voucher:** Cập nhật các mã giảm giá và miễn phí vận chuyển hôm nay.\n\n` +
      `Hôm nay bạn muốn Xanh Lá hỗ trợ món gì nào?`;

    return res.json({
      success: true,
      reply: defaultReply,
      products: featured.map(formatProductForChat)
    });

  } catch (err) {
    next(err);
  }
});

// Helper: Tìm sản phẩm liên quan
async function findRelatedProducts(cleanLower) {
  const productKeywords = extractProductKeywords(cleanLower);
  let matched = [];

  if (productKeywords.length > 0) {
    const searchRegex = new RegExp(productKeywords.join('|'), 'i');
    matched = await Product.find({
      isActive: { $ne: false },
      $or: [
        { name: { $regex: searchRegex } },
        { category: { $regex: searchRegex } },
        { categoryVi: { $regex: searchRegex } },
        { description: { $regex: searchRegex } }
      ]
    }).limit(4);
  }

  if (!matched || matched.length === 0) {
    if (cleanLower.includes('rau') || cleanLower.includes('cu')) {
      matched = await Product.find({ isActive: { $ne: false }, category: 'vegetables' }).limit(4);
    } else if (cleanLower.includes('trai cay') || cleanLower.includes('hoa qua')) {
      matched = await Product.find({ isActive: { $ne: false }, category: 'fruits' }).limit(4);
    } else if (cleanLower.includes('thit') || cleanLower.includes('bo') || cleanLower.includes('heo') || cleanLower.includes('ga')) {
      matched = await Product.find({ isActive: { $ne: false }, category: 'meat' }).limit(4);
    } else if (cleanLower.includes('ca') || cleanLower.includes('hai san') || cleanLower.includes('tom')) {
      matched = await Product.find({ isActive: { $ne: false }, category: 'seafood' }).limit(4);
    } else if (cleanLower.includes('sua') || cleanLower.includes('uong')) {
      matched = await Product.find({ isActive: { $ne: false }, category: { $in: ['dairy', 'beverages'] } }).limit(4);
    }
  }

  return (matched || []).map(formatProductForChat);
}

// Helper: Format Product for Chat Response
function formatProductForChat(p) {
  return {
    _id:         p._id.toString(),
    id:          p._id.toString(),
    name:        p.name,
    slug:        p.slug,
    price:       p.price,
    priceNumber: p.priceNumber,
    image:       p.image,
    category:    p.category,
    categoryVi:  p.categoryVi,
    stock:       p.stock,
  };
}

// Helper: Tách từ khóa thực phẩm
function extractProductKeywords(text) {
  const words = [
    'cai thia', 'cai ngot', 'cai cuc', 'mong toi', 'rau muong', 'bo xoi', 'xa lach', 'bap cai', 'ca chua', 'dua leo',
    'khoai tay', 'ca rot', 'nam', 'bap', 'bi do', 'su hao', 'khoai lang', 'bong cai',
    'tao', 'chuoi', 'cam', 'nho', 'le', 'xoai', 'bo', 'buoi', 'dau tay', 'viet quat', 'thanh long',
    'thit bo', 'ba chi', 'than ngoai', 'thit heo', 'thit ga', 'suon',
    'ca hoi', 'phi le', 'tom', 'muc', 'ca thu', 'hai san',
    'sua tuoi', 'sua hat', 'sua chua', 'pho mai',
    'nuoc ngot', 'nuoc ep', 'coca', 'pepsi', 'tra',
    'banh', 'snack', 'hat', 'gia vi', 'nuoc mam', 'hat nem', 'dau an'
  ];

  return words.filter(w => text.includes(w));
}

// Call Gemini AI
async function callGeminiAI(prompt, history, apiKey, persona) {
  if (!apiKey) return null;
  const products = await Product.find({ isActive: { $ne: false } }).limit(25).select('name price categoryVi slug');
  const catalogSnippet = products.map(p => `- ${p.name} (${p.price}, nhóm: ${p.categoryVi})`).join('\n');
  const systemInstruction = buildSystemPrompt(catalogSnippet, persona);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: systemInstruction + '\n\nKhách hàng hỏi: ' + prompt }] }
      ]
    })
  });

  if (!res.ok) return null;
  const json = await res.json();
  const replyText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return { text: replyText };
}

// Call OpenAI
async function callOpenAIAI(prompt, history, apiKey, persona) {
  if (!apiKey) return null;
  const products = await Product.find({ isActive: { $ne: false } }).limit(25).select('name price categoryVi slug');
  const catalogSnippet = products.map(p => `- ${p.name} (${p.price}, nhóm: ${p.categoryVi})`).join('\n');
  const systemInstruction = buildSystemPrompt(catalogSnippet, persona);

  const messages = [
    { role: 'system', content: systemInstruction },
    ...(history || []).slice(-4).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text })),
    { role: 'user', content: prompt }
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
    })
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  return { text };
}

module.exports = router;
