
import { Product, StoreSettings, PaymentMethod, Order, Voucher, Affiliate, Customer } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'ds_products',
  SETTINGS: 'ds_settings',
  PAYMENTS: 'ds_payments',
  ORDERS: 'ds_orders',
  VOUCHERS: 'ds_vouchers',
  AFFILIATES: 'ds_affiliates',
  CUSTOMERS: 'ds_customers',
};

// Initial Data
const initialSettings: StoreSettings = {
  storeName: 'DigiStore Pro',
  address: 'Jl. Digital No. 1, Jakarta',
  whatsapp: '6281234567890',
  email: 'admin@digistore.com',
  description: 'Toko produk digital terpercaya dan terlengkap.',
  logoUrl: 'https://picsum.photos/id/42/200/200',
  // Admin Credentials Default
  adminUsername: 'admin',
  adminPassword: 'admin',
  // Inject Environment Variables automatically
  supabaseUrl: (import.meta as any).env?.VITE_SUPABASE_URL || '',
  supabaseKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
};

const initialPayments: PaymentMethod[] = [
  { id: '550e8400-e29b-41d4-a716-446655440010', type: 'BANK', name: 'Bank BCA', accountNumber: '1234567890', accountName: 'Admin Store', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440011', type: 'BANK', name: 'Bank Mandiri', accountNumber: '0987654321', accountName: 'Admin Store', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Bank_Mandiri_logo_2016.svg', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440012', type: 'E-WALLET', name: 'DANA', accountNumber: '081234567890', accountName: 'Admin Store', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dana_blue.svg', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440013', type: 'QRIS', name: 'QRIS Payment', accountNumber: 'N/A', accountName: 'DigiStore', description: 'Scan QR untuk membayar', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440014', type: 'TRIPAY', name: 'Tripay Automatis', description: 'Metode pembayaran otomatis', isActive: true },
];

const initialProducts: Product[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Premium UI Kit',
    category: 'Design',
    price: 150000,
    discountPrice: 99000,
    image: 'https://picsum.photos/id/1/400/400',
    description: 'High quality UI Kit for mobile apps.',
    isPopular: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'React Dashboard Template',
    category: 'Code',
    price: 350000,
    discountPrice: 299000,
    image: 'https://picsum.photos/id/3/400/400',
    description: 'Complete admin dashboard built with React and Tailwind.',
    isPopular: false,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'E-book: Mastering React',
    category: 'Education',
    price: 75000,
    image: 'https://picsum.photos/id/24/400/400',
    description: 'A comprehensive guide to modern React development.',
    isPopular: true,
  }
];

const initialVouchers: Voucher[] = [
  { id: '550e8400-e29b-41d4-a716-446655440004', code: 'DISKON10', type: 'PERCENT', value: 10, isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440005', code: 'HEMAT20K', type: 'FIXED', value: 20000, isActive: true },
];

const initialAffiliates: Affiliate[] = [
  { 
    id: '550e8400-e29b-41d4-a716-446655440006', 
    name: 'Partner Satu', 
    code: 'PARTNER1', 
    password: '123', 
    commissionRate: 10, 
    totalEarnings: 150000, 
    bankDetails: 'BCA 123456', 
    isActive: true 
  }
];

// Helper to get from local storage or default
const get = <T>(key: string, defaultVal: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultVal;
  try {
    const parsed = JSON.parse(stored);
    // Force update Supabase credentials from Env Vars if local storage is missing them but Env exists
    if (key === STORAGE_KEYS.SETTINGS && (!parsed.supabaseUrl || !parsed.supabaseKey)) {
        const env = (import.meta as any).env;
        if (env?.VITE_SUPABASE_URL) parsed.supabaseUrl = env.VITE_SUPABASE_URL;
        if (env?.VITE_SUPABASE_ANON_KEY) parsed.supabaseKey = env.VITE_SUPABASE_ANON_KEY;
    }
    return parsed;
  } catch {
    return defaultVal;
  }
};

const set = <T>(key: string, val: T): void => {
  localStorage.setItem(key, JSON.stringify(val));
};

export const DataService = {
  getSettings: (): StoreSettings => get(STORAGE_KEYS.SETTINGS, initialSettings),
  saveSettings: (settings: StoreSettings) => set(STORAGE_KEYS.SETTINGS, settings),

  getProducts: (): Product[] => get(STORAGE_KEYS.PRODUCTS, initialProducts),
  saveProducts: (products: Product[]) => set(STORAGE_KEYS.PRODUCTS, products),

  getPayments: (): PaymentMethod[] => get(STORAGE_KEYS.PAYMENTS, initialPayments),
  savePayments: (methods: PaymentMethod[]) => set(STORAGE_KEYS.PAYMENTS, methods),

  getVouchers: (): Voucher[] => get(STORAGE_KEYS.VOUCHERS, initialVouchers),
  saveVouchers: (vouchers: Voucher[]) => set(STORAGE_KEYS.VOUCHERS, vouchers),

  getOrders: (): Order[] => get(STORAGE_KEYS.ORDERS, []),
  saveOrder: (order: Order) => {
    const orders = get<Order[]>(STORAGE_KEYS.ORDERS, []);
    set(STORAGE_KEYS.ORDERS, [order, ...orders]);
  },
  // Overwrite all orders (for sync)
  saveOrders: (orders: Order[]) => set(STORAGE_KEYS.ORDERS, orders),

  getAffiliates: (): Affiliate[] => get(STORAGE_KEYS.AFFILIATES, initialAffiliates),
  saveAffiliates: (affiliates: Affiliate[]) => set(STORAGE_KEYS.AFFILIATES, affiliates),

  getCustomers: (): Customer[] => get(STORAGE_KEYS.CUSTOMERS, []),
  saveCustomers: (customers: Customer[]) => set(STORAGE_KEYS.CUSTOMERS, customers),
};
