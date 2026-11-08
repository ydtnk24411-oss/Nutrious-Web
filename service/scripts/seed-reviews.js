/**
 * Seed 5 - 10 đánh giá khách hàng tự nhiên, bám sát đặc điểm từng sản phẩm.
 *
 * - Giữ nguyên các đánh giá thật của người dùng hiện có.
 * - Mỗi sản phẩm (bao gồm cả sản phẩm thường và combo) có từ 6 - 10 đánh giá
 *   được cá nhân hóa theo: tên sản phẩm, mô tả cảm quan, hướng dẫn chế biến/sử dụng,
 *   nguồn gốc, thương hiệu, quy cách đóng gói và thông số dinh dưỡng.
 *
 * Chạy: cd service && node scripts/seed-reviews.js
 */
const fs = require('fs');
const path = require('path');

const serviceEnvPath = path.join(__dirname, '..', '.env');
const legacyEnvPath = path.join(__dirname, '..', '..', 'server', '.env');
const envPath = fs.existsSync(serviceEnvPath) ? serviceEnvPath : legacyEnvPath;
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const mongoose = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');

// 60 hồ sơ khách hàng Việt Nam tự nhiên với ObjectId cố định (prefix 6b0000...)
const CUSTOMER_PERSONAS = [
  { id: '6b0000000000000000000001', name: 'Nguyễn Minh Thư', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&q=80' },
  { id: '6b0000000000000000000002', name: 'Trần Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80' },
  { id: '6b0000000000000000000003', name: 'Lê Thị Bích Ngọc', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80' },
  { id: '6b0000000000000000000004', name: 'Phạm Quốc Khánh', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&q=80' },
  { id: '6b0000000000000000000005', name: 'Võ Thanh Thảo', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&q=80' },
  { id: '6b0000000000000000000006', name: 'Đặng Tuấn Kiệt', avatar: '' },
  { id: '6b0000000000000000000007', name: 'Bùi Phương Linh', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&q=80' },
  { id: '6b0000000000000000000008', name: 'Hoàng Gia Bảo', avatar: '' },
  { id: '6b0000000000000000000009', name: 'Đỗ Ngọc Ánh', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&q=80' },
  { id: '6b0000000000000000000010', name: 'Ngô Trọng Nghĩa', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120&q=80' },
  { id: '6b0000000000000000000011', name: 'Lý Thanh Tâm', avatar: '' },
  { id: '6b0000000000000000000012', name: 'Trương Mỹ Duyên', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&q=80' },
  { id: '6b0000000000000000000013', name: 'Phan Nhật Minh', avatar: '' },
  { id: '6b0000000000000000000014', name: 'Vũ Thu Hà', avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=120&q=80' },
  { id: '6b0000000000000000000015', name: 'Đinh Quang Huy', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&q=80' },
  { id: '6b0000000000000000000016', name: 'Mai Lan Hương', avatar: '' },
  { id: '6b0000000000000000000017', name: 'Hồ Gia Hân', avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=120&q=80' },
  { id: '6b0000000000000000000018', name: 'Dương Minh Quân', avatar: '' },
  { id: '6b0000000000000000000019', name: 'Lương Bảo Ngọc', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&q=80' },
  { id: '6b0000000000000000000020', name: 'Cao Xuân Trường', avatar: '' },
  { id: '6b0000000000000000000021', name: 'Tạ Khánh Vân', avatar: '' },
  { id: '6b0000000000000000000022', name: 'Lâm Hải Đăng', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&q=80' },
  { id: '6b0000000000000000000023', name: 'Phùng Tuyết Mai', avatar: '' },
  { id: '6b0000000000000000000024', name: 'Trịnh Quốc Bảo', avatar: '' },
  { id: '6b0000000000000000000025', name: 'Hà Kiều Trang', avatar: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=120&q=80' },
  { id: '6b0000000000000000000026', name: 'Châu Minh Khôi', avatar: '' },
  { id: '6b0000000000000000000027', name: 'Đoàn Thanh Trúc', avatar: '' },
  { id: '6b0000000000000000000028', name: 'Quách Tuấn Anh', avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=120&q=80' },
  { id: '6b0000000000000000000029', name: 'Nghiêm Thảo Vy', avatar: '' },
  { id: '6b0000000000000000000030', name: 'Tô Vĩnh Phúc', avatar: '' },
  { id: '6b0000000000000000000031', name: 'Huỳnh Yến Nhi', avatar: 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=120&q=80' },
  { id: '6b0000000000000000000032', name: 'Kiều Đức Duy', avatar: '' },
  { id: '6b0000000000000000000033', name: 'Vương Hồng Nhung', avatar: '' },
  { id: '6b0000000000000000000034', name: 'Từ Gia Hưng', avatar: '' },
  { id: '6b0000000000000000000035', name: 'Chu Minh Nguyệt', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&q=80' },
  { id: '6b0000000000000000000036', name: 'Đàm Anh Tuấn', avatar: '' },
  { id: '6b0000000000000000000037', name: 'Thái Kim Ngân', avatar: '' },
  { id: '6b0000000000000000000038', name: 'La Hoàng Việt', avatar: '' },
  { id: '6b0000000000000000000039', name: 'Mạc Diệu Linh', avatar: '' },
  { id: '6b0000000000000000000040', name: 'Bạch Thiên Ân', avatar: '' },
];

const HELPFUL_VOTER_IDS = [
  new mongoose.Types.ObjectId('6b0000000000000000000051'),
  new mongoose.Types.ObjectId('6b0000000000000000000052'),
  new mongoose.Types.ObjectId('6b0000000000000000000053'),
  new mongoose.Types.ObjectId('6b0000000000000000000054'),
  new mongoose.Types.ObjectId('6b0000000000000000000055'),
  new mongoose.Types.ObjectId('6b0000000000000000000056'),
  new mongoose.Types.ObjectId('6b0000000000000000000057'),
  new mongoose.Types.ObjectId('6b0000000000000000000058'),
];

function hashString(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function lowerFirst(str) {
  const s = String(str || '').trim();
  if (!s) return '';
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function cleanTrailingDot(str) {
  return String(str || '').trim().replace(/\.+$/, '');
}

function detectCategoryType(p) {
  if (p.isCombo) return 'combo';
  const c = `${p.category || ''} ${p.categoryVi || ''} ${p.slug || ''}`.toLowerCase();
  if (c.includes('seafood') || c.includes('hải sản') || c.includes('ca-') || c.includes('tom-') || c.includes('muc-') || c.includes('hau-') || c.includes('cua-')) return 'seafood';
  if (c.includes('meat') || c.includes('thịt') || c.includes('gia cầm') || c.includes('bo-') || c.includes('heo-') || c.includes('ga-')) return 'meat';
  if (c.includes('fruit') || c.includes('trái cây')) return 'fruits';
  if (c.includes('vegetable') || c.includes('rau') || c.includes('nấm')) return 'vegetables';
  if (c.includes('dairy') || c.includes('sữa') || c.includes('phô mai') || c.includes('bơ')) return 'dairy';
  if (c.includes('beverage') || c.includes('thức uống') || c.includes('nước') || c.includes('trà') || c.includes('bia') || c.includes('cà phê')) return 'beverages';
  if (c.includes('bakery') || c.includes('bánh') || c.includes('ăn vặt') || c.includes('snack') || c.includes('kẹo') || c.includes('hạt')) return 'bakery';
  return 'pantry';
}

function extractUsageDishes(p) {
  const raw = cleanTrailingDot(p.usageInstructions || '');
  if (!raw) return [];
  // Tách các câu, ưu tiên câu có các động từ chế biến / thưởng thức
  const sentences = raw.split(/\.\s*/).map(s => s.trim()).filter(Boolean);
  const targetSentence = sentences.length > 1 ? sentences[sentences.length - 1] : sentences[0] || '';
  const cleaned = targetSentence
    .replace(/^(Thích hợp|Chuyên dùng|Dùng để|Dùng|Có thể|Ngon hơn khi|Ngon nhất khi|Thưởng thức)\s+/i, '')
    .trim();
  const parts = cleaned
    .split(/,|;|\s+hoặc\s+|\s+hay\s+/i)
    .map(x => lowerFirst(cleanTrailingDot(x)))
    .filter(x => x.length >= 6 && x.length <= 75);
  return parts;
}

function extractDescriptionClauses(p) {
  const raw = cleanTrailingDot(p.description || '');
  if (!raw) return [];
  // Bỏ phần tên sản phẩm lặp ở đầu nếu có
  const parts = raw
    .split(/,|;/)
    .map(s => s.trim())
    .filter(s => s.length >= 10 && s.length <= 95);
  return parts;
}

function buildProductReviews(p, productMap) {
  const h = hashString(p.slug || p._id);
  const count = 6 + (h % 5); // 6, 7, 8, 9 hoặc 10 đánh giá mỗi sản phẩm
  const catType = detectCategoryType(p);

  const name = p.name || 'Sản phẩm';
  const shortName = lowerFirst(name);
  const unit = p.unit || p.weight || p.packSize || 'phần tiêu chuẩn';
  const brand = p.brand && !p.brand.includes('Evergreen') ? p.brand : 'Evergreen Mart';
  const origin = p.origin || 'nguồn nông trại chuẩn sạch';
  const specs = p.specifications && typeof p.specifications === 'object' ? p.specifications : {};
  const kcal = specs['Năng lượng'] || '';
  const protein = specs['Chất đạm (Protein)'] || specs['Protein'] || '';
  const fiber = specs['Chất xơ'] || '';
  const vitamins = specs['Vitamin & Khoáng chất'] || specs['Dinh dưỡng'] || '';
  const storage = cleanTrailingDot(p.storageInstructions || 'Bảo quản đúng hướng dẫn giúp giữ nguyên độ tươi ngon');

  const dishes = extractUsageDishes(p);
  const dish1 = dishes[0] || (
    catType === 'seafood' ? 'hấp sả gừng và áp chảo bơ tỏi' :
    catType === 'meat' ? 'ướp nướng và xào lửa lớn' :
    catType === 'vegetables' ? 'xào tỏi và nấu canh thanh mát' :
    catType === 'fruits' ? 'ướp lạnh ăn tráng miệng trực tiếp' :
    catType === 'dairy' ? 'dùng bữa sáng kèm ngũ cốc và trái cây' :
    catType === 'beverages' ? 'ướp lạnh uống giải khát' :
    catType === 'bakery' ? 'nhâm nhi buổi chiều cùng trà ấm' :
    'nêm nếm và chế biến bữa cơm gia đình'
  );
  const dish2 = dishes[1] || dishes[0] || dish1;
  const dish3 = dishes[2] || dishes[0] || dish1;

  const clauses = extractDescriptionClauses(p);
  const sensory1 = clauses[1] ? lowerFirst(clauses[1]) : (clauses[0] ? lowerFirst(clauses[0]) : 'hương vị rất tươi ngon và tự nhiên');
  const sensory2 = clauses[2] ? lowerFirst(clauses[2]) : sensory1;

  // Nếu là Combo, lấy danh sách tên các món trong combo
  let comboNames = [];
  if (p.isCombo && Array.isArray(p.comboItems)) {
    comboNames = p.comboItems
      .map(it => {
        const sub = productMap.get(String(it.product)) || (it.product && it.product.name ? it.product : null);
        return sub ? sub.name : '';
      })
      .filter(Boolean);
  }
  const comboListStr = comboNames.length ? comboNames.join(', ') : name;
  const savingAmount = p.isCombo && p.originalPriceNumber > p.priceNumber
    ? `${((p.originalPriceNumber - p.priceNumber) / 1000).toFixed(0)}k`
    : 'kha khá';

  // Tạo tập 10 mẫu đánh giá bám sát từng khía cạnh riêng của sản phẩm
  let templates = [];

  if (catType === 'combo') {
    templates = [
      {
        rating: 5,
        title: 'Combo phối sẵn cực kỳ hợp lý và tiết kiệm',
        content: `Mình đặt ${name} gồm ${comboListStr} cho tiện đi chợ trong tuần. Tính ra rẻ hơn mua lẻ từng món được khoảng ${savingAmount} mà món nào giao tới cũng tươi mới, đóng gói cẩn thận từng phần riêng biệt.`,
        adminReply: `Cảm ơn bạn đã tin chọn ${name} tại Evergreen Mart! Chúc gia đình mình có những bữa ăn thật ngon miệng và đủ chất nhé ạ.`
      },
      {
        rating: 5,
        title: 'Nguyên liệu đồng đều, chất lượng không khác gì mua lẻ',
        content: `Lúc đầu sợ mua theo combo thì hàng không được tuyển kỹ bằng mua lẻ, nhưng nhận hàng xong rất ưng ý. Các món ${comboListStr} đều mới tinh, hạn sử dụng xa và bảo quản mát đúng chuẩn.`,
      },
      {
        rating: 5,
        title: 'Giải pháp tuyệt vời cho người bận rộn',
        content: `Đi làm về muộn nên mình hay chọn thẳng ${name} trên web. Một lần bấm chọn là có đủ ${comboListStr} để chế biến luôn cho cả nhà 3-4 người ăn, đỡ phải suy nghĩ hôm nay mua gì.`,
      },
      {
        rating: 4,
        title: 'Đóng gói chỉn chu, giá ưu đãi tốt',
        content: `Combo gồm ${comboListStr} phối rất khéo, không bị món nào thừa thãi. Hôm mình đặt trời mưa nên shipper giao trễ hơn khung giờ hẹn khoảng 15 phút, nhưng thùng giữ nhiệt vẫn mát lạnh, thực phẩm nguyên vẹn.`,
        adminReply: `Evergreen Mart cảm ơn góp ý của bạn ạ! Chúng mình sẽ lưu ý điều phối đơn giờ cao điểm tốt hơn để giao đúng hẹn cho bạn trong các lần tới nhé.`
      },
      {
        rating: 5,
        title: 'Mua lần thứ 3 trong tháng rồi',
        content: `Từ ngày Evergreen Mart có mục combo tiết kiệm là tuần nào mình cũng đặt ${name}. Chất lượng từng sản phẩm bên trong đều giữ vững phong độ, tươi sạch và rõ nguồn gốc.`,
      },
      {
        rating: 5,
        title: 'Đủ chất dinh dưỡng cho mâm cơm gia đình',
        content: `Rất thích cách shop ghép ${comboListStr} chung một gói ưu đãi như thế này. Vừa tiết kiệm chi phí đi chợ hàng tuần vừa cân đối dinh dưỡng cho bữa ăn của cả nhà.`,
      },
      {
        rating: 5,
        title: 'Hàng chuẩn, giao nhanh trong 2 giờ',
        content: `Đặt buổi sáng thì trưa đã nhận được nguyên bộ ${name}. Nhân viên soạn hàng rất có tâm, lót đệm kỹ càng nên không có món nào bị móp méo hay dập nát cả.`,
      },
      {
        rating: 4,
        title: 'Rất đáng tiền so với mua lẻ từng món',
        content: `Mức giá ${p.price} cho trọn bộ ${comboListStr} là quá hời. Giá như shop có thêm tùy chọn nhân đôi số lượng một món nhỏ trong combo nữa thì càng tuyệt, nhưng nhìn chung 9.5/10 điểm!`,
      },
      {
        rating: 5,
        title: 'Cả nhà đều khen ngon',
        content: `Nhận được ${name} là mình mang vào bếp chế biến ngay cho bữa tối. Nguyên liệu tươi chuẩn nên nấu lên món nào cũng giữ được vị ngọt tự nhiên, ông bà và các bé ở nhà ăn rất hợp.`,
      },
      {
        rating: 5,
        title: 'Uy tín, sẽ tiếp tục ủng hộ dài lâu',
        content: `Mình đã giới thiệu ${name} cho mấy chị đồng nghiệp cùng văn phòng đặt chung. Ai nhận hàng cũng khen thực phẩm sạch sẽ, đóng gói lịch sự và tiết kiệm được bao nhiêu thời gian đi siêu thị.`,
      }
    ];
  } else if (catType === 'seafood') {
    templates = [
      {
        rating: 5,
        title: 'Hải sản tươi rói, chế biến lên ngọt lịm',
        content: `Mình đặt ${name} (${unit}) về để ${dish1}. Phải công nhận hàng của ${brand} cực kỳ chất lượng, ${sensory1}, khi ăn cảm nhận rõ vị ngọt tự nhiên của hải sản tươi chứ không hề bị bở hay tanh.`,
        adminReply: `Evergreen Mart cảm ơn bạn rất nhiều! Nguồn ${name} luôn được kiểm soát nhiệt độ lạnh nghiêm ngặt để giữ trọn độ tươi ngọt khi đến tay khách hàng ạ.`
      },
      {
        rating: 5,
        title: 'Giữ lạnh xuất sắc, đúng chuẩn nguồn gốc ' + origin,
        content: `Điểm cộng lớn nhất là khâu vận chuyển: ${shortName} được đóng khay gọn gàng kèm đá gel giữ nhiệt nên khi nhận tay vẫn mát lạnh. Thịt săn chắc, ${sensory2}, cả nhà mình ai cũng tấm tắc khen.`,
      },
      {
        rating: 5,
        title: 'Giàu đạm và Omega-3 tốt cho sức khỏe',
        content: `Mình đang theo chế độ ăn lành mạnh nên rất hay mua ${name}. Xem bảng thông số có ${protein || 'hàm lượng đạm cao'} cùng ${vitamins || 'Omega-3 tự nhiên'} nên cực kỳ yên tâm. Hôm qua mình thử ${dish2} ăn ngon xuất sắc!`,
      },
      {
        rating: 4,
        title: 'Tươi ngon xứng đáng giá tiền',
        content: `So với mua ngoài chợ hay siêu thị thường thì ${shortName} ở đây tươi và sạch hơn hẳn, định lượng ${unit} rất vừa vặn cho một bữa ăn gia đình 3-4 người. Giá nhỉnh hơn chút xíu nhưng đổi lại an tâm tuyệt đối.`,
        adminReply: `Cảm ơn bạn đã tin tưởng chất lượng hải sản tại Evergreen Mart ạ! Mong tiếp tục được phục vụ những bữa ăn ngon của gia đình mình.`
      },
      {
        rating: 5,
        title: 'Sơ chế sạch sẽ, tiết kiệm thời gian nấu nướng',
        content: `Mua ${name} về gần như chỉ cần rửa sơ rồi đem ${dish3} là xong bữa tối thịnh soạn. Hàng chuẩn ${origin}, mùi thơm đặc trưng, bé nhỏ nhà mình bình thường kén ăn cá tôm mà hôm nay ăn hết veo một phần lớn.`,
      },
      {
        rating: 5,
        title: 'Chất lượng nhà hàng ngay tại bếp nhà',
        content: `Cuối tuần đổi gió cho gia đình nên mình đặt ${name}. Mở hộp ra thấy ${sensory1} là biết ngay hàng tuyển chọn loại 1. Chế biến kiểu ${dish1} giữ được nguyên độ mọng nước và vị ngọt thanh.`,
      },
      {
        rating: 5,
        title: 'Bảo quản tiện lợi, thông tin minh bạch',
        content: `Trên bao bì ghi rõ hướng dẫn (${storage.toLowerCase()}) và bảng thành phần dinh dưỡng ${kcal ? `(${kcal})` : ''}. Mình để ngăn đông/mát đúng chuẩn tới hôm sau lấy ra nấu vẫn tươi nguyên như mới.`,
      },
      {
        rating: 4,
        title: 'Hàng rất tươi, đóng gói kỹ',
        content: `Nhận ${name} lúc chiều tối, shipper giao hơi trễ tầm 10 phút do kẹt xe nhưng túi giữ nhiệt vẫn còn nguyên đá lạnh. Chất lượng bên trong thì 10 điểm, ${sensory2}, chắc chắn sẽ mua lại.`,
      },
      {
        rating: 5,
        title: 'Khách ruột của món này tại Evergreen Mart',
        content: `Tháng nào nhà mình cũng đặt ${name} ít nhất 2-3 lần. Chưa bao giờ thất vọng vì độ tươi luôn đồng đều, dùng để ${dish2} hay ${dish1} đều chuẩn vị và rất giàu dưỡng chất.`,
      },
      {
        rating: 5,
        title: 'Rất hài lòng từ chất lượng đến dịch vụ',
        content: `Ấn tượng với cách Evergreen Mart tuyển chọn nguồn hải sản từ ${origin}. Phần ${unit} đầy đặn, thớ thịt tươi sáng, nấu lên thơm lừng cả gian bếp.`,
      }
    ];
  } else if (catType === 'meat') {
    templates = [
      {
        rating: 5,
        title: 'Thịt tươi mềm, vân mỡ đẹp và rất thơm',
        content: `Mình mua ${name} (${unit}) về để ${dish1}. Thớ thịt nhìn ngoài còn đẹp hơn trên hình, ${sensory1}. Khi nấu chín thịt mềm ngọt tự nhiên, không bị ra nước nhiều hay có mùi hôi như thịt ngoài chợ.`,
        adminReply: `Cảm ơn bạn đã đánh giá 5 sao cho ${name}! Evergreen Mart luôn bảo quản thịt theo chuẩn chuỗi lạnh xuyên suốt để giữ nguyên độ tươi mềm ạ.`
      },
      {
        rating: 5,
        title: 'Nguồn đạm chất lượng cho chế độ tập luyện & gia đình',
        content: `Đang cần bổ sung thực phẩm giàu đạm (${protein || 'đạm tự nhiên cao'}, ${kcal || 'năng lượng cân đối'}) nên mình chọn ${name}. Phần định lượng ${unit} chia khẩu phần meal-prep trong tuần cực kỳ tiện lợi.`,
      },
      {
        rating: 5,
        title: 'Đóng khay sạch sẽ, chuẩn thương hiệu ' + brand,
        content: `Hàng chính hãng ${brand} (${origin}) nên nhìn khay thịt rất chỉn chu, màng bọc kín khí và bảo quản lạnh tốt. Tối qua mình làm món ${dish2}, cả nhà khen thịt mềm mọng và thấm vị lắm.`,
      },
      {
        rating: 4,
        title: 'Chất lượng thịt tuyệt vời, giao hàng nhanh',
        content: `Thịt tươi hồng hào, ${sensory2}. Mình đặt buổi sáng để kịp nấu cơm trưa, shipper giao đúng giờ. Chỉ góp ý nhỏ là nếu có thêm phân loại khay lớn 1kg cho gia đình đông người thì càng tiện hơn nữa!`,
        adminReply: `Dạ Evergreen Mart xin ghi nhận góp ý của bạn về quy cách đóng gói lớn hơn ạ. Cảm ơn bạn đã ủng hộ shop nhé!`
      },
      {
        rating: 5,
        title: 'Nấu món gì cũng ngon và tròn vị',
        content: `Tuần trước mua thử 1 phần ${unit} về ${dish1} thấy ưng quá nên tuần này đặt tiếp 2 phần để dành ${dish3}. Thịt giàu ${vitamins || 'sắt và vitamin nhóm B'}, các bé ở nhà ăn rất ngon miệng.`,
      },
      {
        rating: 5,
        title: 'Yên tâm tuyệt đối về vệ sinh an toàn thực phẩm',
        content: `Từ ngày biết đến Evergreen Mart mình chuyển hẳn sang mua ${name} ở đây. Thịt sạch, rõ ràng nguồn gốc từ ${origin}, bảo quản đúng chuẩn (${storage.toLowerCase()}) nên giữ trọn độ tươi ngọt.`,
      },
      {
        rating: 5,
        title: 'Độ dày và tỷ lệ nạc mỡ vừa vặn',
        content: `Rất thích cách sơ chế và đóng gói của sản phẩm này: ${sensory1}. Khi chế biến không cần tẩm ướp quá cầu kỳ vẫn dậy mùi thơm đặc trưng của thịt sạch.`,
      },
      {
        rating: 4,
        title: 'Đáng đồng tiền bát gạo',
        content: `Giá có thể nhỉnh hơn ngoài sạp chợ truyền thống một chút nhưng chất lượng ${name} thì vượt trội hoàn toàn, không bị hao hụt khi nấu và cực kỳ an tâm cho sức khỏe cả nhà.`,
      },
      {
        rating: 5,
        title: 'Bữa tối cuối tuần ấm cúng nhờ nguyên liệu ngon',
        content: `Cuối tuần làm tiệc nhỏ tại gia, mình chọn ${name} để ${dish2}. Ai ăn cũng hỏi mua ở đâu mà thịt mềm ngọt và thơm đến vậy. Chấm 10/10 điểm!`,
      },
      {
        rating: 5,
        title: 'Sẽ mua định kỳ hàng tuần',
        content: `Đã lưu ${name} vào danh sách yêu thích. Giao hàng nhanh, đóng gói sạch sẽ, thông số dinh dưỡng trên web rõ ràng giúp mình dễ dàng tính toán khẩu phần ăn cho gia đình.`,
      }
    ];
  } else if (catType === 'vegetables') {
    templates = [
      {
        rating: 5,
        title: 'Rau củ tươi rói như vừa hái tại vườn',
        content: `Nhận gói ${name} (${unit}) mà ưng cái bụng lắm luôn! Rau xanh mướt, ${sensory1}, không hề có lá úa hay dập nát. Tối qua mình đem ${dish1}, vị ngọt thanh tự nhiên ăn rất cuốn.`,
        adminReply: `Cảm ơn bạn đã yêu thích nông sản sạch tại Evergreen Mart! Rau củ luôn được thu hoạch mới mỗi ngày từ ${origin} để giao đến tay bạn tươi ngon nhất ạ.`
      },
      {
        rating: 5,
        title: 'Giàu chất xơ và vitamin, chuẩn Eat Clean',
        content: `Mình đang theo thực đơn Eat Clean nhiều rau xanh nên đặt ${name} liên tục. Sản phẩm chỉ khoảng ${kcal || 'ít calo'}, giàu chất xơ (${fiber || 'chất xơ tự nhiên'}) và ${vitamins || 'vitamin thiết yếu'}, ăn sống hay nấu chín đều giòn ngọt.`,
      },
      {
        rating: 5,
        title: 'Nông sản ' + origin + ' chuẩn sạch, an tâm cho bé',
        content: `Nhà có em bé nhỏ nên mình rất kỹ tính khi chọn rau củ. ${name} của ${brand} có nguồn gốc rõ ràng từ ${origin}, sơ chế sạch gốc, mua về chỉ cần rửa nhẹ rồi ${dish2} là bé ăn thun thút.`,
      },
      {
        rating: 4,
        title: 'Đóng gói thông khí cẩn thận, giữ tươi lâu',
        content: `Mình mua dư 2 phần ${unit} để tủ mát dùng dần trong 3-4 ngày theo hướng dẫn (${storage.toLowerCase()}) mà lấy ra nấu vẫn giòn ngọt nguyên vẹn, ${sensory2}.`,
        adminReply: `Evergreen Mart rất vui vì bạn hài lòng với quy cách đóng gói bảo quản rau củ của shop. Chúc bạn luôn có những bữa ăn xanh lành mạnh nhé!`
      },
      {
        rating: 5,
        title: 'Hương vị tự nhiên, không bị nồng hay xơ',
        content: `Thích nhất là ${shortName} ở đây non tơ, đồng đều, khi ${dish3} nước canh/món ăn trong veo và thơm dịu. Đúng chuẩn rau trồng theo quy trình kiểm soát an toàn.`,
      },
      {
        rating: 5,
        title: 'Đi chợ online mà chọn rau còn đẹp hơn tự đi lựa',
        content: `Lúc đầu đặt online cũng hơi lo rau bị dập khi ship, nhưng nhân viên Evergreen Mart xếp hàng rất khéo, đặt phần ${name} ở ngăn trên cùng nên về tới nhà vẫn mướt rượt, ${sensory1}.`,
      },
      {
        rating: 5,
        title: 'Món rau quen thuộc trong mọi bữa cơm nhà mình',
        content: `Tuần nào lên đơn mình cũng phải bỏ giỏ 1-2 phần ${name}. Vừa dễ chế biến (${dish1}, ${dish2}) vừa bổ sung nguồn ${vitamins || 'vitamin và khoáng chất'} tự nhiên cho ông bà và tụi nhỏ.`,
      },
      {
        rating: 4,
        title: 'Tươi ngon, định lượng ' + unit + ' vừa đủ bữa',
        content: `Một phần ${unit} là vừa đẹp cho một đĩa xào hoặc một tô canh của gia đình 3-4 người, không bị thừa để qua đêm. Chất lượng rau rất ổn định qua nhiều lần đặt.`,
      },
      {
        rating: 5,
        title: 'Giòn ngọt đúng chuẩn nông sản tuyển chọn',
        content: `So với mua ở siêu thị gần nhà hay bị héo do trưng trên kệ lâu, ${name} đặt tại Evergreen Mart tươi và mọng nước hơn hẳn. Cắn vào cảm nhận rõ độ tươi mới.`,
      },
      {
        rating: 5,
        title: '5 sao cho chất lượng và dịch vụ',
        content: `Từ thông tin dinh dưỡng minh bạch trên trang sản phẩm đến chất lượng thực tế của ${name} đều làm mình rất hài lòng. Sẽ tiếp tục ủng hộ dài lâu!`,
      }
    ];
  } else if (catType === 'fruits') {
    templates = [
      {
        rating: 5,
        title: 'Trái cây tươi mọng nước, ngọt thơm đúng độ',
        content: `Mình đặt ${name} (${unit}) về ăn tráng miệng và làm quà biếu. Quả nào quả nấy đều tăm tắp, ${sensory1}. Khi thưởng thức cảm nhận rõ độ tươi mới và hương thơm tự nhiên rất dễ chịu.`,
        adminReply: `Cảm ơn bạn đã tin chọn trái cây tươi tại Evergreen Mart! Chúng mình luôn tuyển lựa từng trái đạt độ chín và độ ngọt chuẩn nhất trước khi giao đến bạn ạ.`
      },
      {
        rating: 5,
        title: 'Nguồn vitamin tự nhiên tuyệt vời mỗi ngày',
        content: `Thay vì ăn vặt đồ ngọt công nghiệp, mình chọn ${name} để bổ sung ${vitamins || 'Vitamin C và chất chống oxy hóa'} cùng chất xơ (${fiber || 'tự nhiên'}). Vừa đẹp da giữ dáng vừa ngon miệng (${kcal || 'năng lượng lành mạnh'}).`,
      },
      {
        rating: 5,
        title: 'Đóng gói chống sốc cực kỳ kỹ lưỡng',
        content: `Đặt trái cây ship tận nhà sợ nhất là bị dập, nhưng Evergreen Mart bọc lót từng phần ${unit} rất cẩn thận. Nhận hàng mở ra ${sensory2}, mình đem ${dish1} cả nhà ăn khen nức nở.`,
      },
      {
        rating: 4,
        title: 'Hàng chuẩn ' + origin + ', rất đáng tiền',
        content: `Đúng chuẩn ${name} từ ${origin} (${brand}), độ tươi và vị ngọt đồng đều từ quả đầu tiên tới quả cuối cùng. Giá hợp lý so với chất lượng hàng tuyển loại 1 như thế này.`,
        adminReply: `Evergreen Mart cảm ơn nhận xét của bạn! Rất mong tiếp tục được đồng hành cùng gia đình mình trong những đơn hàng tiếp theo nhé.`
      },
      {
        rating: 5,
        title: 'Làm sinh tố, salad hay ăn trực tiếp đều xuất sắc',
        content: `Hôm qua mình lấy một nửa phần ${shortName} để ăn tươi, nửa còn lại dùng ${dish2}. Vị thanh mát tự nhiên, không bị bở hay chua gắt, trẻ con và người lớn tuổi trong nhà đều thích mê.`,
      },
      {
        rating: 5,
        title: 'Bảo quản được lâu mà vẫn giữ độ giòn ngọt',
        content: `Làm theo hướng dẫn trên web (${storage.toLowerCase()}) nên để ngăn mát mấy hôm lấy ra ăn vẫn tươi ngon như lúc mới giao, ${sensory1}.`,
      },
      {
        rating: 5,
        title: 'Trái cây tuyển chọn kỹ, không có quả hỏng',
        content: `Mình từng mua ở nhiều nơi hay bị lẫn 1-2 quả dập bên dưới, nhưng mua ${name} tại Evergreen Mart thì yên tâm 100%, quả nào cũng lành lặn và tươi tắn.`,
      },
      {
        rating: 4,
        title: 'Giao nhanh, đóng gói lịch sự',
        content: `Quy cách ${unit} đóng hộp/túi rất sạch đẹp, mua mang đi biếu người thân cũng rất lịch sự. Hôm mình đặt đơn đông nên giao trễ 10 phút nhưng shipper cực kỳ nhiệt tình và lễ phép.`,
      },
      {
        rating: 5,
        title: 'Món tráng miệng yêu thích của cả gia đình',
        content: `Cứ mỗi tuần mình lại đặt ${name} về trữ tủ lạnh. Sau bữa tối cả nhà quây quần thưởng thức, vừa mát lành vừa bổ sung đầy đủ dưỡng chất tự nhiên.`,
      },
      {
        rating: 5,
        title: 'Chất lượng ổn định qua nhiều lần mua',
        content: `Đã mua ${name} ở đây hơn 4 lần rồi và lần nào cũng ưng ý như lần đầu. Trái tươi cuống mới, vị đậm đà đúng đặc trưng của vùng trồng ${origin}.`,
      }
    ];
  } else if (catType === 'dairy') {
    templates = [
      {
        rating: 5,
        title: 'Thơm béo thanh mát, date mới tinh',
        content: `Mình đặt ${name} (${unit}) cho bữa sáng của cả gia đình. Hàng chính hãng ${brand}, hạn sử dụng còn rất xa và được giao trong túi giữ lạnh chuyên dụng. Hương vị ${sensory1}, rất dễ dùng!`,
        adminReply: `Evergreen Mart cảm ơn bạn! Các sản phẩm sữa và thực phẩm mát luôn được kiểm tra date mới mỗi ngày và vận chuyển lạnh đúng chuẩn nhiệt độ ạ.`
      },
      {
        rating: 5,
        title: 'Giàu đạm và Canxi, rất hợp cho chế độ dinh dưỡng',
        content: `Xem kỹ bảng thông số thấy sản phẩm cung cấp ${protein || 'đạm sữa chất lượng'} và ${vitamins || 'Canxi, Vitamin D3'} với mức năng lượng ${kcal || 'hợp lý'} nên mình chọn mua ngay. Dùng để ${dish1} cực kỳ tiện và ngon.`,
      },
      {
        rating: 5,
        title: 'Các bé ở nhà cực kỳ thích',
        content: `Từ khi đổi sang dùng ${name} là tụi nhỏ nhà mình tự giác uống/ăn mỗi ngày không cần nhắc. Vị ${sensory2}, thanh dịu chứ không bị ngấy, tốt cho tiêu hóa và chiều cao của bé.`,
      },
      {
        rating: 4,
        title: 'Bảo quản lạnh chuẩn chỉnh khi giao tới',
        content: `Nhận ${name} tay vẫn còn mát lạnh đúng chuẩn (${storage.toLowerCase()}). Bao bì sạch đẹp, nguyên vẹn không móp méo. Giá cả trên Evergreen Mart cũng rất cạnh tranh và hay có mã giảm giá.`,
        adminReply: `Cảm ơn bạn đã tin tưởng mua sắm tại Evergreen Mart! Chúc bạn và gia đình luôn dồi dào sức khỏe ạ.`
      },
      {
        rating: 5,
        title: 'Kết hợp làm bữa phụ hay pha chế đều tuyệt',
        content: `Ngoài dùng trực tiếp, mình còn hay lấy ${shortName} để ${dish2}. Chất lượng của ${brand} (${origin}) thì khỏi phải bàn rồi, thơm ngậy tự nhiên và rất giàu dinh dưỡng.`,
      },
      {
        rating: 5,
        title: 'Đặt online tiện lợi, không phải xách nặng',
        content: `Mỗi lần mua đồ mát hay sữa hộp/lốc (${unit}) đi siêu thị xách về khá nặng, giờ đặt trên Evergreen Mart giao tận cửa trong 2h mà hàng luôn mới, ${sensory1}.`,
      },
      {
        rating: 5,
        title: 'Hương vị nguyên bản, chất lượng ổn định',
        content: `Mình rất chuộng các dòng sản phẩm từ ${brand}. ${name} có độ sánh/thơm vừa phải, ${sensory2}, dùng vào buổi sáng hoặc bữa xế chiều giúp nạp năng lượng nhanh chóng.`,
      },
      {
        rating: 4,
        title: 'Hàng chính hãng, đóng gói cẩn thận',
        content: `Shop bọc chống sốc và giữ nhiệt kỹ nên hộp/lốc ${unit} nhận được phẳng phiu tinh tươm. Giao hàng nhanh, nhân viên thân thiện, cho 5 sao chất lượng!`,
      },
      {
        rating: 5,
        title: 'Lựa chọn hàng đầu cho tủ lạnh gia đình',
        content: `Lúc nào trong ngăn mát nhà mình cũng phải có sẵn ${name}. Vừa tốt cho hệ tiêu hóa và xương khớp của ông bà, vừa tiện cho bữa sáng nhanh gọn của hai vợ chồng.`,
      },
      {
        rating: 5,
        title: 'Sẽ tiếp tục mua lại định kỳ',
        content: `Rất hài lòng với cách Evergreen Mart hiển thị đầy đủ thông số dinh dưỡng (${kcal}, ${protein}) giúp người tiêu dùng dễ chọn đúng sản phẩm phù hợp nhu cầu. Sản phẩm chuẩn 10/10!`,
      }
    ];
  } else if (catType === 'beverages') {
    templates = [
      {
        rating: 5,
        title: 'Thơm ngon sảng khoái, giải khát cực đã',
        content: `Mình đặt ${name} (${unit}) về để tủ mát uống dần. Hương vị chuẩn của ${brand}, ${sensory1}. Nhất là những ngày thời tiết oi bức, lấy ra ${dish1} thì tỉnh táo và sảng khoái tức thì!`,
        adminReply: `Cảm ơn bạn đã đánh giá 5 sao cho ${name}! Chúc bạn luôn có những phút giây thưởng thức thức uống thật sảng khoái cùng Evergreen Mart nhé.`
      },
      {
        rating: 5,
        title: 'Đóng gói chắc chắn, giao hàng siêu tốc',
        content: `Đặt đồ uống dạng ${unit} online sợ nhất bị va đập móp lon/chai, nhưng Evergreen Mart đóng thùng carton chèn xốp rất kỹ. Hàng mới tinh, hạn sử dụng dài miên man.`,
      },
      {
        rating: 5,
        title: 'Hương vị cân bằng, thông số rõ ràng',
        content: `Mình rất thích việc web ghi rõ mức năng lượng (${kcal || 'minh bạch'}) và thành phần dinh dưỡng (${vitamins || 'khoáng chất'}) của ${name}. Hương vị ${sensory2}, rất hợp khẩu vị cả nhà.`,
      },
      {
        rating: 4,
        title: 'Tiện lợi cho các buổi tụ tập cuối tuần',
        content: `Cuối tuần nhà có khách nên mình đặt luôn mấy phần ${name} (${unit}). Ai uống cũng khen ngon và hợp với các món nướng/lẩu. Đặt trên web đỡ công chở nặng từ siêu thị về nhà.`,
        adminReply: `Dạ Evergreen Mart rất vui khi được đồng hành cùng bữa tiệc cuối tuần của gia đình bạn! Cảm ơn bạn đã ủng hộ shop ạ.`
      },
      {
        rating: 5,
        title: 'Hàng chính hãng ' + brand + ', giá tốt',
        content: `Chất lượng chuẩn ${brand} (${origin}), ${sensory1}. Bảo quản theo hướng dẫn (${storage.toLowerCase()}) rồi ướp lạnh trước khi uống là ngon hết sẩy.`,
      },
      {
        rating: 5,
        title: 'Thức uống yêu thích nơi văn phòng và ở nhà',
        content: `Mình vừa đặt cho gia đình vừa đặt gửi tới văn phòng để chiều chiều anh chị em cùng thưởng thức. Vị thanh dễ uống, không bị gắt cổ, tiếp thêm năng lượng làm việc rất tốt.`,
      },
      {
        rating: 5,
        title: 'Date xa, bảo quản kho sạch sẽ',
        content: `Nhận ${name} thấy vỏ chai/hộp/lon sáng bóng sạch sẽ, không bám bụi như mua ở một số tiệm tạp hóa nhỏ. Điều này chứng tỏ kho hàng của Evergreen Mart bảo quản cực kỳ tốt.`,
      },
      {
        rating: 4,
        title: 'Giao đúng giờ, shipper nhiệt tình',
        content: `Đơn hàng của mình gồm khá nhiều đồ uống nặng mà bạn shipper vẫn bê tận cửa tươi cười niềm nở. ${name} uống lạnh rất cuốn, ${sensory2}.`,
      },
      {
        rating: 5,
        title: 'Mua kèm đơn thực phẩm tươi sống rất tiện',
        content: `Tiện công đi chợ online mua rau thịt nên mình thêm luôn ${name} vào giỏ. Shop tách riêng túi đồ khô/đồ uống và túi đồ tươi sống rất khoa học, chuyên nghiệp.`,
      },
      {
        rating: 5,
        title: 'Chắc chắn sẽ mua lại nhiều lần',
        content: `Giá hợp lý, áp thêm mã ưu đãi của shop nữa thì quá hời cho một sản phẩm chất lượng từ ${brand}. Hoàn toàn hài lòng!`,
      }
    ];
  } else if (catType === 'bakery') {
    templates = [
      {
        rating: 5,
        title: 'Thơm ngon giòn rụm, ăn vặt cực cuốn',
        content: `Mình mua ${name} (${unit}) để nhâm nhi buổi xế chiều. Phải nói là hương vị cực kỳ ưng ý: ${sensory1}. Dùng để ${dish1} thì hợp không gì bằng!`,
        adminReply: `Cảm ơn bạn đã yêu thích ${name} tại Evergreen Mart! Chúc bạn có những giờ phút thưởng thức thật vui vẻ và ngon miệng ạ.`
      },
      {
        rating: 5,
        title: 'Bánh/hạt mới tinh, không hề bị ỉu hay hôi dầu',
        content: `Hàng chính hãng ${brand} (${origin}) có khác, mở bao bì ra là mùi thơm tỏa lên ngay, ${sensory2}. Date mới sản xuất nên giữ trọn độ giòn/mềm đặc trưng.`,
      },
      {
        rating: 5,
        title: 'Bữa phụ tiện lợi, thông tin dinh dưỡng đầy đủ',
        content: `Mình hay chuẩn bị sẵn ${name} ở bàn làm việc để nạp năng lượng lúc đói (${kcal || 'cung cấp năng lượng nhanh'}, ${protein ? `đạm ${protein}` : 'giàu dưỡng chất'}). Có bảng thông số rõ ràng nên rất dễ cân đối lượng ăn mỗi ngày.`,
      },
      {
        rating: 4,
        title: 'Đóng gói chống vỡ nát rất tốt',
        content: `Mua bánh/đồ ăn vặt online sợ nhất lúc giao tới bị vụn nát, nhưng Evergreen Mart chèn đệm khí kỹ nên phần ${unit} còn nguyên vẹn 100%. Hương vị thì khỏi chê, cả người lớn lẫn trẻ nhỏ đều mê.`,
        adminReply: `Evergreen Mart cảm ơn lời khen của bạn! Đội ngũ đóng gói luôn ưu tiên bảo vệ kỹ các mặt hàng bánh kẹo để đến tay khách hàng đẹp mắt nhất ạ.`
      },
      {
        rating: 5,
        title: 'Phù hợp làm quà biếu hoặc đãi khách',
        content: `Bao bì của ${name} (${unit}) nhìn rất lịch sự và bắt mắt. Mình mua để bàn phòng khách đãi bạn bè dịp cuối tuần cùng tách trà nóng, ai ăn thử cũng tấm tắc khen ngon.`,
      },
      {
        rating: 5,
        title: 'Vị vừa miệng, không bị ngọt gắt',
        content: `Điểm mình thích nhất ở ${shortName} là độ ngọt/mặn được tiết chế rất hài hòa, ${sensory1}, ăn nhiều một chút cũng không thấy ngấy.`,
      },
      {
        rating: 5,
        title: 'Bảo quản dễ dàng, tiện mang đi dã ngoại',
        content: `Tuần rồi gia đình mình đi picnic có mang theo ${name}. Quy cách ${unit} gọn nhẹ, mở ra ăn liền tiện lợi mà cung cấp thêm ${vitamins || 'dưỡng chất và năng lượng'} cho các bé vui chơi.`,
      },
      {
        rating: 4,
        title: 'Hàng chuẩn, giá cả hợp lý',
        content: `So sánh giá trên Evergreen Mart thấy rất tốt, lại đảm bảo nguồn gốc chính hãng ${brand}. Chỉ cần lưu ý ${storage.toLowerCase()} là giữ được độ ngon suốt nhiều ngày.`,
      },
      {
        rating: 5,
        title: 'Món tủ của các bé nhà mình',
        content: `Mỗi lần mở tủ đồ ăn vặt là tụi nhỏ tìm ngay ${name}. Sản phẩm đạt tiêu chuẩn an toàn thực phẩm rõ ràng nên bố mẹ cũng yên tâm cho con thưởng thức.`,
      },
      {
        rating: 5,
        title: '10 điểm cho chất lượng',
        content: `Đã thử nhiều loại nhưng vẫn quay lại gắn bó với ${name}. Giao hàng nhanh, đóng gói sạch sẽ, chắc chắn sẽ tiếp tục đặt thêm trong đơn tới!`,
      }
    ];
  } else {
    // Pantry: Gia vị, gạo, mì, dầu ăn, đồ khô, đồ hộp
    templates = [
      {
        rating: 5,
        title: 'Trợ thủ đắc lực cho gian bếp gia đình',
        content: `Nhà mình dùng ${name} (${unit}) của ${brand} suốt thời gian qua. Chất lượng rất chuẩn: ${sensory1}. Dùng để ${dish1} giúp món ăn dậy mùi thơm và tròn vị hơn hẳn!`,
        adminReply: `Cảm ơn bạn đã tin chọn ${name} tại Evergreen Mart! Chúc gian bếp của gia đình mình luôn đỏ lửa với thật nhiều món ngon mỗi ngày ạ.`
      },
      {
        rating: 5,
        title: 'Hàng chính hãng ' + brand + ', đóng gói cực kỳ kỹ',
        content: `Đặt hàng gia vị/thực phẩm khô (${unit}) tại Evergreen Mart rất yên tâm vì shop quấn màng chống tràn/chống rách nhiều lớp. Hàng mới, hạn sử dụng xa và nguồn gốc ${origin} rõ ràng.`,
      },
      {
        rating: 5,
        title: 'Thành phần an toàn, thông số minh bạch',
        content: `Mình rất quan tâm đến thành phần dinh dưỡng (${kcal || 'năng lượng rõ ràng'}, ${protein ? `đạm ${protein}, ` : ''}${vitamins || 'nguyên liệu chọn lọc'}) khi chọn mua thực phẩm cho gia đình. ${name} đáp ứng trọn vẹn tiêu chí sạch và ngon.`,
      },
      {
        rating: 4,
        title: 'Tiện lợi, tiết kiệm thời gian nấu nướng',
        content: `Có sẵn ${name} trong tủ bếp thì việc ${dish2} trở nên nhanh gọn hơn rất nhiều, hương vị ${sensory2}. Giao hàng nhanh trong ngày nên lúc đang thiếu nguyên liệu đặt cái là có ngay.`,
        adminReply: `Evergreen Mart cảm ơn nhận xét của bạn! Rất hân hạnh được đồng hành cùng những bữa cơm ngon và tiện lợi của gia đình bạn.`
      },
      {
        rating: 5,
        title: 'Hương vị đậm đà, hợp khẩu vị cả nhà',
        content: `Mình đã thử qua nhiều thương hiệu khác nhau nhưng vẫn ưng ý nhất với ${name}. Khi chế biến (${dish1}) tạo nên hương vị hài hòa tự nhiên, không bị gắt hay lấn át mùi tươi của nguyên liệu.`,
      },
      {
        rating: 5,
        title: 'Bảo quản lâu dài, thiết kế bao bì tiện dụng',
        content: `Quy cách ${unit} rất vừa tầm tay, dễ sử dụng và bảo quản (${storage.toLowerCase()}). Dùng suốt mấy tuần mà chất lượng bên trong vẫn thơm ngon như lúc mới khui.`,
      },
      {
        rating: 5,
        title: 'Đặt kèm đơn đi chợ hàng tuần siêu tiện',
        content: `Thay vì phải ra siêu thị xếp hàng chờ thanh toán chai lọ/túi nặng, mình đặt ${name} chung với rau thịt trên Evergreen Mart luôn. Hàng giao tới sạch bóng, nguyên đai nguyên kiện.`,
      },
      {
        rating: 4,
        title: 'Chất lượng ổn định, giá tốt',
        content: `Mức giá ${p.price} cho quy cách ${unit} chính hãng ${brand} là rất hợp lý. Đặc biệt kết hợp với các voucher của shop thì tiết kiệm được kha khá chi phí sinh hoạt hàng tháng.`,
      },
      {
        rating: 5,
        title: 'Món nào có sản phẩm này cũng ngon hơn',
        content: `Hôm qua mình dùng ${shortName} để ${dish3 || dish1}, ông xã và các con khen tấm tắc. Đúng là nguyên liệu chuẩn từ ${origin} mang lại sự khác biệt rõ rệt cho bữa cơm nhà.`,
      },
      {
        rating: 5,
        title: 'Uy tín 5 sao, sẽ mua lại dài lâu',
        content: `Rất hài lòng với trải nghiệm mua sắm tại Evergreen Mart. Từ mô tả chi tiết, thông số dinh dưỡng cho đến chất lượng thực tế của ${name} đều chuẩn chỉnh 100%!`,
      }
    ];
  }

  const startPersonaIdx = h % CUSTOMER_PERSONAS.length;
  const step = ((h >> 4) % 7) + 1; // bước nhảy nguyên tố cùng nhau với 40 khi chọn khéo
  const usedIndices = new Set();
  const baseDateMs = new Date('2026-10-28T10:00:00.000Z').getTime();

  const docs = [];
  for (let i = 0; i < count; i++) {
    let pIdx = (startPersonaIdx + i * 3 + (step % 2)) % CUSTOMER_PERSONAS.length;
    while (usedIndices.has(pIdx)) {
      pIdx = (pIdx + 1) % CUSTOMER_PERSONAS.length;
    }
    usedIndices.add(pIdx);

    const persona = CUSTOMER_PERSONAS[pIdx];
    const tpl = templates[i % templates.length];

    // Tạo ngày đánh giá lùi tự nhiên từ 2 -> 60 ngày trước
    const daysAgo = 2 + ((h + i * 7) % 55);
    const hoursOffset = (h + i * 5) % 20;
    const createdAt = new Date(baseDateMs - (daysAgo * 86400000) - (hoursOffset * 3600000));
    const adminReplyAt = tpl.adminReply ? new Date(createdAt.getTime() + 4 * 3600000) : null;

    // Gắn ảnh thực tế của sản phẩm cho 1-2 đánh giá đầu tiên để tab "Có hình ảnh" hiển thị đẹp
    const hasImage = (i === 0 || (i === 2 && count >= 7)) && Boolean(p.image);

    // Tạo số lượt "Hữu ích" tự nhiên (0 -> 6 lượt)
    const helpfulCount = (h + i * 3) % 6;
    const helpfulBy = HELPFUL_VOTER_IDS.slice(0, helpfulCount);

    docs.push({
      product: String(p._id),
      productName: name,
      productImage: p.image || '',
      user: new mongoose.Types.ObjectId(persona.id),
      userName: persona.name,
      userAvatar: persona.avatar || '',
      rating: tpl.rating,
      title: tpl.title,
      content: tpl.content,
      images: hasImage ? [p.image] : [],
      helpfulBy,
      verifiedPurchase: i % 6 !== 4, // ~85% đã mua hàng
      adminReply: tpl.adminReply || '',
      adminReplyAt,
      isHidden: false,
      createdAt,
      updatedAt: adminReplyAt || createdAt,
    });
  }

  return docs;
}

async function seedDatabase(uri, label) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 });
  console.log(`✅ Connected to ${label}`);

  const products = await Product.find({}).lean();
  console.log(`   Found ${products.length} products in ${label}`);

  const productMap = new Map(products.map(p => [String(p._id), p]));
  const seededUserIds = CUSTOMER_PERSONAS.map(c => new mongoose.Types.ObjectId(c.id));

  // Xóa các đánh giá mẫu cũ (nếu chạy lại script) nhưng GIỮ NGUYÊN đánh giá thật của user
  const delRes = await Review.deleteMany({ user: { $in: seededUserIds } });
  console.log(`   Cleared ${delRes.deletedCount} previous seeded reviews (kept real user reviews intact).`);

  const allReviewDocs = [];
  for (const p of products) {
    const prodReviews = buildProductReviews(p, productMap);
    allReviewDocs.push(...prodReviews);
  }

  // Insert theo batch 1000 documents để nhanh và ổn định
  const BATCH_SIZE = 1000;
  let inserted = 0;
  for (let i = 0; i < allReviewDocs.length; i += BATCH_SIZE) {
    const batch = allReviewDocs.slice(i, i + BATCH_SIZE);
    await Review.collection.insertMany(batch, { ordered: false });
    inserted += batch.length;
  }

  const finalCount = await Review.countDocuments();
  console.log(`   🎉 Inserted ${inserted} reviews across ${products.length} products in ${label} (Total reviews in DB: ${finalCount}).`);
  await mongoose.disconnect();
}

async function main() {
  const primaryUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/xanh-la';
  await seedDatabase(primaryUri, 'Primary MongoDB');

  const localUri = 'mongodb://127.0.0.1:27017/xanh-la';
  if (primaryUri !== localUri) {
    try {
      await seedDatabase(localUri, 'Local MongoDB (127.0.0.1:27017/xanh-la)');
    } catch (e) {
      console.log('ℹ️ Local MongoDB not running or skipped:', e.message);
    }
  }
}

main().catch(err => {
  console.error('❌ Error seeding reviews:', err);
  process.exit(1);
});

