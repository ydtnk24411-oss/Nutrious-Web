export interface XanhLaCategory {
  name: string;
  slug: string;
  image: string;
}

export interface XanhLaProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  priceNumber: number;
  image: string;
  category: string;
  categoryVi: string;
  container: string;
  cutType: string;
  cutting: string;
  packSize: string;
  packaging: string;
  preparation: string;
  quantity: string;
  ripeness: string;
  sizeGroup: string;
  thickness: string;
  type: string;
  weight: string;
  description: string;
  options?: { name: string; values: string[] }[];
  averageRating?: number;
  reviewCount?: number;
}

export interface XanhLaMeal {
  name: string;
  nutrition: string;
  image: string;
}

export interface XanhLaNutritionGoal {
  name: string;
  image: string;
}

export interface XanhLaAddress {
  id: string;
  label: string;       // "Nhà riêng", "Văn phòng"...
  fullName: string;
  phone: string;
  address: string;
  city: string;
  isDefault: boolean;
}

export interface XanhLaUser {
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  title?: string;
  addresses?: XanhLaAddress[];
  loyaltyTier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  points?: number;
  totalSpent?: number;
  createdAt?: string;
}

export interface XanhLaCartItem {
  product: XanhLaProduct;
  quantity: number;
  selectedOption?: string;
}

export interface EventItem {
  id: string;
  name: string;
  slug: string;
  date: string;
  time: string;
  location: string;
  description: string;
  action: string;
  image: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  price: string;
  status: string;
  action: string;
  description: string;
}

export interface NavItem {
  label: string;
  path: string;
}

// ── Review System ───────────────────────────────────
export interface ProductReview {
  id: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  title?: string;
  content: string;
  images?: string[];
  helpfulCount: number;
  isHelpful?: boolean;
  createdAt: string;
  verifiedPurchase: boolean;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

// ── Voucher System ──────────────────────────────────
export type VoucherType = 'percentage' | 'fixed' | 'freeship' | 'category';

export interface Voucher {
  id: string;
  code: string;
  name: string;
  type: VoucherType;
  value: number; // percentage or fixed amount
  minValue?: number; // minimum order value
  maxValue?: number; // maximum discount amount
  categorySlugs?: string[]; // applicable categories
  startDate: string;
  endDate: string;
  usageLimit?: number;
  usedCount: number;
  description: string;
  isPublic: boolean;
}

export interface UserVoucher {
  voucherId: string;
  voucher: Voucher;
  status: 'available' | 'used' | 'expired';
  usedAt?: string;
  orderId?: string;
}

// ── Loyalty & Points System ─────────────────────────
export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface LoyaltyTierConfig {
  tier: LoyaltyTier;
  name: string;
  minPoints: number;
  minSpent: number;
  benefits: string[];
  icon: string;
}

export interface PointTransaction {
  id: string;
  userId: string;
  type: 'earned' | 'redeemed' | 'adjusted';
  amount: number;
  description: string;
  orderId?: string;
  rewardId?: string;
  createdAt: string;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  image: string;
  pointsRequired: number;
  type: 'voucher' | 'gift' | 'shipping';
  value?: number;
  voucherId?: string;
  available: boolean;
  stock?: number;
}

export interface Redemption {
  id: string;
  userId: string;
  rewardId: string;
  reward: LoyaltyReward;
  pointsUsed: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
}

// ── Order System ─────────────────────────────────────
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled' | 'returned';

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  selectedOption?: string;
}

export interface Order {
  id: string;
  orderCode: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  voucherCode?: string;
  voucherDiscount?: number;
  pointsUsed?: number;
  pointsEarned?: number;
  total: number;
  status: OrderStatus;
  shippingAddress: XanhLaAddress;
  createdAt: string;
  updatedAt: string;
}
