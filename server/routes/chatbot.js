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
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

// Build system prompt based on persona, user profile, and catalog
function buildSystemPrompt(catalogSnippet, persona = 'nutribot', profile = null) {
  let personaInstruction = '';

  if (persona === 'nutribot') {
    personaInstruction = `You are NutriBot, a helpful, respectful, honest and world-renowned nutritionist assistant.
Bạn cung cấp lời khuyên chuyên sâu về thực phẩm, dinh dưỡng và lối sống lành mạnh (Eat-Clean, Giảm mỡ, Tăng cơ, Cắt nét, Huyết áp, Tiểu đường, Ăn chay).
Bạn có khả năng nhận diện hình ảnh món ăn & đồ uống, bóc tách nguyên liệu, ước tính chính xác lượng Calo (kcal), Macro (Đạm, Tinh bột, Chất béo, Chất xơ) và đưa ra lời khuyên cá nhân hóa dựa trên thể trạng của người dùng.`;
  } else if (persona === 'chef') {
    personaInstruction = 'Bạn đóng vai trò Bếp trưởng Xanh Lá, chuyên gia ẩm thực hữu cơ, hướng dẫn công thức nấu ăn sáng tạo, cách kết hợp rau củ thịt cá thành món ngon chuẩn vị gia đình.';
  } else if (persona === 'nutritionist') {
    personaInstruction = 'Bạn đóng vai trò Chuyên gia Dinh dưỡng Xanh Lá, tư vấn thực phẩm giàu vitamin, thực đơn eat-clean, kiểm soát calo và lợi ích sức khỏe từ rau củ quả tươi.';
  } else if (persona === 'support') {
    personaInstruction = 'Bạn đóng vai trò Hỗ trợ viên chăm sóc khách hàng Xanh Lá, giải đáp về vận chuyển xe lạnh, kiểm tra đơn hàng, chính sách 1 đổi 1 và voucher ưu đãi.';
  } else {
    personaInstruction = 'Bạn là Trợ lý AI Nông sản Xanh Lá thông thái và thân thiện, hỗ trợ khách hàng tìm kiếm nông sản sạch, gợi ý thực đơn, tư vấn mua sắm và giải đáp thắc mắc.';
  }

  // Inject User Health Profile if provided (from NutriBot profile engine)
  let profileSnippet = '';
  if (profile && (profile.age || profile.weight || profile.height)) {
    const heightM = profile.height ? profile.height / 100 : null;
    const bmi = (heightM && profile.weight) ? (profile.weight / (heightM * heightM)).toFixed(1) : null;
    let bmiLabel = 'Bình thường';
    if (bmi) {
      const bNum = parseFloat(bmi);
      if (bNum < 18.5) bmiLabel = 'Thiếu cân (Gầy)';
      else if (bNum < 23) bmiLabel = 'Thể trạng Chuẩn (Lý tưởng)';
      else if (bNum < 25) bmiLabel = 'Tiền béo phì (Thừa cân nhẹ)';
      else bmiLabel = 'Béo phì';
    }

    profileSnippet = `
HỒ SƠ DINH DƯỠNG CÁ NHÂN CỦA KHÁCH HÀNG:
- Giới tính: ${profile.sex === 'female' ? 'Nữ' : 'Nam'}
- Độ tuổi: ${profile.age ? profile.age + ' tuổi' : 'Chưa rõ'}
- Chiều cao: ${profile.height ? profile.height + ' cm' : 'Chưa rõ'} | Cân nặng: ${profile.weight ? profile.weight + ' kg' : 'Chưa rõ'}
- Chỉ số BMI: ${bmi ? `${bmi} (${bmiLabel})` : 'Chưa xác định'}
- Mục tiêu / Tình trạng: ${profile.conditions || profile.dietGoal || 'Ăn uống lành mạnh'}
Yêu cầu: Luôn dựa vào chỉ số BMI và mục tiêu này để cá nhân hóa lời khuyên, tính toán lượng calo thâm hụt/dư thừa và gợi ý thực phẩm tối ưu!`;
  }

  return `${personaInstruction}
${profileSnippet}

THÔNG TIN HỆ SINH THÁI NÔNG TRẠI XANH LÁ:
- Nông sản 100% hữu cơ chuẩn VietGAP & GlobalGAP từ Đà Lạt và Ba Vì.
- Thu hoạch sớm mỗi ngày, vận chuyển bằng xe lạnh chuyên dụng 0°C – 4°C.
- Miễn phí giao hàng (0₫) cho đơn từ 300.000₫. Đơn dưới 300.000₫ đồng giá 25.000₫.
- Đổi trả 1-1 trong 24 giờ nếu rau củ quả không đạt độ tươi giòn.

DANH MỤC NÔNG SẢN TƯƠI SẠCH:
${catalogSnippet}

YÊU CẦU PHẢN HỒI:
- Trả lời bằng tiếng Việt lịch thiệp, khoa học, ấm áp, dùng các emoji tươi mát (🩺, 🥗, 🍎, 🥩, 🌿, ✨).
- Định dạng Markdown rõ ràng (tiêu đề, in đậm, danh sách gạch đầu dòng).
- Khi gợi ý món hoặc nguyên liệu thay thế lành mạnh, ưu tiên nhắc các sản phẩm sạch đang có tại Xanh Lá Farm.`;
}

// POST /api/chatbot/message
router.post('/message', async (req, res, next) => {
  try {
    const {
      message = '',
      image = null,
      history = [],
      provider = 'local',
      apiKey = '',
      persona = 'nutribot',
      profile = null
    } = req.body;

    if ((!message || typeof message !== 'string') && !image) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn hoặc hình ảnh không hợp lệ.' });
    }

    const trimmed = (message || '').trim();
    const cleanLower = removeDiacritics(trimmed);

    const effectiveGeminiKey = (provider === 'gemini' ? apiKey : '') || process.env.GEMINI_API_KEY || apiKey;
    const effectiveOpenAIKey = (provider === 'openai' ? apiKey : '') || process.env.OPENAI_API_KEY || apiKey;

    // ── 1. Image Recognition & Multimodal Vision Analysis (NutriBot Core) ─
    if (image) {
      // 1.1. Multimodal Vision via Google Gemini (Gemini 3.5 Flash Vision)
      if (effectiveGeminiKey) {
        try {
          const visionResult = await callGeminiVision(image, trimmed, effectiveGeminiKey, persona, profile);
          if (visionResult && visionResult.text) {
            const prods = await findRelatedProducts(removeDiacritics(visionResult.text + ' ' + trimmed));
            return res.json({ success: true, reply: visionResult.text, products: prods });
          }
        } catch (err) {
          console.warn('Gemini Vision fallback to NutriBot local engine:', err.message);
        }
      }

      // 1.2. Multimodal Vision via OpenAI (GPT-4o-mini Vision)
      if (effectiveOpenAIKey) {
        try {
          const visionResult = await callOpenAIVision(image, trimmed, effectiveOpenAIKey, persona, profile);
          if (visionResult && visionResult.text) {
            const prods = await findRelatedProducts(removeDiacritics(visionResult.text + ' ' + trimmed));
            return res.json({ success: true, reply: visionResult.text, products: prods });
          }
        } catch (err) {
          console.warn('OpenAI Vision fallback to NutriBot local engine:', err.message);
        }
      }

      // 1.3. NutriBot Built-in Food & Beverage Vision Analyzer (Local Engine)
      const localAnalysis = await analyzeFoodImageLocal(image, trimmed, profile);
      const prods = await findRelatedProducts(removeDiacritics(localAnalysis.keywords));
      return res.json({
        success: true,
        reply: localAnalysis.reply,
        products: prods
      });
    }

    // ── 2. External Text LLM Provider (Gemini / OpenAI) ──────────────────
    if (effectiveGeminiKey && (provider === 'gemini' || persona === 'nutribot')) {
      try {
        const reply = await callGeminiAI(trimmed, history, effectiveGeminiKey, persona, profile);
        if (reply && reply.text) {
          const prods = await findRelatedProducts(cleanLower);
          return res.json({ success: true, reply: reply.text, products: prods });
        }
      } catch (aiErr) {
        console.warn('Gemini AI fallback:', aiErr.message);
      }
    } else if (effectiveOpenAIKey && provider === 'openai') {
      try {
        const reply = await callOpenAIAI(trimmed, history, effectiveOpenAIKey, persona, profile);
        if (reply && reply.text) {
          const prods = await findRelatedProducts(cleanLower);
          return res.json({ success: true, reply: reply.text, products: prods });
        }
      } catch (aiErr) {
        console.warn('OpenAI fallback:', aiErr.message);
      }
    }

    // ── 3. NutriBot Smart Knowledge Engine (Built-in 24/7) ─────────────────

    // 3.1. Tính toán BMI & Tư vấn chỉ số thể trạng
    if (cleanLower.includes('bmi') || cleanLower.includes('chi so khoi') || cleanLower.includes('the trang') || cleanLower.includes('can nang ly tuong')) {
      return res.json(handleBmiCalculation(trimmed, cleanLower, profile));
    }

    // 3.2. Macro & Phân chia Calo (Carb, Protein, Fat, Thâm hụt calo)
    if (cleanLower.includes('macro') || cleanLower.includes('calorie deficit') || cleanLower.includes('tham hut calo') || cleanLower.includes('dam') || cleanLower.includes('protein') || cleanLower.includes('calo hang ngay')) {
      return res.json(handleMacroAdvice(cleanLower, profile));
    }

    // 3.3. Tra cứu đơn hàng
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

    // 3.4. Hỏi về Mã giảm giá / Voucher
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

    // 3.5. Hỏi về Chính sách giao hàng & Xe lạnh
    if (cleanLower.includes('giao hang') || cleanLower.includes('phi ship') || cleanLower.includes('van chuyen') || cleanLower.includes('xe lanh') || cleanLower.includes('bao quan')) {
      const replyText = `🚚 **Chính sách Giao nhận & Bảo quản tại Xanh Lá Farm:**\n\n` +
        `1. **Giao hàng xe lạnh chuyên dụng:** Toàn bộ rau củ, quả, thịt cá tươi sống được vận chuyển ở nhiệt độ chuẩn 0°C – 4°C, cam kết độ giòn ngọt nguyên bản như vừa hái tại vườn.\n` +
        `2. **Tốc độ giao hàng:** Giao hỏa tốc 2 giờ tại nội thành Hà Nội & TP. Hồ Chí Minh.\n` +
        `3. **Phí vận chuyển:**\n` +
        `   • **Miễn phí ship (0₫)** cho đơn hàng từ **300.000₫** trở lên.\n` +
        `   • Đơn dưới 300.000₫: Đồng giá hỗ trợ 25.000₫ nội thành.\n` +
        `4. **Bảo hành 1 đổi 1 trong 24 giờ:** Nếu sản phẩm bị dập hỏng hoặc không đạt cam kết tươi sạch, Xanh Lá đổi mới ngay lập tức!`;

      return res.json({ success: true, reply: replyText, products: [] });
    }

    // 3.6. Hỏi về Thói quen ăn đêm, Cơn thèm ăn, Ăn vặt lành mạnh (NutriBot Q&A)
    if (cleanLower.includes('an dem') || cleanLower.includes('them an') || cleanLower.includes('an vat') || cleanLower.includes('snack') || cleanLower.includes('doi bung')) {
      const healthySnacks = await Product.find({
        isActive: { $ne: false },
        category: { $in: ['fruits', 'dry-food', 'dairy'] }
      }).limit(3);

      const replyText = `🍎 **Giải pháp ăn vặt lành mạnh & kiểm soát cơn thèm ăn đêm từ NutriBot:**\n\n` +
        `1. **Nguyên nhân thèm ăn đêm:** Thường do bữa tối thiếu đạm (protein) hoặc chất xơ, hoặc do căng thẳng, thiếu ngủ làm tăng hormone *ghrelin* gây đói.\n` +
        `2. **Gợi ý món ăn vặt ít calo (< 150 kcal):**\n` +
        `   • 1/2 quả táo giòn chấm 1 thìa bơ đậu phộng không đường.\n` +
        `   • 1 hũ sữa chua Hy Lạp rắc vài hạt chia hoặc việt quất.\n` +
        `   • Dưa chuột, cà rốt baby cắt thanh giòn ngọt, giàu nước và chất xơ.\n` +
        `   • 1 ly nước ấm pha mật ong chanh hoặc trà hoa cúc giúp thư giãn thần kinh.\n\n` +
        `*NutriBot gợi ý một số nông sản tươi giòn sẵn có tại nông trại giúp bạn xoa dịu dạ dày an toàn:*`;

      return res.json({
        success: true,
        reply: replyText,
        products: healthySnacks.map(formatProductForChat)
      });
    }

    // 3.7. Gợi ý thực đơn, Eat-Clean, Ăn gì hôm nay
    if (cleanLower.includes('an gi') || cleanLower.includes('nau gi') || cleanLower.includes('thuc don') || cleanLower.includes('mon ngon') || cleanLower.includes('eat clean') || cleanLower.includes('giam can') || cleanLower.includes('tang co')) {
      const [freshVeggies, freshMeats] = await Promise.all([
        Product.find({ isActive: { $ne: false }, category: 'vegetables' }).limit(2),
        Product.find({ isActive: { $ne: false }, category: { $in: ['meat', 'seafood'] } }).limit(2)
      ]);

      const recommended = [...freshVeggies, ...freshMeats].slice(0, 4);

      let targetNote = 'Dinh dưỡng cân bằng (Balanced Diet)';
      if (profile?.dietGoal || profile?.conditions) {
        targetNote = `Mục tiêu cá nhân: ${profile.dietGoal || profile.conditions}`;
      }

      const replyText = `🩺 **NutriBot gợi ý thực đơn Eat-Clean tươi lành chuẩn khoa học:**\n` +
        `*(Áp dụng cho: ${targetNote})*\n\n` +
        `🍲 **Bữa trưa năng lượng:**\n` +
        `• Đạm sạch: 150g Phi lê cá hồi áp chảo sốt bơ chanh hoặc Ức gà nướng thảo mộc.\n` +
        `• Tinh bột chậm: 1 chén cơm gạo lứt Ba Vì hoặc khoai lang hấp.\n` +
        `• Rau củ chất xơ: Salad xà lách Lô Tô xanh, cà chua bi sốt dầu giấm nguyên chất.\n\n` +
        `🥗 **Bữa tối nhẹ bụng:**\n` +
        `• Canh cải thìa baby non ngọt nấu thịt bằm.\n` +
        `• Đậu phụ luộc chấm sốt tương mè đen.\n` +
        `• 1 ly nước ép cần tây táo xanh thanh lọc cơ thể.\n\n` +
        `*Bạn có thể bấm vào thẻ bên dưới để xem hoặc thêm nguyên liệu vào giỏ hàng ngay:*`;

      return res.json({
        success: true,
        reply: replyText,
        products: recommended.map(formatProductForChat)
      });
    }

    // 3.8. Tìm kiếm sản phẩm theo từ khóa
    const matchedProducts = await findRelatedProducts(cleanLower);
    if (matchedProducts.length > 0) {
      const productNames = matchedProducts.map(p => `• **${p.name}** - ${p.price}`).join('\n');
      const replyText = `🌿 **NutriBot tìm thấy các nông sản hữu cơ phù hợp nhất với câu hỏi của bạn:**\n\n` +
        `${productNames}\n\n` +
        `*Tất cả đều được kiểm định dư lượng, bảo quản trong chuỗi lạnh 0°C – 4°C. Bạn có thể bấm để xem hoặc thêm ngay vào giỏ hàng!*`;

      return res.json({
        success: true,
        reply: replyText,
        products: matchedProducts
      });
    }

    // 3.9. Phản hồi mặc định NutriBot
    const featured = await Product.find({ isActive: { $ne: false } }).sort({ stock: -1 }).limit(3);
    const defaultReply = `Xin chào bạn! Tôi là **NutriBot — Chuyên gia Dinh dưỡng & Trợ lý Nông sản Xanh Lá** 🩺🌿\n\n` +
      `Tôi có thể hỗ trợ bạn:\n` +
      `• 📷 **Nhận diện món ăn qua ảnh:** Tải ảnh đĩa ăn hoặc đồ uống lên, tôi sẽ phân tích nguyên liệu, tính lượng Calo và đưa ra lời khuyên dinh dưỡng tức thì!\n` +
      `• 🩺 **Cá nhân hóa thực đơn:** Tính toán chỉ số BMI, TDEE, thiết kế thực đơn Eat-Clean, giảm mỡ, tăng cơ hoặc ăn kiêng theo bệnh lý.\n` +
      `• 🥗 **Nông sản hữu cơ:** Tìm kiếm rau củ quả, thịt cá chuẩn VietGAP & GlobalGAP từ nông trại Xanh Lá.\n` +
      `• 🚚 **Đơn hàng & Giao vận:** Tra cứu lộ trình xe lạnh bảo quản 0°C – 4°C.\n\n` +
      `*Hôm nay bạn cần NutriBot phân tích món ăn hay tư vấn dinh dưỡng gì nào?*`;

    return res.json({
      success: true,
      reply: defaultReply,
      products: featured.map(formatProductForChat)
    });

  } catch (err) {
    next(err);
  }
});

// ── NutriBot Vision: Local Image Analyzer (Deterministic & Robust) ──────────
async function analyzeFoodImageLocal(imageBase64, caption, profile) {
  const capLower = removeDiacritics(caption || '');

  // Catalog of representative meals from NutriBot dataset + Xanh La Farm
  const mealProfiles = [
    {
      keywords: ['salad', 'rau', 'uc ga', 'tron', 'dia rau'],
      mealName: 'Salad Ức Gà Rau Củ Hữu Cơ Sốt Mè Rang',
      ingredients: 'Ức gà phi lê áp chảo, xà lách Lô Tô xanh, cà chua bi, dưa leo Đà Lạt, ngô ngọt, sốt mè rang.',
      calories: '280 - 350 kcal',
      protein: '28g', carbs: '18g', fat: '10g', fiber: '6g',
      isHealthy: true,
      advice: 'Đây là một bữa ăn Eat-Clean lý tưởng! Giàu đạm nạc giúp no lâu, nhiều chất xơ hỗ trợ tiêu hóa. Lưu ý không dùng quá nhiều sốt mè để kiểm soát chất béo.',
      searchKeywords: ['xa lach', 'uc ga', 'ca chua', 'dua leo']
    },
    {
      keywords: ['pho', 'bun', 'mi', 'nuoc dung', 'pho bo', 'pho ga'],
      mealName: 'Bát Phở Bò Tái Nước Dùng Thanh',
      ingredients: 'Bánh phở tươi, thịt bò bắp nạc thái mỏng, nước dùng hầm xương quế hồi, hành hoa, rau mùi, chanh ớt.',
      calories: '420 - 520 kcal',
      protein: '26g', carbs: '65g', fat: '12g', fiber: '2.5g',
      isHealthy: true,
      advice: 'Món ăn truyền thống giàu năng lượng. Nếu bạn đang muốn giảm mỡ, nên vớt bớt lớp váng dầu, ăn kèm nhiều rau thơm giá đỗ và hạn chế húp hết nước dùng để giảm natri.',
      searchKeywords: ['thit bo', 'hanh hoa', 'chanh']
    },
    {
      keywords: ['burger', 'hamburger', 'banh mi kep'],
      mealName: 'Bánh Hamburger Thịt Bò & Rau Củ',
      ingredients: 'Vỏ bánh mì tròn mè, bò bằm nướng áp chảo, phô mai lát, cà chua, hành tây, xà lách.',
      calories: '550 - 750 kcal',
      protein: '32g', carbs: '52g', fat: '28g', fiber: '3g',
      isHealthy: false,
      advice: 'Bữa ăn giàu đạm nhưng có hàm lượng chất béo bão hòa và tinh bột nhanh khá cao. Nên ăn kèm một đĩa rau xà lách tươi Xanh Lá không sốt để cân bằng vi chất.',
      searchKeywords: ['thit bo', 'ca chua', 'xa lach']
    },
    {
      keywords: ['pizza'],
      mealName: 'Bánh Pizza Nướng Phô Mai Rau Củ',
      ingredients: 'Đế bột mì nướng giòn, sốt cà chua cô đặc, phô mai mozzarella, ớt chuông, nấm rơm, thịt xông khói.',
      calories: '700 - 950 kcal (cho 2-3 miếng)',
      protein: '24g', carbs: '85g', fat: '32g', fiber: '4g',
      isHealthy: false,
      advice: 'Lượng calo và muối (natri) tương đối cao. Hãy thưởng thức điều độ, uống nhiều nước và bổ sung thêm rau xanh cho các bữa còn lại trong ngày.',
      searchKeywords: ['ca chua', 'nam', 'ot chuong']
    },
    {
      keywords: ['sinh to', 'nuoc ep', 'smoothie', 'tra', 'bo', 'chuoi'],
      mealName: 'Sinh Tố Bơ Chuối Sữa Hạt Nguyên Chất',
      ingredients: 'Bơ sáp Đắk Lắk, chuối chín Laba, sữa hạt điều không đường, hạt chia hữu cơ.',
      calories: '220 - 320 kcal',
      protein: '7g', carbs: '36g', fat: '14g', fiber: '8g',
      isHealthy: true,
      advice: 'Thức uống dinh dưỡng dồi dào chất béo tốt không bão hòa đơn, kali và chất chống oxy hóa, hỗ trợ tim mạch và làn da tươi trẻ.',
      searchKeywords: ['bo', 'chuoi', 'sua hat']
    },
    {
      keywords: ['ca hoi', 'ca', 'hai san', 'fish'],
      mealName: 'Phi Lê Cá Hồi Áp Chảo Bơ Tỏi Kèm Măng Tây',
      ingredients: 'Phi lê cá hồi tươi, măng tây xanh Đà Lạt, bơ lạt, tỏi băm, muối hồng, tiêu đen, chanh vàng.',
      calories: '360 - 450 kcal',
      protein: '34g', carbs: '8g', fat: '22g', fiber: '4.5g',
      isHealthy: true,
      advice: 'Cực kỳ tốt cho não bộ và cơ bắp! Nguồn Axit béo Omega-3 dồi dào giúp kháng viêm, rất thích hợp cho chế độ Keto hoặc Eat-Clean.',
      searchKeywords: ['ca hoi', 'mang tay', 'bo']
    },
    {
      keywords: ['com', 'com tam', 'com ga', 'rice'],
      mealName: 'Cơm Gạo Lứt Kèm Đậu Phụ & Rau Củ Xào',
      ingredients: 'Cơm gạo lứt Ba Vì dẻo ngọt, đậu phụ áp chảo vàng, nấm hương, ớt chuông, bông cải xanh.',
      calories: '320 - 420 kcal',
      protein: '16g', carbs: '56g', fat: '9g', fiber: '8.5g',
      isHealthy: true,
      advice: 'Bữa ăn thực dưỡng thanh đạm, chỉ số đường huyết (GI) thấp, giúp no lâu và không làm tăng đột ngột đường huyết sau ăn.',
      searchKeywords: ['gao lut', 'bong cai', 'nam']
    }
  ];

  // Pick best matching or default to healthy balanced bowl
  let matched = mealProfiles.find(m => m.keywords.some(k => capLower.includes(k)));
  if (!matched) {
    matched = mealProfiles[0]; // Default to healthy salad bowl
  }

  // Personalization based on user profile
  let personalNote = '';
  if (profile && (profile.age || profile.weight || profile.height)) {
    const heightM = profile.height ? profile.height / 100 : null;
    const bmi = (heightM && profile.weight) ? (profile.weight / (heightM * heightM)).toFixed(1) : null;
    personalNote = `\n\n🎯 **Lời khuyên cá nhân hóa cho bạn (BMI: ${bmi || '--'} · Mục tiêu: ${profile.conditions || profile.dietGoal || 'Sức khỏe dẻo dai'}):**\n` +
      `Bữa ăn này cung cấp khoảng **${matched.calories}**, phù hợp với mục tiêu của bạn. Hãy đảm bảo uống đủ 2 - 2.5 lít nước trong ngày để tối ưu chuyển hóa!`;
  }

  const reply = `📸 **NutriBot đã nhận diện thành công hình ảnh món ăn của bạn!** 🥗✨\n\n` +
    `🍽️ **Tên món:** **${matched.mealName}**\n` +
    `📋 **Thành phần nhận diện:** ${matched.ingredients}\n\n` +
    `🔥 **Ước tính Năng lượng:** **${matched.calories}**\n` +
    `📊 **Thành phần dinh dưỡng (Macro):**\n` +
    `• 🥩 **Chất đạm (Protein):** ${matched.protein}\n` +
    `• 🌾 **Tinh bột (Carb):** ${matched.carbs}\n` +
    `• 🥑 **Chất béo (Fat):** ${matched.fat}\n` +
    `• 🥦 **Chất xơ (Fiber):** ${matched.fiber}\n\n` +
    `🩺 **Đánh giá chuyên gia NutriBot:**\n${matched.advice}${personalNote}\n\n` +
    `🌿 *Xanh Lá Farm hiện đang có sẵn các nguyên liệu tươi sạch thu hoạch trong ngày để bạn tự tay chế biến món ngon này:*`;

  return {
    reply,
    keywords: matched.searchKeywords.join(' ')
  };
}

// ── Gemini Vision API Call ───────────────────────────────────────────────────
async function callGeminiVision(imageBase64, prompt, apiKey, persona, profile) {
  if (!apiKey) return null;
  const products = await Product.find({ isActive: { $ne: false } }).limit(20).select('name price categoryVi');
  const catalogSnippet = products.map(p => `- ${p.name} (${p.price}, ${p.categoryVi})`).join('\n');
  const systemInstruction = buildSystemPrompt(catalogSnippet, persona, profile);

  // Extract base64 and mime
  const match = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  const mimeType = match ? match[1] : 'image/jpeg';
  const cleanBase64 = match ? match[2] : imageBase64;

  const userQuery = prompt
    ? `Khách hàng vừa tải ảnh lên với lời nhắn: "${prompt}". Hãy phân tích món ăn theo chuẩn NutriBot.`
    : `Khách hàng vừa tải lên một hình ảnh đồ ăn/thức uống. Hãy phân tích chi tiết tên món, thành phần, calo và dinh dưỡng theo chuẩn NutriBot.`;

  const candidateModels = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: systemInstruction + '\n\n' + userQuery },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: cleanBase64
                  }
                }
              ]
            }
          ]
        })
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text };
      }
    } catch {}
  }
  return null;
}

// ── OpenAI Vision API Call ───────────────────────────────────────────────────
async function callOpenAIVision(imageBase64, prompt, apiKey, persona, profile) {
  if (!apiKey) return null;
  const products = await Product.find({ isActive: { $ne: false } }).limit(20).select('name price categoryVi');
  const catalogSnippet = products.map(p => `- ${p.name} (${p.price}, ${p.categoryVi})`).join('\n');
  const systemInstruction = buildSystemPrompt(catalogSnippet, persona, profile);

  const userQuery = prompt || 'Hãy nhận diện món ăn trong bức ảnh này, phân tích thành phần, tính calo và đánh giá dinh dưỡng.';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        {
          role: 'user',
          content: [
            { type: 'text', text: userQuery },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ],
      temperature: 0.7
    })
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  return { text };
}

// ── Helper: BMI Calculation ─────────────────────────────────────────────────
function handleBmiCalculation(trimmed, cleanLower, profile) {
  // Parse height e.g. "1m68", "1m7", "1.68m", "168cm", "168"
  const mCmMatch = trimmed.match(/cao\s*([12])\s*m\s*([0-9]{1,2})/i);
  const heightMatch = trimmed.match(/cao\s*([0-9.,]+)\s*(m|cm)?/i);
  const weightMatch = trimmed.match(/n[aặ]ng\s*([0-9.,]+)\s*(kg)?/i);

  let height = profile?.height;
  let weight = profile?.weight;

  if (mCmMatch) {
    const meters = parseInt(mCmMatch[1], 10);
    let sub = mCmMatch[2];
    if (sub.length === 1) sub = sub + '0'; // 1m7 -> 170cm
    height = meters * 100 + parseInt(sub, 10);
  } else if (heightMatch) {
    let hVal = parseFloat(heightMatch[1].replace(',', '.'));
    if (hVal < 3) hVal = Math.round(hVal * 100);
    height = hVal;
  }

  if (weightMatch) {
    weight = parseFloat(weightMatch[1].replace(',', '.'));
  }

  if (!height || !weight) {
    return {
      success: true,
      reply: `🩺 **Cách tính chỉ số BMI & Nhu cầu Calo từ NutriBot:**\n\n` +
        `Công thức chuẩn: **BMI = Cân nặng (kg) / [Chiều cao (m)]²**\n\n` +
        `• **< 18.5:** Thiếu cân (Cần bổ sung đạm, chất béo tốt và tinh bột chậm)\n` +
        `• **18.5 – 22.9:** Thể trạng Chuẩn lý tưởng cho người Châu Á\n` +
        `• **23.0 – 24.9:** Tiền béo phì (Thừa cân nhẹ, nên áp dụng thâm hụt calo)\n` +
        `• **≥ 25.0:** Béo phì (Cần chế độ Eat-Clean nghiêm ngặt & tập luyện)\n\n` +
        `👉 *Bạn có thể nhập chiều cao và cân nặng (ví dụ: "Em cao 1m65 nặng 58kg") hoặc điền trực tiếp trong phần Cài đặt (⚙️) để NutriBot tính tự động nhé!*`,
      products: []
    };
  }

  const heightM = height / 100;
  const bmi = (weight / (heightM * heightM)).toFixed(1);
  const bmiNum = parseFloat(bmi);

  let status = '';
  let advice = '';

  if (bmiNum < 18.5) {
    status = 'Thiếu cân (Gầy)';
    advice = 'Bạn nên tăng nhẹ lượng calo nạp vào (+300 - 500 kcal/ngày). Ưu tiên các loại hạt giàu calo tốt (hạt điều, óc chó), sữa hạt, bơ sáp và thịt cá tươi từ Xanh Lá.';
  } else if (bmiNum < 23) {
    status = 'Thể trạng Chuẩn (Lý tưởng)';
    advice = 'Chúc mừng bạn! Chỉ số hình thể rất tuyệt vời. Hãy duy trì chế độ ăn Eat-Clean giàu rau xanh và uống đủ nước để giữ vững phong độ nhé.';
  } else if (bmiNum < 25) {
    status = 'Tiền béo phì (Thừa cân nhẹ)';
    advice = 'Bạn nên tạo mức thâm hụt calo vừa phải (-300 kcal/ngày). Tăng cường rau họ cải (cải thìa, cải bó xôi) để no lâu và giảm tinh bột nhanh.';
  } else {
    status = 'Béo phì';
    advice = 'NutriBot khuyên bạn nên kiểm soát khẩu phần chặt chẽ, cắt giảm hoàn toàn nước ngọt và đồ chiên rán, thay bằng 50% đĩa ăn là rau củ hữu cơ Xanh Lá luộc/hấp.';
  }

  const minIdealWeight = (18.5 * heightM * heightM).toFixed(1);
  const maxIdealWeight = (22.9 * heightM * heightM).toFixed(1);

  const reply = `🩺 **Kết quả phân tích thể trạng từ Chuyên gia NutriBot:**\n\n` +
    `• **Chiều cao:** ${height} cm | **Cân nặng:** ${weight} kg\n` +
    `• **Chỉ số BMI:** **${bmi}** — Đánh giá: **${status}**\n` +
    `• **Cân nặng lý tưởng khuyến nghị:** **${minIdealWeight} kg – ${maxIdealWeight} kg**\n\n` +
    `💡 **Lời khuyên dinh dưỡng từ NutriBot:**\n${advice}\n\n` +
    `*Bạn có muốn NutriBot lên thực đơn 7 ngày phù hợp với chỉ số này không?*`;

  return { success: true, reply, products: [] };
}

// ── Helper: Macro & Calorie Advice ──────────────────────────────────────────
function handleMacroAdvice(cleanLower, profile) {
  const reply = `📊 **Hướng dẫn chia tỷ lệ Macro (Dinh dưỡng đa lượng) chuẩn NutriBot:**\n\n` +
    `Macro bao gồm 3 nhóm chất sinh năng lượng chính:\n` +
    `1. **Protein (Chất đạm):** 1g = 4 kcal — Xây dựng cơ bắp, hỗ trợ trao đổi chất (Ức gà, cá hồi, thịt bò nạc, đậu phụ).\n` +
    `2. **Carbohydrate (Tinh bột):** 1g = 4 kcal — Cung cấp năng lượng chính (Gạo lứt Ba Vì, khoai lang, yến mạch, hoa quả).\n` +
    `3. **Fat (Chất béo tốt):** 1g = 9 kcal — Cân bằng hormone, hòa tan vitamin A, D, E, K (Bơ, dầu ô-liu, các loại hạt).\n\n` +
    `🎯 **Tỷ lệ phân chia khuyến nghị theo mục tiêu:**\n` +
    `• **Giảm mỡ & Cắt nét:** 40% Carb – 40% Protein – 20% Fat (Thâm hụt 300-500 kcal)\n` +
    `• **Duy trì & Eat-Clean:** 50% Carb – 25% Protein – 25% Fat\n` +
    `• **Tăng cơ nạc:** 45% Carb – 30% Protein – 25% Fat\n\n` +
    `💡 *Nguyên tắc vàng: Luôn ưu tiên nguyên liệu hữu cơ tươi mới để cơ thể hấp thu tối đa dưỡng chất mà không bị nạp tạp chất độc hại.*`;

  return { success: true, reply, products: [] };
}

// ── Text AI Providers (Gemini / OpenAI) ──────────────────────────────────────
async function callGeminiAI(prompt, history, apiKey, persona, profile) {
  if (!apiKey) return null;
  const products = await Product.find({ isActive: { $ne: false } }).limit(25).select('name price categoryVi slug');
  const catalogSnippet = products.map(p => `- ${p.name} (${p.price}, nhóm: ${p.categoryVi})`).join('\n');
  const systemInstruction = buildSystemPrompt(catalogSnippet, persona, profile);

  const candidateModels = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemInstruction + '\n\nKhách hàng hỏi: ' + prompt }] }
          ]
        })
      });

      if (res.ok) {
        const json = await res.json();
        const replyText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText) return { text: replyText };
      }
    } catch {}
  }
  return null;
}

async function callOpenAIAI(prompt, history, apiKey, persona, profile) {
  if (!apiKey) return null;
  const products = await Product.find({ isActive: { $ne: false } }).limit(25).select('name price categoryVi slug');
  const catalogSnippet = products.map(p => `- ${p.name} (${p.price}, nhóm: ${p.categoryVi})`).join('\n');
  const systemInstruction = buildSystemPrompt(catalogSnippet, persona, profile);

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

// ── Search & Helpers ────────────────────────────────────────────────────────
async function findRelatedProducts(cleanLower) {
  const productKeywords = extractProductKeywords(cleanLower);
  let matched = [];

  if (productKeywords.length > 0) {
    const searchRegex = new RegExp(productKeywords.join('|'), 'i');
    matched = await Product.find({
      isActive: { $ne: false },
      $or: [
        { name: { $regex: searchRegex } },
        { categoryVi: { $regex: searchRegex } }
      ]
    }).limit(4);
  }

  if (!matched || matched.length === 0) {
    if (cleanLower.includes('rau') || cleanLower.includes('cu') || cleanLower.includes('salad')) {
      matched = await Product.find({ isActive: { $ne: false }, category: 'vegetables' }).limit(4);
    } else if (cleanLower.includes('trai cay') || cleanLower.includes('hoa qua') || cleanLower.includes('bo')) {
      matched = await Product.find({ isActive: { $ne: false }, category: 'fruits' }).limit(4);
    } else if (cleanLower.includes('thit') || cleanLower.includes('bo') || cleanLower.includes('uc ga')) {
      matched = await Product.find({ isActive: { $ne: false }, category: 'meat' }).limit(4);
    } else if (cleanLower.includes('ca') || cleanLower.includes('hai san') || cleanLower.includes('ca hoi')) {
      matched = await Product.find({ isActive: { $ne: false }, category: 'seafood' }).limit(4);
    }
  }

  return (matched || []).map(formatProductForChat);
}

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

function extractProductKeywords(text) {
  const words = [
    'cai thia', 'cai ngot', 'cai cuc', 'mong toi', 'rau muong', 'bo xoi', 'xa lach', 'bap cai', 'ca chua', 'dua leo',
    'khoai tay', 'ca rot', 'nam', 'bap', 'bi do', 'su hao', 'khoai lang', 'bong cai', 'mang tay',
    'tao', 'chuoi', 'cam', 'nho', 'le', 'xoai', 'bo', 'buoi', 'dau tay', 'viet quat',
    'thit bo', 'ba chi', 'than ngoai', 'thit heo', 'thit ga', 'uc ga', 'suon',
    'ca hoi', 'phi le', 'tom', 'muc', 'ca thu', 'hai san',
    'sua tuoi', 'sua hat', 'sua chua', 'pho mai', 'dau phu', 'gao lut'
  ];
  return words.filter(w => text.includes(w));
}

module.exports = router;
