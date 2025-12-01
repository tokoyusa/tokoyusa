
export interface Product {
  id: string;
  name: string;
  image: string; // URL
  category: string;
  description: string;
  price: number;
  discountPrice?: number;
  fileUrl?: string; // Link to the digital product
  isPopular?: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'BANK' | 'E-WALLET' | 'QRIS' | 'TRIPAY';
  name: string;
  accountNumber?: string;
  accountName?: string;
  description?: string;
  logo?: string;
  isActive?: boolean;
}

export interface StoreSettings {
  storeName: string;
  address: string;
  whatsapp: string;
  email: string;
  description: string;
  logoUrl: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  tripayApiKey?: string;
  tripayPrivateKey?: string;
  tripayMerchantCode?: string;
  // Admin Auth
  adminUsername?: string;
  adminPassword?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface User {
  role: 'ADMIN' | 'CUSTOMER' | 'AFFILIATE';
  name: string;
  id?: string; // Used for affiliate linking or customer ID
  phone?: string; // WhatsApp number for customers
}

export interface Customer {
  id: string;
  name: string;
  whatsapp: string; // Unique ID used for login
  password: string;
  createdAt: string;
}

export interface Voucher {
  id: string;
  code: string;
  type: 'FIXED' | 'PERCENT'; // Potongan Tetap (Rp) atau Persen (%)
  value: number;
  isActive: boolean;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  customerName: string;
  customerWhatsapp: string;
  paymentMethod: string;
  status: 'PENDING' | 'PAID' | 'COMPLETED';
  date: string;
  voucherCode?: string;
  discountAmount?: number;
}

export interface Affiliate {
  id: string;
  name: string;
  code: string; // Unique referral code
  password: string; // Simple auth
  commissionRate: number; // Percentage (e.g., 10 for 10%)
  totalEarnings: number;
  bankDetails: string; // Rekening untuk transfer komisi
  isActive: boolean;
}
