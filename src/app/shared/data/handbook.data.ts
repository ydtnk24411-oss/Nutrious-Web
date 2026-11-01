export interface ArticleSection {
  heading: string;
  text: string;
  tips?: string[];
}

export interface HandbookArticle {
  slug: string;
  title: string;
  category: string;
  badge: string;
  image: string;
  date: string;
  readTime: string;
  summary: string;
  sections: ArticleSection[];
  relatedCta?: {
    text: string;
    buttonText: string;
    link: string;
    queryParams?: Record<string, string>;
  };
}

export const HANDBOOK_ARTICLES: HandbookArticle[] = [
  {
    slug: 'meo-chon-rau-cu-tuoi-ngon',
    title: 'Mẹo chọn rau củ tươi ngon cho cả tuần',
    category: 'CẨM NANG MUA SẮM',
    badge: 'GÓC SỐNG XANH',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=85',
    date: 'CẨM NANG MUA SẮM • 28/10/2026',
    readTime: '4 phút đọc',
    summary: 'Bí quyết chọn lựa rau củ quả tươi sạch mọng nước, không hóa chất và phương pháp bảo quản giữ trọn vitamin, khoáng chất suốt cả tuần bận rộn.',
    sections: [
      {
        heading: '1. Quan sát hình dáng và màu sắc tự nhiên',
        text: 'Nhiều người thường có thói quen chọn những loại rau củ quá bóng bẩy, lá mướt xanh đậm bất thường. Tuy nhiên, rau củ quả canh tác an toàn và hữu cơ thường có màu sắc tự nhiên, dáng vẻ mộc mạc, kích thước vừa phải và không quá đồng đều. Tránh chọn những loại quả có vết bầm tím, dấu hiệu ủng nước hay đốm lạ dưới vỏ.',
        tips: [
          'Rau ăn lá: Chọn cọng giòn cứng, màu xanh tươi sáng, lá không dập úng hay có nhớt.',
          'Củ quả: Cầm chắc tay, vỏ trơn nhẵn tự nhiên, không bị mềm nhũn ở hai đầu.',
        ],
      },
      {
        heading: '2. Kiểm tra cuống và độ giòn của rau',
        text: 'Cuống là bộ phận phản ánh độ tươi chính xác nhất của rau củ. Nếu cuống còn tươi, có mủ hoặc vết cắt mới thì đó là rau vừa được thu hoạch trong ngày. Ngược lại, nếu vết cắt cuống đã thâm đen, teo tóp hoặc héo rũ thì rau đã để nhiều ngày.',
        tips: [
          'Với cà chua, dưa leo: Chọn quả còn nguyên núm cuống dính chặt vào thân.',
          'Với bông cải, bắp cải: Phần gốc cuống phải còn trắng giòn, không bị xơ nâu.',
        ],
      },
      {
        heading: '3. Phân loại và cách bảo quản nguyên tuần',
        text: 'Để rau củ tươi ngon cả tuần mà không bị thối nhũn, nguyên tắc vàng là không rửa rau trước khi cho vào tủ lạnh, vì độ ẩm thừa là nguyên nhân hàng đầu khiến vi khuẩn sinh sôi.',
        tips: [
          'Nhặt bỏ những lá vàng, dập hỏng trước khi cất.',
          'Bọc rau trong giấy hút ẩm hoặc túi zip có lỗ thoáng khí.',
          'Bảo quản ở ngăn rau củ (nhiệt độ từ 3 - 6°C) để giữ trọn độ ẩm và dưỡng chất.',
        ],
      },
      {
        heading: '4. Mua sắm thông minh tại Xanh Lá',
        text: 'Tại Xanh Lá, toàn bộ rau củ đều được kiểm định chất lượng nghiêm ngặt, thu hoạch từ các nông trại sạch chuẩn VietGAP và hữu cơ, đóng gói cẩn thận và giao nhanh trong ngày để đảm bảo độ tươi mới tối đa khi đến tay bạn.',
      },
    ],
    relatedCta: {
      text: 'Khám phá ngay danh mục Rau củ tươi sạch tại Xanh Lá:',
      buttonText: 'Mua sắm rau củ ngay',
      link: '/online-ordering',
      queryParams: { category: 'Rau củ' },
    },
  },
  {
    slug: 'thuc-don-nhanh-gon-ngay-ban-ron',
    title: 'Gợi ý thực đơn nhanh gọn cho ngày bận rộn',
    category: 'CẢM HỨNG GIAN BẾP',
    badge: 'GÓC SỐNG XANH',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85',
    date: 'CẢM HỨNG GIAN BẾP • 26/10/2026',
    readTime: '5 phút đọc',
    summary: 'Công thức lên thực đơn 30 phút cho bữa cơm gia đình đủ 4 nhóm dưỡng chất: đạm, chất xơ, vitamin và tinh bột lành mạnh mà không tốn công chuẩn bị.',
    sections: [
      {
        heading: '1. Nguyên tắc lên thực đơn nhanh 30 phút',
        text: 'Một bữa ăn cân bằng không nhất thiết phải cầu kỳ. Chỉ cần bạn áp dụng công thức "1 món mặn + 1 món canh + 1 món xào/luộc", kết hợp cùng các nguyên liệu đã được sơ chế sẵn từ Xanh Lá, bạn hoàn toàn có thể hoàn thành mâm cơm ấm cúng chỉ trong nửa tiếng.',
      },
      {
        heading: '2. Gợi ý 3 thực đơn tiêu biểu cho tuần làm việc',
        text: 'Dưới đây là 3 gợi ý thực đơn dễ làm, giàu dinh dưỡng và được nhiều gia đình yêu thích:',
        tips: [
          'Thực đơn 1: Cá hồi áp chảo sốt bơ tỏi + Canh rau ngót nấu thịt bằm + Cơm gạo lứt.',
          'Thực đơn 2: Thịt heo xào ớt chuông đậu que + Canh chua tôm tươi + Tráng miệng táo giòn.',
          'Thực đơn 3: Ức gà cuộn nấm sốt dầu hào + Canh cải ngọt nấu tôm + Salad rau mầm.',
        ],
      },
      {
        heading: '3. Mẹo sơ chế trước (Meal Prep) vào cuối tuần',
        text: 'Dành ra 45 phút vào chiều Chủ nhật để sơ chế, rửa sạch, chia phần thịt cá vào hộp bảo quản và ướp sẵn gia vị. Đến các buổi tối trong tuần, bạn chỉ việc cho vào nồi chiên không dầu hoặc chảo nấu trong chớp mắt.',
        tips: [
          'Thịt cá chia thành từng phần vừa ăn cho từng bữa trước khi cấp đông.',
          'Gia vị ướp sẵn giúp nguyên liệu thấm sâu và thơm ngon hơn.',
        ],
      },
    ],
    relatedCta: {
      text: 'Trải nghiệm tiện ích gợi ý công thức dinh dưỡng thông minh:',
      buttonText: 'Khám phá Dinh Dưỡng Thông Minh',
      link: '/nutrition',
    },
  },
  {
    slug: 'sap-xep-can-bep-gon-gang',
    title: 'Sắp xếp căn bếp gọn gàng, dễ tìm nguyên liệu',
    category: 'SỐNG TIỆN NGHI',
    badge: 'GÓC SỐNG XANH',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=85',
    date: 'SỐNG TIỆN NGHI • 24/10/2026',
    readTime: '4 phút đọc',
    summary: 'Cách bố trí các khu vực nấu nướng, gia vị và tủ lạnh khoa học theo phương pháp Nhật Bản giúp căn bếp luôn ngăn nắp, tiết kiệm thời gian nội trợ.',
    sections: [
      {
        heading: '1. Phân chia khu vực bếp theo nguyên tắc tầm với',
        text: 'Hãy sắp xếp các vật dụng và nguyên liệu dựa trên tần suất bạn sử dụng chúng. Những món dùng hàng ngày (dầu ăn, nước mắm, muối, tiêu, thớt, dao) nên nằm ngay trong tầm với cạnh bếp nấu. Những gia vị ít dùng hơn hoặc thực phẩm khô tích trữ có thể để ở các kệ cao hoặc tủ dưới.',
        tips: [
          'Khu vực chuẩn bị: Thớt, dao, tô rổ ở gần bồn rửa.',
          'Khu vực nấu: Gia vị cơ bản, xẻng đảo, chảo nồi ở gần bếp.',
          'Khu vực bảo quản: Hộp đựng khô, gia vị dự trữ ở nơi khô ráo thoáng mát.',
        ],
      },
      {
        heading: '2. Tận dụng hũ thủy tinh đồng bộ và nhãn dán',
        text: 'Thay vì để nguyên liệu trong các bao bì nilon lộn xộn, hãy chuyển gạo, đậu, ngũ cốc, gia vị khô vào các hũ thủy tinh trong suốt có nắp kín. Điều này vừa giúp bảo quản thực phẩm tránh mối mọt, vừa giúp bạn nhìn thấy rõ lượng nguyên liệu còn lại để kịp thời bổ sung.',
        tips: [
          'Dán nhãn ghi tên gia vị và hạn sử dụng ở nắp hoặc thân hũ.',
          'Sử dụng khay xoay 360 độ cho góc tủ sâu để dễ dàng lấy đồ bên trong.',
        ],
      },
      {
        heading: '3. Nguyên tắc FIFO (First In, First Out) cho tủ lạnh',
        text: 'Xếp thực phẩm mua trước ra phía ngoài để dùng trước, thực phẩm mới mua để vào phía trong. Định kỳ kiểm tra tủ lạnh vào cuối tuần để dọn dẹp và lên danh sách những món cần mua cho tuần tới.',
      },
    ],
    relatedCta: {
      text: 'Khám phá danh mục Gia vị & Thực phẩm khô chất lượng tại Xanh Lá:',
      buttonText: 'Xem Gia vị & Thực phẩm khô',
      link: '/online-ordering',
      queryParams: { category: 'Gia vị & Thực phẩm khô' },
    },
  },
];

