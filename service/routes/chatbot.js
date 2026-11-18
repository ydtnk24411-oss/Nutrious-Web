const router = require('express').Router();
const path = require('path');
if (!process.env.GEMINI_API_KEY) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
  } catch {}
}
const Product = require('../models/Product');
const Order = require('../models/Order');
const Voucher = require('../models/Voucher');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const ChatbotKnowledge = require('../models/ChatbotKnowledge');
const { optionalAuth } = require('../middleware/auth');

const KNOWLEDGE_CACHE_TTL_MS = 60000;
let cachedKnowledge = null;
let cachedKnowledgeAt = 0;

async function getChatbotKnowledge() {
  if (cachedKnowledge && Date.now() - cachedKnowledgeAt < KNOWLEDGE_CACHE_TTL_MS) {
    return cachedKnowledge;
  }
  const doc = await ChatbotKnowledge.findOne({ key: 'main' }).lean();
  if (doc) {
    cachedKnowledge = doc;
    cachedKnowledgeAt = Date.now();
    return doc;
  }
  return {};
}

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

// Build system prompt based on MongoDB personaPrompts, systemPromptMeta, user profile, and catalog
function buildSystemPrompt(knowledge, catalogSnippet, persona = 'nutribot', profile = null) {
  const prompts = knowledge?.personaPrompts || {};
  const personaInstruction = prompts[persona] || prompts.default || '';
  const meta = knowledge?.systemPromptMeta || {};

  let profileSnippet = '';
  if (profile && (profile.age || profile.weight || profile.height)) {
    const heightM = profile.height ? profile.height / 100 : null;
    const bmi = (heightM && profile.weight) ? (profile.weight / (heightM * heightM)).toFixed(1) : null;
    let bmiLabel = 'Bình thường';
    if (bmi) {
      const bNum = parseFloat(bmi);
      const bands = knowledge?.bmiConfig?.bands || [];
      const matchedBand = bands.find((b) => b.maxBmi === null || b.maxBmi === undefined || bNum < b.maxBmi);
      if (matchedBand?.status) bmiLabel = matchedBand.status;
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

${meta.ecosystemInfo || ''}

DANH MỤC NÔNG SẢN TƯƠI SẠCH:
${catalogSnippet}

${meta.responseRules || ''}`;
}

async function logMessageToConv(conv, userMsg, botReply) {
  if (!conv) return;
  try {
    conv.messages.push({
      sender: 'customer',
      senderName: conv.customerName || 'Khách hàng',
      senderAvatar: conv.customerAvatar || '',
      content: userMsg || '[Hình ảnh]',
      timestamp: new Date(),
    });
    conv.messages.push({
      sender: 'ai',
      senderName: 'NutriBot',
      senderAvatar: 'https://api.iconify.design/lucide:bot.svg?color=%23176b3a',
      content: botReply,
      timestamp: new Date(),
    });
    conv.lastMessage = botReply;
    conv.lastMessageAt = new Date();
    await conv.save();
  } catch (_) {}
}

// Helper: Check if question involves internal operational/financial issues that AI cannot resolve
function isInternalIssueRequiringHuman(cleanLower) {
  const paymentIssues = /(da tru tien|bi tru tien|tru tien ma chua|chuyen khoan nham|sai cu phap|chuyen tien roi ma|loi thanh toan|treo tien|tien chua vao|sao ke ngan hang|chuyen sai so tai khoan)/i.test(cleanLower);
  const refundIssues = /(yeu cau hoan tien|hoan lai tien|doi lai tien|tra lai tien|hoan tien vao tai khoan|boi thuong tien)/i.test(cleanLower);
  const accountIssues = /(khoa tai khoan|bi khoa nick|mat tai khoan|khoi phuc tai khoan|tranh chap hoa don|xuat hoa don vat doanh nghiep)/i.test(cleanLower);

  if (paymentIssues) {
    return {
      type: 'payment',
      reason: 'Vấn đề **thanh toán, trừ tiền hoặc giao dịch ngân hàng** liên quan đến việc tra soát sao kê nội bộ trên hệ sinh thái tài chính Evergreen Mart.',
    };
  }
  if (refundIssues) {
    return {
      type: 'refund',
      reason: 'Yêu cầu **hoàn tiền hoặc bồi thường tài chính** thuộc nghiệp vụ kế toán nội bộ và cần được nhân viên phụ trách xác nhận thủ tục hoàn tiền.',
    };
  }
  if (accountIssues) {
    return {
      type: 'account',
      reason: 'Vấn đề **bảo mật tài khoản hoặc hóa đơn thuế doanh nghiệp** cần chuyên viên quản trị xác minh trực tiếp để đảm bảo quyền lợi.',
    };
  }
  return null;
}

function isExplicitHumanRequest(cleanLower, requestHumanFlag) {
  if (requestHumanFlag === true || requestHumanFlag === 'true') return true;
  return /^(gap nhan vien|gap tu van|nhan vien ho tro|tu van vien|gap nguoi|gap admin|chuyen nhan vien|gap cskh|nhan vien truc tiep)$/i.test(cleanLower) ||
         /(muon gap|can gap|cho gap|chuyen gap|chuyen toi|noi chuyen voi|gap truc tiep) (nhan vien|tu van|cskh|nguoi that|admin)/i.test(cleanLower);
}

// POST /api/chatbot/message
router.post('/message', optionalAuth, async (req, res, next) => {
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

    const knowledge = await getChatbotKnowledge();
    const replies = knowledge?.cannedReplies || {};
    const trimmed = (message || '').trim();
    const cleanLower = removeDiacritics(trimmed);

    const authUser = req.user;
    let customerId = authUser ? authUser._id : (req.body.customerId || req.body.customerInfo?.id || req.body.customerInfo?._id || null);
    let customerName = authUser ? authUser.name : (req.body.customerName || req.body.customerInfo?.name || '');
    let customerEmail = authUser ? authUser.email : (req.body.customerEmail || req.body.customerInfo?.email || '');
    let customerPhone = authUser ? (authUser.phone || '') : (req.body.customerPhone || req.body.customerInfo?.phone || '');
    let customerAvatar = authUser ? (authUser.avatar || '') : (req.body.customerAvatar || req.body.customerInfo?.avatar || '');

    if (!customerId && customerEmail) {
      try {
        const u = await User.findOne({ email: customerEmail.toLowerCase().trim() });
        if (u) {
          customerId = u._id;
          if (!customerName) customerName = u.name;
          if (!customerPhone && u.phone) customerPhone = u.phone;
          if (!customerAvatar && u.avatar) customerAvatar = u.avatar;
        }
      } catch (_) {}
    }

    const sessionId = req.body.sessionId || req.body.userId || 'guest_chat_session';
    let conv = null;
    try {
      if (customerId) {
        conv = await Conversation.findOne({ customer: customerId });
      }
      if (!conv && customerEmail) {
        conv = await Conversation.findOne({ customerEmail: customerEmail.toLowerCase().trim() });
      }
      if (!conv && sessionId) {
        conv = await Conversation.findOne({ sessionId });
      }

      if (!conv) {
        conv = new Conversation({
          sessionId,
          customer: customerId,
          customerName: customerName || 'Khách hàng',
          customerEmail,
          customerPhone,
          customerAvatar,
          messages: [],
        });
      } else {
        if (sessionId && conv.sessionId !== sessionId) {
          conv.sessionId = sessionId;
        }
        if (!conv.customer && customerId) conv.customer = customerId;
        if ((!conv.customerName || conv.customerName === 'Khách hàng') && customerName) {
          conv.customerName = customerName;
        }
        if (!conv.customerEmail && customerEmail) conv.customerEmail = customerEmail;
        if (!conv.customerPhone && customerPhone) conv.customerPhone = customerPhone;
        if (!conv.customerAvatar && customerAvatar) conv.customerAvatar = customerAvatar;
      }
    } catch (_) {}

    // 1. Quay lại hỏi Trợ lý AI
    const wantsAiReturn = req.body.switchToAi === true ||
      /^(tro ve ai|quay lai ai|hoi ai|gap ai|tro lai ai|quay ve ai|tro ve bot|quay lai bot)$/i.test(cleanLower) ||
      /(tro ve|quay lai|noi chuyen voi) (tro ly ai|nutribot|bot|ai)/i.test(cleanLower);

    if (wantsAiReturn && conv) {
      conv.status = 'AI_PROCESSING';
      const returnMsg = {
        sender: 'ai',
        senderName: 'NutriBot',
        senderAvatar: 'https://api.iconify.design/lucide:bot.svg?color=%23176b3a',
        content: replies.switchToAiGreeting || 'NutriBot đã quay trở lại đồng hành cùng bạn!',
        timestamp: new Date(),
      };
      if (trimmed) {
        conv.messages.push({
          sender: 'customer',
          senderName: conv.customerName || 'Khách hàng',
          senderAvatar: conv.customerAvatar || '',
          content: trimmed,
          timestamp: new Date(),
        });
      }
      conv.messages.push(returnMsg);
      conv.lastMessage = returnMsg.content;
      conv.lastMessageAt = new Date();
      await conv.save();
      return res.json({
        success: true,
        reply: returnMsg.content,
        status: 'AI_PROCESSING',
        isHandedOver: false,
        liveChat: false,
        messages: conv.messages,
      });
    }

    // 2. Chuyển nhân viên CSKH
    const isExplicitTransfer = isExplicitHumanRequest(cleanLower, req.body.requestHuman);
    const internalIssue = isInternalIssueRequiringHuman(cleanLower);

    if ((isExplicitTransfer || internalIssue) && conv) {
      conv.status = 'WAITING_FOR_ADMIN';
      conv.messages.push({
        sender: 'customer',
        senderName: conv.customerName || customerName || 'Khách hàng',
        senderAvatar: conv.customerAvatar || customerAvatar || '',
        content: trimmed,
        timestamp: new Date(),
      });
      const aiReply = internalIssue
        ? `⚠️ **NutriBot thông báo chuyển tiếp:** ${internalIssue.reason}\n\nNutriBot đã kết nối cuộc trò chuyện đến **Chuyên viên tư vấn & Chăm sóc khách hàng Evergreen Mart**. Nhân viên sẽ tiếp nhận và kiểm tra trực tiếp cho bạn ngay tại đây nhé! 🌿`
        : (replies.transferExplicitReply || 'NutriBot đã chuyển yêu cầu của bạn đến chuyên viên tư vấn Evergreen Mart.');

      conv.messages.push({
        sender: 'ai',
        senderName: 'NutriBot',
        senderAvatar: 'https://api.iconify.design/lucide:bot.svg?color=%23176b3a',
        content: aiReply,
        timestamp: new Date(),
      });
      conv.lastMessage = trimmed;
      conv.lastMessageAt = new Date();
      conv.unreadAdminCount = (conv.unreadAdminCount || 0) + 1;
      await conv.save();
      return res.json({
        success: true,
        reply: aiReply,
        isHandedOver: true,
        liveChat: true,
        status: 'WAITING_FOR_ADMIN',
        messages: conv.messages,
      });
    }

    // 3. Chế độ chat trực tiếp với nhân viên
    if (conv && (conv.status === 'WAITING_FOR_ADMIN' || conv.status === 'ADMIN_PROCESSING')) {
      conv.messages.push({
        sender: 'customer',
        senderName: conv.customerName || customerName || 'Khách hàng',
        senderAvatar: conv.customerAvatar || customerAvatar || '',
        content: trimmed,
        timestamp: new Date(),
      });
      conv.lastMessage = trimmed;
      conv.lastMessageAt = new Date();
      conv.unreadAdminCount = (conv.unreadAdminCount || 0) + 1;
      await conv.save();

      return res.json({
        success: true,
        liveChat: true,
        isHandedOver: true,
        status: conv.status,
        reply: '',
        messages: conv.messages,
      });
    }

    const effectiveGeminiKey = process.env.GEMINI_API_KEY || (provider === 'gemini' ? apiKey : '') || apiKey;
    const effectiveOpenAIKey = (provider === 'openai' ? apiKey : '') || process.env.OPENAI_API_KEY || apiKey;

    // ── 1. Image Recognition & Multimodal Vision Analysis ────────────────
    if (image) {
      if (effectiveGeminiKey && provider !== 'openai') {
        try {
          const visionResult = await callGeminiVision(image, trimmed, effectiveGeminiKey, persona, profile, knowledge);
          if (visionResult && visionResult.text) {
            const prods = await findRelatedProducts(removeDiacritics(visionResult.text + ' ' + trimmed), knowledge);
            await logMessageToConv(conv, trimmed || '[Ảnh món ăn]', visionResult.text);
            return res.json({ success: true, reply: visionResult.text, products: prods });
          }
        } catch (err) {
          console.warn('Gemini Vision fallback to local engine:', err.message);
        }
      }

      if (effectiveOpenAIKey && provider === 'openai') {
        try {
          const visionResult = await callOpenAIVision(image, trimmed, effectiveOpenAIKey, persona, profile, knowledge);
          if (visionResult && visionResult.text) {
            const prods = await findRelatedProducts(removeDiacritics(visionResult.text + ' ' + trimmed), knowledge);
            await logMessageToConv(conv, trimmed || '[Ảnh món ăn]', visionResult.text);
            return res.json({ success: true, reply: visionResult.text, products: prods });
          }
        } catch (err) {
          console.warn('OpenAI Vision fallback to local engine:', err.message);
        }
      }

      const localAnalysis = await analyzeFoodImageLocal(knowledge, image, trimmed, profile);
      const prods = await findRelatedProducts(removeDiacritics(localAnalysis.keywords), knowledge);
      await logMessageToConv(conv, trimmed || '[Ảnh món ăn]', localAnalysis.reply);
      return res.json({
        success: true,
        reply: localAnalysis.reply,
        products: prods
      });
    }

    // ── 2. External Text LLM Provider (Google Gemini / OpenAI) ───────────
    if (effectiveGeminiKey && provider !== 'openai') {
      try {
        const reply = await callGeminiAI(trimmed, history, effectiveGeminiKey, persona, profile, knowledge);
        if (reply && reply.text) {
          const prods = await findRelatedProducts(cleanLower, knowledge);
          await logMessageToConv(conv, trimmed, reply.text);
          return res.json({ success: true, reply: reply.text, products: prods });
        }
      } catch (aiErr) {
        console.warn('Gemini AI fallback error:', aiErr.message);
      }
    } else if (effectiveOpenAIKey && provider === 'openai') {
      try {
        const reply = await callOpenAIAI(trimmed, history, effectiveOpenAIKey, persona, profile, knowledge);
        if (reply && reply.text) {
          const prods = await findRelatedProducts(cleanLower, knowledge);
          await logMessageToConv(conv, trimmed, reply.text);
          return res.json({ success: true, reply: reply.text, products: prods });
        }
      } catch (aiErr) {
        console.warn('OpenAI fallback error:', aiErr.message);
      }
    }

    // ── 3. NutriBot Smart Knowledge Engine (MongoDB-backed) ──────────────

    // 3.1. Tính toán BMI
    if (cleanLower.includes('bmi') || cleanLower.includes('chi so khoi') || cleanLower.includes('the trang') || cleanLower.includes('can nang ly tuong')) {
      return res.json(handleBmiCalculation(knowledge, trimmed, cleanLower, profile));
    }

    // 3.2. Macro & Phân chia Calo
    if (cleanLower.includes('macro') || cleanLower.includes('calorie deficit') || cleanLower.includes('tham hut calo') || cleanLower.includes('dam') || cleanLower.includes('protein') || cleanLower.includes('calo hang ngay')) {
      return res.json({ success: true, reply: replies.macroAdvice || '', products: [] });
    }

    // 3.3. Tra cứu đơn hàng
    const orderMatch = trimmed.match(/(?:XL-?[0-9]{6}|[a-zA-Z0-9]{6,24})/gi);
    const isOrderQuery = cleanLower.includes('don hang') || cleanLower.includes('kiem tra don') || cleanLower.includes('ma don') || cleanLower.includes('order');
    if (isOrderQuery && orderMatch) {
      const orderStatusMap = knowledge?.orderStatusMap || {};
      for (const code of orderMatch) {
        const rawCode = String(code).trim();
        const normalizedCode = rawCode.replace(/^XL-?/i, 'XL-');
        const noHyphenCode = rawCode.replace(/^XL-?/i, 'XL');
        const order = await Order.findOne({
          $or: [
            { orderCode: rawCode },
            { orderCode: normalizedCode },
            { orderCode: noHyphenCode },
            { orderCode: rawCode.toUpperCase() },
            ...(code.length === 24 ? [{ _id: code }] : [])
          ]
        }).populate('items.product');

        if (order) {
          const statusVi = orderStatusMap[order.status] || order.status;
          const itemsSummary = (order.items || [])
            .map(i => `- ${i.productName} (x${i.quantity}) - ${(i.priceNumber * i.quantity).toLocaleString('vi-VN')}₫`)
            .join('\n');

          const replyText = `📦 **Thông tin đơn hàng #${order.orderCode}**\n\n` +
            `- **Trạng thái:** ${statusVi}\n` +
            `- **Khách hàng:** ${order.guestName || 'Quý khách'}\n` +
            `- **Tổng thanh toán:** ${order.total.toLocaleString('vi-VN')}₫\n` +
            `- **Hình thức:** ${order.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 'Chuyển khoản / Đã thanh toán'}\n` +
            `- **Thời gian đặt:** ${new Date(order.createdAt).toLocaleString('vi-VN')}\n\n` +
            `**Danh sách món trong đơn:**\n${itemsSummary}\n\n` +
            `🚛 *Evergreen Mart cam kết bảo quản bằng xe lạnh chuyên dụng từ nông trại đến tận cửa nhà bạn.*`;

          return res.json({ success: true, reply: replyText, products: [] });
        }
      }
    }

    // 3.4. Voucher
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

        const replyText = `🎉 **Evergreen Mart hiện đang có các ưu đãi hấp dẫn dành riêng cho bạn:**\n\n${voucherList}\n\n` +
          `💡 *Bạn có thể nhập mã này tại bước Thanh toán (Checkout) hoặc xem thêm ở trang [Ưu đãi / Vouchers](/vouchers).*`;

        return res.json({ success: true, reply: replyText, products: [] });
      } else {
        return res.json({
          success: true,
          reply: replies.voucherFallback || '',
          products: []
        });
      }
    }

    // 3.5. Chính sách giao hàng & Xe lạnh
    if (cleanLower.includes('giao hang') || cleanLower.includes('phi ship') || cleanLower.includes('van chuyen') || cleanLower.includes('xe lanh') || cleanLower.includes('bao quan')) {
      return res.json({ success: true, reply: replies.shippingPolicy || '', products: [] });
    }

    // 3.6. Ăn vặt lành mạnh / thèm ăn đêm
    if (cleanLower.includes('an dem') || cleanLower.includes('them an') || cleanLower.includes('an vat') || cleanLower.includes('snack') || cleanLower.includes('doi bung')) {
      const healthySnacks = await Product.find({
        isActive: { $ne: false },
        category: { $in: ['fruits', 'dry-food', 'dairy'] }
      }).limit(3);

      return res.json({
        success: true,
        reply: replies.healthySnack || '',
        products: healthySnacks.map(formatProductForChat)
      });
    }

    // 3.7. Gợi ý thực đơn, Eat-Clean
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

      const replyText = String(replies.eatCleanMenuTemplate || '').replace('{{targetNote}}', targetNote);
      return res.json({
        success: true,
        reply: replyText,
        products: recommended.map(formatProductForChat)
      });
    }

    // 3.8. Tìm kiếm sản phẩm theo từ khóa
    const matchedProducts = await findRelatedProducts(cleanLower, knowledge);
    if (matchedProducts.length > 0) {
      const productNames = matchedProducts.map(p => `- **${p.name}** - ${p.price}`).join('\n');
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
    return res.json({
      success: true,
      reply: replies.defaultWelcome || '',
      products: featured.map(formatProductForChat)
    });

  } catch (err) {
    next(err);
  }
});

// ── NutriBot Vision: Local Image Analyzer (MongoDB-backed Meal Profiles) ──────
async function analyzeFoodImageLocal(knowledge, imageBase64, caption, profile) {
  const capLower = removeDiacritics(caption || '');
  const mealProfiles = knowledge?.mealProfiles || [];

  let matched = mealProfiles.find(m => (m.keywords || []).some(k => capLower.includes(k)));
  if (!matched) {
    matched = mealProfiles[0] || {
      mealName: 'Bữa ăn cân bằng Evergreen Mart',
      ingredients: 'Rau củ hữu cơ, đạm sạch tự nhiên.',
      calories: '300 - 400 kcal',
      protein: '25g', carbs: '30g', fat: '10g', fiber: '6g',
      advice: 'Ưu tiên thực phẩm tươi sạch bảo quản lạnh.',
      searchKeywords: ['xa lach', 'ca chua'],
    };
  }

  let personalNote = '';
  if (profile && (profile.age || profile.weight || profile.height)) {
    const heightM = profile.height ? profile.height / 100 : null;
    const bmi = (heightM && profile.weight) ? (profile.weight / (heightM * heightM)).toFixed(1) : null;
    personalNote = `\n\n🎯 **Lời khuyên cá nhân hóa cho bạn (BMI: ${bmi || '--'} - Mục tiêu: ${profile.conditions || profile.dietGoal || 'Sức khỏe dẻo dai'}):**\n` +
      `Bữa ăn này cung cấp khoảng **${matched.calories}**, phù hợp với mục tiêu của bạn. Hãy đảm bảo uống đủ 2 - 2.5 lít nước trong ngày để tối ưu chuyển hóa!`;
  }

  const reply = `📸 **NutriBot đã nhận diện thành công hình ảnh món ăn của bạn!** 🥗✨\n\n` +
    `🍽️ **Tên món:** **${matched.mealName}**\n` +
    `📋 **Thành phần nhận diện:** ${matched.ingredients}\n\n` +
    `🔥 **Ước tính Năng lượng:** **${matched.calories}**\n` +
    `📊 **Thành phần dinh dưỡng (Macro):**\n` +
    `- 🥩 **Chất đạm (Protein):** ${matched.protein}\n` +
    `- 🌾 **Tinh bột (Carb):** ${matched.carbs}\n` +
    `- 🥑 **Chất béo (Fat):** ${matched.fat}\n` +
    `- 🥦 **Chất xơ (Fiber):** ${matched.fiber}\n\n` +
    `🩺 **Đánh giá chuyên gia NutriBot:**\n${matched.advice}${personalNote}\n\n` +
    `🌿 *Evergreen Mart hiện đang có sẵn các nguyên liệu tươi sạch thu hoạch trong ngày để bạn tự tay chế biến món ngon này:*`;

  return {
    reply,
    keywords: (matched.searchKeywords || []).join(' ')
  };
}

// Dynamic discovery & health-aware caching of working Gemini models (rules loaded from MongoDB)
const MODEL_CACHE_TTL_MS = 1800000;
let cachedApiKeySuffix = '';
let cachedWorkingModel = null;
let lastWorkingModelAt = 0;
let cachedAvailableModels = [];
let lastModelsListCheck = 0;

function isUsableGeminiModel(name, excludedTokens = []) {
  if (!name || !name.includes('gemini')) return false;
  return !excludedTokens.some(token => name.includes(token));
}

function resetModelCacheIfKeyChanged(apiKey) {
  const suffix = String(apiKey || '').slice(-8);
  if (suffix !== cachedApiKeySuffix) {
    cachedApiKeySuffix = suffix;
    cachedWorkingModel = null;
    lastWorkingModelAt = 0;
    cachedAvailableModels = [];
    lastModelsListCheck = 0;
  }
}

async function getCandidateGeminiModels(apiKey, knowledge) {
  const preferredModels = knowledge?.preferredGeminiModels || [];
  const excludedTokens = knowledge?.excludedGeminiModelTokens || [];

  resetModelCacheIfKeyChanged(apiKey);
  if (!cachedAvailableModels.length || Date.now() - lastModelsListCheck >= MODEL_CACHE_TTL_MS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        cachedAvailableModels = (data.models || [])
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .filter(m => isUsableGeminiModel(m, excludedTokens));
        lastModelsListCheck = Date.now();
      } else {
        const errText = await res.text();
        console.warn('Gemini ListModels error:', res.status, errText.slice(0, 200));
      }
    } catch (e) {
      console.warn('Không thể tự động lấy danh sách model Gemini:', e.message);
    }
  }

  const discovered = cachedAvailableModels;
  const preferred = discovered.length
    ? preferredModels.filter(m => discovered.includes(m))
    : preferredModels;
  const extraFlash = discovered.filter(m => !preferred.includes(m) && m.includes('flash'));
  const cached =
    cachedWorkingModel && Date.now() - lastWorkingModelAt < MODEL_CACHE_TTL_MS
      ? [cachedWorkingModel]
      : [];

  return [...cached, ...preferred, ...extraFlash]
    .filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);
}

function parseBase64Image(imageBase64) {
  const match = String(imageBase64 || '').match(/^data:(image\/[a-zA-Z0-9.+_-]+)(?:;[^,]*)?;base64,(.+)$/i);
  return {
    mimeType: match ? match[1] : 'image/jpeg',
    cleanBase64: match ? match[2] : String(imageBase64 || ''),
  };
}

function extractGeminiCandidateText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  const nonThought = parts
    .filter(p => !p.thought && typeof p.text === 'string')
    .map(p => p.text)
    .join('\n')
    .trim();
  if (nonThought) return nonThought;
  const fallback = parts.find(p => typeof p.text === 'string')?.text;
  return fallback ? fallback.trim() : '';
}

async function callGeminiGenerateContent(apiKey, contents, generationConfig, knowledge) {
  if (!apiKey) {
    return { ok: false, errorCode: 'NO_API_KEY', errorMessage: 'Chưa cấu hình GEMINI_API_KEY.' };
  }

  const candidateModels = await getCandidateGeminiModels(apiKey, knowledge);
  let lastStatus = 0;
  let lastError = '';

  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const payload = generationConfig ? { contents, generationConfig } : { contents };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const json = await res.json();
        const text = extractGeminiCandidateText(json);
        if (text) {
          cachedWorkingModel = model;
          lastWorkingModelAt = Date.now();
          return { ok: true, text, model };
        }
      } else {
        lastStatus = res.status;
        lastError = (await res.text()).slice(0, 300);
        console.warn(`Gemini (${model}, HTTP ${res.status}):`, lastError);
        if (cachedWorkingModel === model) cachedWorkingModel = null;
        if (res.status === 400 && /API_KEY_INVALID/i.test(lastError)) {
          return {
            ok: false,
            errorCode: 'INVALID_API_KEY',
            errorMessage: 'GEMINI_API_KEY không hợp lệ.',
          };
        }
      }
    } catch (err) {
      lastError = err.message;
      console.warn(`Gemini (${model}) failed:`, err.message);
      if (cachedWorkingModel === model) cachedWorkingModel = null;
    }
  }

  return {
    ok: false,
    errorCode: lastStatus === 429 ? 'QUOTA_EXCEEDED' : 'GEMINI_UNAVAILABLE',
    errorMessage: lastError || 'Không thể kết nối tới Gemini API.',
  };
}

// ── Gemini Vision API Call ───────────────────────────────────────────────────
async function callGeminiVision(imageBase64, prompt, apiKey, persona, profile, knowledge) {
  if (!apiKey) return null;
  let catalogSnippet = '';
  try {
    const products = await Product.find({ isActive: { $ne: false } }).limit(20).select('name price categoryVi').maxTimeMS(2500);
    catalogSnippet = products.map(p => `- ${p.name} (${p.price}, ${p.categoryVi})`).join('\n');
  } catch (dbErr) {
    console.warn('Catalog snippet fetch skipped for Gemini Vision:', dbErr.message);
  }
  const systemInstruction = buildSystemPrompt(knowledge, catalogSnippet, persona, profile);
  const { mimeType, cleanBase64 } = parseBase64Image(imageBase64);

  const userQuery = prompt
    ? `Khách hàng vừa tải ảnh lên với lời nhắn: "${prompt}". Hãy phân tích món ăn theo chuẩn NutriBot.`
    : (knowledge?.systemPromptMeta?.visionUserPromptDefault || '');

  const result = await callGeminiGenerateContent(
    apiKey,
    [
      {
        role: 'user',
        parts: [
          { text: systemInstruction + '\n\n' + userQuery },
          { inline_data: { mime_type: mimeType, data: cleanBase64 } },
        ],
      },
    ],
    undefined,
    knowledge
  );

  return result.ok ? { text: result.text } : null;
}

// ── Gemini Vision Ingredient Detector for Cook Page ──────────────────────────
async function detectIngredientsWithGemini(imageBase64, apiKey, knowledge) {
  if (!apiKey) {
    return { ok: false, errorCode: 'NO_API_KEY', message: 'Chưa cấu hình GEMINI_API_KEY.' };
  }

  const { mimeType, cleanBase64 } = parseBase64Image(imageBase64);
  const promptText = knowledge?.systemPromptMeta?.detectIngredientsPrompt ||
    'Identify real food ingredients visible in this image. Return JSON array [{"name","category","qty","unit"}].';

  const result = await callGeminiGenerateContent(
    apiKey,
    [
      {
        role: 'user',
        parts: [
          { text: promptText },
          { inline_data: { mime_type: mimeType, data: cleanBase64 } },
        ],
      },
    ],
    { temperature: 0.1 },
    knowledge
  );

  if (!result.ok) {
    return { ok: false, errorCode: result.errorCode, message: result.errorMessage };
  }

  let rawText = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const arrayMatch = rawText.match(/\[[\s\S]*\]/);
  if (arrayMatch) rawText = arrayMatch[0];

  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      const items = parsed
        .map(item => {
          if (typeof item === 'string') return { name: item.trim(), category: 'other' };
          const qtyNum = Number(item?.qty);
          return {
            name: String(item?.name || '').trim(),
            category: item?.category || 'other',
            qty: Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : undefined,
            unit: typeof item?.unit === 'string' && item.unit.trim() ? item.unit.trim() : undefined,
          };
        })
        .filter(item => item.name);
      return { ok: true, items, model: result.model };
    }
  } catch (e) {
    console.warn('Gemini JSON parse failed, extracting via regex:', e.message);
    const matches = rawText.match(/"name"\s*:\s*"([^"]+)"/g);
    if (matches && matches.length > 0) {
      const items = matches
        .map(m => ({
          name: m.replace(/"name"\s*:\s*"/, '').replace(/"$/, '').trim(),
          category: 'other',
        }))
        .filter(item => item.name);
      return { ok: true, items, model: result.model };
    }
  }

  return { ok: false, errorCode: 'PARSE_FAILED', message: 'Gemini trả về dữ liệu không đúng định dạng.' };
}

// ── OpenAI Vision API Call ───────────────────────────────────────────────────
async function callOpenAIVision(imageBase64, prompt, apiKey, persona, profile, knowledge) {
  if (!apiKey) return null;
  const products = await Product.find({ isActive: { $ne: false } }).limit(20).select('name price categoryVi');
  const catalogSnippet = products.map(p => `- ${p.name} (${p.price}, ${p.categoryVi})`).join('\n');
  const systemInstruction = buildSystemPrompt(knowledge, catalogSnippet, persona, profile);

  const userQuery = prompt || (knowledge?.systemPromptMeta?.visionUserPromptDefault || '');

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

// ── Helper: BMI Calculation (MongoDB-backed bands & guide) ───────────────────
function handleBmiCalculation(knowledge, trimmed, cleanLower, profile) {
  const mCmMatch = trimmed.match(/cao\s*([12])\s*m\s*([0-9]{1,2})/i);
  const heightMatch = trimmed.match(/cao\s*([0-9.,]+)\s*(m|cm)?/i);
  const weightMatch = trimmed.match(/n[aặ]ng\s*([0-9.,]+)\s*(kg)?/i);

  let height = profile?.height;
  let weight = profile?.weight;

  if (mCmMatch) {
    const meters = parseInt(mCmMatch[1], 10);
    let sub = mCmMatch[2];
    if (sub.length === 1) sub = sub + '0';
    height = meters * 100 + parseInt(sub, 10);
  } else if (heightMatch) {
    let hVal = parseFloat(heightMatch[1].replace(',', '.'));
    if (hVal < 3) hVal = Math.round(hVal * 100);
    height = hVal;
  }

  if (weightMatch) {
    weight = parseFloat(weightMatch[1].replace(',', '.'));
  }

  const bmiConfig = knowledge?.bmiConfig || {};
  if (!height || !weight) {
    return {
      success: true,
      reply: bmiConfig.guideReply || '',
      products: []
    };
  }

  const heightM = height / 100;
  const bmi = (weight / (heightM * heightM)).toFixed(1);
  const bmiNum = parseFloat(bmi);

  const bands = bmiConfig.bands || [];
  const matchedBand = bands.find((b) => b.maxBmi === null || b.maxBmi === undefined || bmiNum < b.maxBmi);
  const status = matchedBand?.status || 'Bình thường';
  const advice = matchedBand?.advice || '';

  const minIdealWeight = (18.5 * heightM * heightM).toFixed(1);
  const maxIdealWeight = (22.9 * heightM * heightM).toFixed(1);

  const reply = `🩺 **Kết quả phân tích thể trạng từ Chuyên gia NutriBot:**\n\n` +
    `- **Chiều cao:** ${height} cm | **Cân nặng:** ${weight} kg\n` +
    `- **Chỉ số BMI:** **${bmi}** — Đánh giá: **${status}**\n` +
    `- **Cân nặng lý tưởng khuyến nghị:** **${minIdealWeight} kg – ${maxIdealWeight} kg**\n\n` +
    `💡 **Lời khuyên dinh dưỡng từ NutriBot:**\n${advice}\n\n` +
    `*Bạn có muốn NutriBot lên thực đơn 7 ngày phù hợp với chỉ số này không?*`;

  return { success: true, reply, products: [] };
}

// ── Text AI Providers (Gemini / OpenAI) ──────────────────────────────────────
async function callGeminiAI(prompt, history, apiKey, persona, profile, knowledge) {
  if (!apiKey) return null;
  let catalogSnippet = '';
  try {
    const products = await Product.find({ isActive: { $ne: false } }).limit(25).select('name price categoryVi slug').maxTimeMS(2500);
    catalogSnippet = products.map(p => `- ${p.name} (${p.price}, nhóm: ${p.categoryVi})`).join('\n');
  } catch (dbErr) {
    console.warn('Catalog snippet fetch skipped for Gemini AI:', dbErr.message);
  }
  const systemInstruction = buildSystemPrompt(knowledge, catalogSnippet, persona, profile);

  const result = await callGeminiGenerateContent(
    apiKey,
    [{ role: 'user', parts: [{ text: systemInstruction + '\n\nKhách hàng hỏi: ' + prompt }] }],
    undefined,
    knowledge
  );

  return result.ok ? { text: result.text } : null;
}

async function callOpenAIAI(prompt, history, apiKey, persona, profile, knowledge) {
  if (!apiKey) return null;
  const products = await Product.find({ isActive: { $ne: false } }).limit(25).select('name price categoryVi slug');
  const catalogSnippet = products.map(p => `- ${p.name} (${p.price}, nhóm: ${p.categoryVi})`).join('\n');
  const systemInstruction = buildSystemPrompt(knowledge, catalogSnippet, persona, profile);

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
async function findRelatedProducts(cleanLower, knowledge) {
  try {
    const productKeywords = extractProductKeywords(cleanLower, knowledge?.productKeywords || []);
    let matched = [];

    if (productKeywords.length > 0) {
      const searchRegex = new RegExp(productKeywords.join('|'), 'i');
      matched = await Product.find({
        isActive: { $ne: false },
        $or: [
          { name: { $regex: searchRegex } },
          { categoryVi: { $regex: searchRegex } }
        ]
      }).limit(4).maxTimeMS(2500);
    }

    if (!matched || matched.length === 0) {
      const fallbackRule = (knowledge?.categoryFallbackRules || []).find((rule) =>
        (rule.keywords || []).some((kw) => cleanLower.includes(kw))
      );
      if (fallbackRule?.category) {
        matched = await Product.find({ isActive: { $ne: false }, category: fallbackRule.category })
          .limit(4)
          .maxTimeMS(2500);
      }
    }

    return (matched || []).map(formatProductForChat);
  } catch (err) {
    console.warn('findRelatedProducts error:', err.message);
    return [];
  }
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

function extractProductKeywords(text, keywordsList = []) {
  return (keywordsList || []).filter(w => text.includes(w));
}

function matchesCategoryHint(product, detectedCat, categoryHints = {}) {
  if (!detectedCat || detectedCat === 'other') return null;
  const hints = categoryHints?.[String(detectedCat).toLowerCase()];
  if (!hints) return null;
  const pCat = removeDiacritics(`${product.category || ''} ${product.categoryVi || ''}`);
  return hints.some(h => pCat.includes(h));
}

function findBestMatchingProduct(rawName, category, allProducts, categoryHints = {}) {
  const normRaw = removeDiacritics(rawName).trim();
  if (!normRaw) return null;

  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordRe = new RegExp(`(?:^|\\s)${escapeRe(normRaw)}(?:$|\\s)`);
  const startRe = new RegExp(`^${escapeRe(normRaw)}(?:$|\\s)`);

  let bestProduct = null;
  let bestScore = 0;

  for (const p of allProducts) {
    const normP = removeDiacritics(p.name).trim();
    let score = 0;

    if (normP === normRaw) {
      score += 120;
    } else if (startRe.test(normP)) {
      score += 80;
    } else if (wordRe.test(normP)) {
      score += 45;
    } else if (normRaw.length >= 4 && (normP.includes(normRaw) || normRaw.includes(normP))) {
      score += 25;
    } else {
      continue;
    }

    const catMatch = matchesCategoryHint(p, category, categoryHints);
    if (catMatch === true) score += 30;
    else if (catMatch === false) score -= 60;

    if (score > bestScore) {
      bestScore = score;
      bestProduct = p;
    }
  }

  return bestScore >= 30 ? bestProduct : null;
}

// ── POST /api/chatbot/detect-ingredients ─────────────────────────────────────
router.post('/detect-ingredients', async (req, res, next) => {
  try {
    const { image, apiKey } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Vui lòng tải lên hình ảnh nguyên liệu.' });
    }

    const knowledge = await getChatbotKnowledge();
    const effectiveGeminiKey = apiKey || process.env.GEMINI_API_KEY;
    const detection = await detectIngredientsWithGemini(image, effectiveGeminiKey, knowledge);

    if (!detection.ok) {
      const errorMessages = knowledge?.cannedReplies?.detectIngredientErrors || {};
      const message =
        errorMessages[detection.errorCode] ||
        errorMessages.DEFAULT ||
        'Gemini hiện tại đang gặp vấn đề, không nhận diện được ảnh. Bạn đợi ít phút rồi thử lại hoặc thêm nguyên liệu thủ công bên trên nhé.';

      return res.status(503).json({
        success: false,
        code: detection.errorCode,
        message,
      });
    }

    const allProducts = await Product.find({ isActive: { $ne: false } }).select('name slug price priceNumber image category categoryVi stock');

    const results = [];
    const seenNames = new Set();
    const categoryHints = knowledge?.ingredientCategoryHints || {};

    for (const item of detection.items) {
      const rawName = (item.name || '').trim();
      if (!rawName) continue;
      const normRaw = removeDiacritics(rawName);

      if (seenNames.has(normRaw)) continue;
      seenNames.add(normRaw);

      const matchedProd = findBestMatchingProduct(rawName, item.category, allProducts, categoryHints);

      results.push({
        name: matchedProd ? matchedProd.name : rawName,
        rawName,
        category: item.category || 'other',
        qty: item.qty,
        unit: item.unit,
        productId: matchedProd ? matchedProd._id.toString() : null,
        product: matchedProd ? formatProductForChat(matchedProd) : null
      });
    }

    return res.json({
      success: true,
      model: detection.model,
      ingredients: results,
      total: results.length
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/chatbot/session/:sessionId — đồng bộ tin nhắn 2 chiều giữa khách hàng và admin
router.get('/session/:sessionId', optionalAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    let conv = null;

    if (req.user) {
      conv = await Conversation.findOne({ customer: req.user._id })
        .populate('assignedTo', 'name email avatar')
        .populate('customer', 'name email phone avatar');
      if (!conv && req.user.email) {
        conv = await Conversation.findOne({ customerEmail: req.user.email.toLowerCase().trim() })
          .populate('assignedTo', 'name email avatar')
          .populate('customer', 'name email phone avatar');
      }
    }
    if (!conv) {
      conv = await Conversation.findOne({ sessionId })
        .populate('assignedTo', 'name email avatar')
        .populate('customer', 'name email phone avatar');
    }

    if (!conv) {
      return res.json({
        success: true,
        status: 'AI_PROCESSING',
        messages: [],
        assignedTo: null,
      });
    }

    if (conv.unreadCustomerCount > 0) {
      conv.unreadCustomerCount = 0;
      await conv.save();
    }

    res.json({
      success: true,
      status: conv.status,
      assignedTo: conv.assignedTo,
      customer: conv.customer,
      customerName: conv.customerName,
      customerAvatar: conv.customerAvatar,
      messages: conv.messages,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/chatbot/switch-to-ai — khách bấm nút "Trở về hỏi Trợ lý AI"
router.post('/switch-to-ai', optionalAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const knowledge = await getChatbotKnowledge();
    let conv = null;

    if (req.user) {
      conv = await Conversation.findOne({ customer: req.user._id });
      if (!conv && req.user.email) {
        conv = await Conversation.findOne({ customerEmail: req.user.email.toLowerCase().trim() });
      }
    }
    if (!conv && sessionId) {
      conv = await Conversation.findOne({ sessionId });
    }

    if (!conv) {
      return res.json({ success: true, status: 'AI_PROCESSING', messages: [] });
    }

    conv.status = 'AI_PROCESSING';
    const returnMsg = {
      sender: 'ai',
      senderName: 'NutriBot',
      senderAvatar: 'https://api.iconify.design/lucide:bot.svg?color=%23176b3a',
      content:
        knowledge?.cannedReplies?.switchToAiGreeting ||
        'NutriBot đã quay trở lại đồng hành cùng bạn!',
      timestamp: new Date(),
    };
    conv.messages.push(returnMsg);
    conv.lastMessage = returnMsg.content;
    conv.lastMessageAt = new Date();
    await conv.save();

    res.json({
      success: true,
      status: 'AI_PROCESSING',
      reply: returnMsg.content,
      messages: conv.messages,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
