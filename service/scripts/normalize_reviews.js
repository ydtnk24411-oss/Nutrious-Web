const path = require('path');
const serviceDir = 'c:/Users/Admin/Downloads/Nutrious-Web/service';
const mongoose = require(path.join(serviceDir, 'node_modules/mongoose'));
const dotenv = require(path.join(serviceDir, 'node_modules/dotenv'));
dotenv.config({ path: path.join(serviceDir, '.env') });

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;
  const reviewsCol = db.collection('reviews');
  const productsCol = db.collection('products');
  const usersCol = db.collection('users');
  const ordersCol = db.collection('orders');

  console.log('--- Cleaning up 3500+ dummy reviews ---');
  const deleteRes = await reviewsCol.deleteMany({});
  console.log(`Deleted ${deleteRes.deletedCount} old dummy reviews.`);

  // Lấy các sản phẩm thực tế đã được bán trong 51 đơn hàng
  const orders = await ordersCol.find({}).toArray();
  const boughtMap = new Map();
  orders.forEach(o => {
    if (Array.isArray(o.items)) {
      o.items.forEach(it => {
        const pid = String(it.productId || it.product || it._id || '');
        if (pid) boughtMap.set(pid, (boughtMap.get(pid) || 0) + 1);
      });
    }
  });

  const boughtProductIds = Array.from(boughtMap.keys()).map(id => {
    try { return new mongoose.Types.ObjectId(id); } catch(e) { return id; }
  });

  const boughtProducts = await productsCol.find({
    $or: [{ _id: { $in: boughtProductIds } }, { slug: { $in: Array.from(boughtMap.keys()) } }]
  }).toArray();

  console.log(`Found ${boughtProducts.length} actual bought products from orders.`);

  // Lấy danh sách users thật hoặc tạo personas người mua thực tế
  const users = await usersCol.find({ role: { $ne: 'admin' } }).limit(20).toArray();
  const customerList = [
    { name: 'Nguyễn Minh Thư', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&q=80' },
    { name: 'Trần Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80' },
    { name: 'Lê Thuỳ Dung', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80' },
    { name: 'Phạm Đức Huy', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&q=80' },
    { name: 'Đỗ Hải Yến', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&q=80' },
    { name: 'Vũ Quốc Bảo', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&q=80' },
    { name: 'Bùi Lan Anh', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&q=80' },
    { name: 'Ngô Thanh Tùng', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&q=80' },
    { name: 'Hoàng Mai Phương', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&q=80' },
    { name: 'Đinh Tuấn Kiệt', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&q=80' }
  ];

  // Mẫu nhận xét thực tế phù hợp với quy mô ~ 28 đánh giá cho 51 đơn
  const reviewTemplates = [
    { rating: 5, title: 'Rất tươi và sạch', content: 'Rau nhận được rất tươi xanh, cuống còn ướt và không bị giập nát. Giao hàng hỏa tốc trong 2h siêu tiện lợi!', reply: 'Cảm ơn bạn đã tin chọn nông sản tươi sạch của Evergreen Mart ạ!' },
    { rating: 5, title: 'Chất lượng xuất sắc', content: 'Cửa hàng đóng gói bằng túi giấy thân thiện môi trường rất ưng ý. Rau củ quả giòn ngọt tự nhiên, luộc chấm kho quẹt ngon lắm.', reply: 'Dạ Evergreen Mart cảm ơn quý khách nhiều, chúc gia đình bữa ăn ngon miệng ạ!' },
    { rating: 5, title: 'Hàng chuẩn VietGAP', content: 'Có dán tem QR truy xuất nguồn gốc nông trại rõ ràng nên cho bé ăn rất an tâm. Sẽ đặt định kỳ hàng tuần.', reply: '' },
    { rating: 4, title: 'Tươi ngon, giao đúng hẹn', content: 'Rau tươi mướt, chỉ có một vài cọng rìa hơi dập nhẹ do vận chuyển nhưng không đáng kể. Nhân viên giao hàng lịch sự.', reply: 'Dạ cảm ơn bạn đã góp ý, shop sẽ cải thiện lớp đệm xốp lót hộp khi giao hàng xa ạ.' },
    { rating: 5, title: 'Đáng đồng tiền', content: 'Giá cả rất hợp lý so với chất lượng siêu thị. Đặt buổi sáng 10h là 11h30 shipper đã bấm chuông giao tận cửa.', reply: '' },
    { rating: 5, title: 'Tuyệt vời', content: 'Mua về làm salad ăn thanh mát cực kỳ. Tươi rói như vừa hái tại vườn Đà Lạt về.', reply: '' },
    { rating: 4, title: 'Sản phẩm tốt', content: 'Bó rau khá đầy đặn, cân đủ trọng lượng. Màu sắc tươi tự nhiên không dùng thuốc bảo quản.', reply: '' },
    { rating: 5, title: 'Hài lòng 10/10', content: 'Combo rau củ quả này nấu canh ngọt nước tự nhiên không cần nhiều gia vị. Đánh giá 5 sao!', reply: 'Evergreen Mart trân trọng cảm ơn sự ủng hộ của bạn ạ!' },
    { rating: 3, title: 'Cần bảo quản mát hơn', content: 'Chất lượng rau thì ngon nhưng lúc giao tới hơi bị hầm nóng một chút trong cốp xe. Nên có túi đá giữ lạnh.', reply: 'Dạ Evergreen Mart đã tiếp nhận và trang bị thêm túi đá gel làm mát cho các đơn shipper ạ, thành thật xin lỗi bạn!' },
    { rating: 5, title: 'Rất an tâm', content: 'Đã mua nhiều lần của Evergreen Mart từ chi nhánh Thủ Đức tới Quận 1, lần nào cũng đều đặn tươi ngon.', reply: '' },
    { rating: 5, title: 'Tươi xanh mơn mởn', content: 'Lá rau không hề có vết sâu rầy hay úa vàng. Sơ chế rửa lại nước muối rất nhanh và sạch cát.', reply: '' },
    { rating: 5, title: 'Giao hàng nhanh', content: 'Trái cây ngọt thanh, mọng nước, vỏ bóng bẩy không vết trầy. Cả nhà ai cũng khen ngon.', reply: '' },
    { rating: 4, title: 'Khá hài lòng', content: 'Giao đủ số lượng, có kèm hóa đơn chi tiết. Shipper cẩn thận dặn dò bảo quản ngăn mát tủ lạnh.', reply: '' },
    { rating: 5, title: 'Chất lượng chuẩn 5 sao', content: 'Rau organic chuẩn sạch, ăn sống rất giòn và ngọt hậu. Sẽ giới thiệu cho đồng nghiệp cơ quan cùng mua.', reply: 'Cảm ơn bạn yêu quý đã lan tỏa nông sản sạch cùng Evergreen Mart!' }
  ];

  const now = Date.now();
  const newReviews = [];
  const selectedProducts = boughtProducts.slice(0, Math.min(boughtProducts.length, 25));

  for (let i = 0; i < 28; i++) {
    const prod = selectedProducts[i % selectedProducts.length];
    const customer = customerList[i % customerList.length];
    const fallbackUser = users[i % (users.length || 1)] || { _id: new mongoose.Types.ObjectId() };
    const tpl = reviewTemplates[i % reviewTemplates.length];
    const createdAgo = (28 - i) * 12 * 3600 * 1000 + Math.floor(Math.random() * 3600000);
    const createdAt = new Date(now - createdAgo);

    const doc = {
      product: String(prod._id),
      productName: prod.name || 'Nông sản hữu cơ',
      productImage: prod.image || (Array.isArray(prod.images) ? prod.images[0] : '') || '',
      user: fallbackUser._id,
      userName: customer.name,
      userAvatar: customer.avatar,
      rating: tpl.rating,
      title: tpl.title,
      content: tpl.content,
      likeCount: Math.floor(Math.random() * 8),
      verifiedPurchase: true,
      isHidden: false,
      createdAt,
      updatedAt: createdAt
    };

    if (tpl.reply) {
      doc.adminReply = tpl.reply;
      doc.adminReplyAt = new Date(createdAt.getTime() + 2 * 3600 * 1000);
      doc.sellerReply = {
        text: tpl.reply,
        repliedBy: 'Chăm sóc khách hàng Evergreen Mart',
        role: 'Admin',
        repliedAt: new Date(createdAt.getTime() + 2 * 3600 * 1000)
      };
    }

    newReviews.push(doc);
  }

  const insertRes = await reviewsCol.insertMany(newReviews);
  console.log(`Inserted ${insertRes.insertedCount} realistic, order-correlated reviews.`);

  // Cập nhật reviewCount & averageRating cho từng product trong DB
  const allProds = await productsCol.find({}).project({ _id: 1 }).toArray();
  for (const p of allProds) {
    const pReviews = newReviews.filter(r => r.product === String(p._id));
    const count = pReviews.length;
    const avg = count > 0 ? Number((pReviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1)) : 5;
    await productsCol.updateOne(
      { _id: p._id },
      { $set: { reviewCount: count, averageRating: avg } }
    );
  }

  console.log('Updated reviewCount and averageRating on products.');
  const totalAfter = await reviewsCol.countDocuments({});
  console.log(`Final total reviews in DB: ${totalAfter}`);

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
