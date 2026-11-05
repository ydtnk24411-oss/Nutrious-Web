export interface AdminUser {
  /** MongoDB identifier */
  _id: string; // corresponds to { "$oid": "..." }
  name: string;
  email: string;
  /** Hashed password */
  password: string;
  phone?: string;
  avatar?: string;
  role: string; // e.g., "admin"
  isActive: boolean;
  points: number;
  tier: string; // e.g., "bronze"
  totalSpent: number;
  /** Array of address objects – structure depends on your app */
  addresses: any[];
  createdAt: Date;
  updatedAt: Date;
  __v?: number;
}
