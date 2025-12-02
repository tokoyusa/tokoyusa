
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  affiliate_code?: string;
  referred_by?: string;
  phone?: string;
  balance?: number;
  // User Bank Details for Withdrawal
  bank_name?: string;
  bank_number?: string;
  bank_holder?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discount_price?: number; // If set, this is the active price
  category: string;
  image_url: string;
  file_url: string; // Link to download or access
  is_active: boolean;
  created_at?: string;
}

export interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'failed' | 'completed';
  payment_method: string;
  payment_proof?: string;
  items: OrderItem[];
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
}

export interface StoreSettings {
  store_name: string;
  store_description: string;
  whatsapp_number: string;
  email_contact: string;
  address: string;
  tripay_api_key?: string;
  tripay_private_key?: string;
  tripay_merchant_code?: string;
  affiliate_commission_rate?: number; // Percentage (e.g., 10 for 10%)
  bank_accounts: {
    bank: string;
    number: string;
    name: string;
  }[];
  e_wallets: {
    provider: 'DANA' | 'OVO' | 'GOPAY' | 'SHOPEEPAY' | 'LINKAJA';
    number: string;
    name: string;
  }[];
  qris_url?: string; // Generated or uploaded QRIS image URL
}

export interface CartItem extends Product {
  quantity: number; // usually 1 for digital products
}

// Supabase Local Config
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
