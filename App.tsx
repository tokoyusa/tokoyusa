
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, StoreSettings, CartItem, PaymentMethod, User, Voucher, Affiliate, Order, Customer } from './types';
import { DataService } from './services/dataService';
import AdminSidebar from './components/AdminSidebar';

// --- Constants ---

const SUPABASE_SCHEMA = `-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- !!! RESET TABLES & POLICIES !!! 
do $$ 
begin
  drop policy if exists "Public Access Products" on products;
  drop policy if exists "Public Access Settings" on store_settings;
  drop policy if exists "Public Access Payments" on payment_methods;
  drop policy if exists "Public Access Vouchers" on vouchers;
  drop policy if exists "Public Access Affiliates" on affiliates;
  drop policy if exists "Public Access Orders" on orders;
  drop policy if exists "Public Access Customers" on customers;
exception when undefined_table then 
  -- Do nothing
end $$;

drop table if exists products cascade;
drop table if exists store_settings cascade;
drop table if exists payment_methods cascade;
drop table if exists vouchers cascade;
drop table if exists affiliates cascade;
drop table if exists orders cascade;
drop table if exists customers cascade;

-- Create Products Table
create table products (
  id text primary key,
  name text not null,
  category text,
  description text,
  price numeric not null,
  discount_price numeric,
  image text,
  file_url text,
  is_popular boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Store Settings Table
create table store_settings (
  id text primary key,
  store_name text,
  address text,
  whatsapp text,
  email text,
  description text,
  logo_url text,
  tripay_api_key text,
  tripay_private_key text,
  tripay_merchant_code text,
  admin_username text,
  admin_password text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Payment Methods Table
create table payment_methods (
  id text primary key,
  type text not null,
  name text not null,
  account_number text,
  account_name text,
  description text,
  logo text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Vouchers Table
create table vouchers (
  id text primary key,
  code text not null unique,
  type text not null check (type in ('FIXED', 'PERCENT')),
  value numeric not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Affiliates Table
create table affiliates (
  id text primary key,
  name text not null,
  code text not null unique,
  password text not null,
  commission_rate numeric not null,
  total_earnings numeric default 0,
  bank_details text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Customers Table
create table customers (
  id text primary key,
  name text not null,
  whatsapp text not null unique,
  password text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Orders Table
create table orders (
  id text primary key,
  customer_name text,
  customer_whatsapp text,
  total numeric not null,
  payment_method text,
  status text default 'PENDING',
  items jsonb,
  voucher_code text,
  discount_amount numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table products enable row level security;
alter table store_settings enable row level security;
alter table payment_methods enable row level security;
alter table vouchers enable row level security;
alter table affiliates enable row level security;
alter table orders enable row level security;
alter table customers enable row level security;

-- Create Policies (Open access for simplicity in this demo)
create policy "Public Access Products" on products for all using (true) with check (true);
create policy "Public Access Settings" on store_settings for all using (true) with check (true);
create policy "Public Access Payments" on payment_methods for all using (true) with check (true);
create policy "Public Access Vouchers" on vouchers for all using (true) with check (true);
create policy "Public Access Affiliates" on affiliates for all using (true) with check (true);
create policy "Public Access Orders" on orders for all using (true) with check (true);
create policy "Public Access Customers" on customers for all using (true) with check (true);
`;

// --- Helpers ---
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function isValidUUID(uuid: string) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
}

const ensureUuid = (item: any) => {
    if (!item.id || !isValidUUID(item.id)) {
        return { ...item, id: generateUUID() };
    }
    return item;
};

// --- Context & State ---

const AppContext = React.createContext<{
  settings: StoreSettings;
  updateSettings: (s: StoreSettings) => void;
  products: Product[];
  updateProducts: (p: Product[]) => void;
  vouchers: Voucher[];
  updateVouchers: (v: Voucher[]) => void;
  affiliates: Affiliate[];
  updateAffiliates: (a: Affiliate[]) => void;
  customers: Customer[];
  updateCustomers: (c: Customer[]) => void;
  orders: Order[];
  addOrder: (o: Order) => void;
  cart: CartItem[];
  addToCart: (p: Product) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  user: User | null;
  login: (role: 'ADMIN' | 'CUSTOMER' | 'AFFILIATE', name: string, id?: string, phone?: string) => void;
  logout: () => void;
  paymentMethods: PaymentMethod[];
  updatePayments: (p: PaymentMethod[]) => void;
  referralCode: string | null;
  setReferralCode: (code: string | null) => void;
  supabase: SupabaseClient | null;
  isCloudConnected: boolean;
  debugDataCount: number;
  resetLocalData: () => void;
  fetchError: string | null;
  saveNotification: string | null;
} | null>(null);

const useAppContext = () => {
  const context = React.useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppContext.Provider");
  return context;
};

// --- Components ---

const ProductCard: React.FC<{ product: Product, onAdd: () => void }> = ({ product, onAdd }) => {
  const discount = product.discountPrice ? Math.round(((product.price - product.discountPrice) / product.price) * 100) : 0;
  
  return (
    <div className="bg-dark-800 rounded-xl overflow-hidden shadow-lg border border-dark-700 hover:border-primary/50 transition-all group">
      <div className="relative h-48 overflow-hidden">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        {discount > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            -{discount}%
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="text-xs text-primary mb-1 font-semibold uppercase tracking-wider">{product.category}</div>
        <h3 className="font-bold text-white mb-2 truncate">{product.name}</h3>
        <div className="flex items-end justify-between mb-4">
          <div>
            {product.discountPrice ? (
              <div className="flex flex-col">
                <span className="text-gray-400 line-through text-xs">Rp {product.price.toLocaleString()}</span>
                <span className="text-lg font-bold text-white">Rp {product.discountPrice.toLocaleString()}</span>
              </div>
            ) : (
              <span className="text-lg font-bold text-white">Rp {product.price.toLocaleString()}</span>
            )}
          </div>
        </div>
        <button 
          onClick={onAdd}
          className="w-full bg-primary hover:bg-indigo-600 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <i className="fas fa-shopping-cart"></i> Add to Cart
        </button>
      </div>
    </div>
  );
};

// --- Admin Views ---

const AdminDashboard: React.FC = () => {
  const { products, vouchers, affiliates, customers, isCloudConnected, fetchError } = useAppContext();
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isCloudConnected ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
              {isCloudConnected ? '● Cloud Connected' : '○ Local Mode'}
          </div>
      </div>

      {fetchError && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg mb-6 text-red-400 text-sm">
              <strong>Connection Error:</strong> {fetchError}
              <br/>
              Saran: Masuk ke menu "Database & API" dan jalankan ulang SQL Schema.
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Total Produk</p><h3 className="text-3xl font-bold text-white mt-1">{products.length}</h3></div>
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary"><i className="fas fa-box text-xl"></i></div>
          </div>
        </div>
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
           <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Pelanggan</p><h3 className="text-3xl font-bold text-white mt-1">{customers.length}</h3></div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-500"><i className="fas fa-users text-xl"></i></div>
          </div>
        </div>
         <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Afiliasi</p><h3 className="text-3xl font-bold text-white mt-1">{affiliates.length}</h3></div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500"><i className="fas fa-handshake text-xl"></i></div>
          </div>
        </div>
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
           <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Status Toko</p><h3 className="text-xl font-bold text-green-400 mt-1">Online</h3></div>
             <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-500"><i className="fas fa-wifi text-xl"></i></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminProducts: React.FC = () => {
  const { products, updateProducts } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});

  const availableCategories = useMemo(() => {
    const defaults = ['Software', 'E-book', 'Course', 'Template'];
    const fromProducts = products.map(p => p.category);
    return Array.from(new Set([...defaults, ...fromProducts]));
  }, [products]);

  const handleSave = () => {
    if (!currentProduct.name || !currentProduct.price) return alert("Nama dan Harga wajib diisi");
    let newProducts = [...products];
    if (currentProduct.id) {
      newProducts = newProducts.map(p => p.id === currentProduct.id ? { ...p, ...currentProduct } as Product : p);
    } else {
      newProducts.push({
        id: generateUUID(),
        name: currentProduct.name!,
        price: Number(currentProduct.price),
        description: currentProduct.description || '',
        category: currentProduct.category || 'General',
        image: currentProduct.image || `https://picsum.photos/400/400?random=${Date.now()}`,
        discountPrice: currentProduct.discountPrice ? Number(currentProduct.discountPrice) : undefined,
        fileUrl: currentProduct.fileUrl || '',
      });
    }
    updateProducts(newProducts);
    setIsEditing(false);
    setCurrentProduct({});
  };

  const handleDelete = (id: string) => { if (confirm('Yakin hapus produk ini?')) updateProducts(products.filter(p => p.id !== id)); };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'image' | 'fileUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCurrentProduct(prev => ({ ...prev, [field]: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };
  const isBase64 = (str: string) => str?.startsWith('data:');

  return (
    <div className="p-6 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Manajemen Produk</h2>
        <button onClick={() => { setCurrentProduct({}); setIsEditing(true); }} className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg"><i className="fas fa-plus mr-2"></i> Tambah Produk</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(p => (
          <div key={p.id} className="bg-dark-800 rounded-lg p-4 border border-dark-700 flex flex-col">
            <img src={p.image} alt={p.name} className="w-full h-32 object-cover rounded-md mb-3" />
            <h3 className="font-bold text-white truncate">{p.name}</h3>
            <p className="text-sm text-gray-400 mb-2">{p.category}</p>
            <div className="flex justify-between items-center mt-auto">
              <span className="font-bold text-primary">Rp {p.price.toLocaleString()}</span>
              <div className="space-x-2"><button onClick={() => { setCurrentProduct(p); setIsEditing(true); }} className="text-blue-400 hover:text-blue-300"><i className="fas fa-edit"></i></button><button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300"><i className="fas fa-trash"></i></button></div>
            </div>
          </div>
        ))}
      </div>
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-lg border border-dark-700 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">{currentProduct.id ? 'Edit Produk' : 'Tambah Produk'}</h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 no-scrollbar">
              <div><label className="block text-sm text-gray-400 mb-1">Nama Produk</label><input type="text" value={currentProduct.name || ''} onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">Kategori</label><input type="text" list="categories" value={currentProduct.category || ''} onChange={e => setCurrentProduct({...currentProduct, category: e.target.value})} placeholder="Pilih..." className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /><datalist id="categories">{availableCategories.map(cat => <option key={cat} value={cat} />)}</datalist></div>
                 <div><label className="block text-sm text-gray-400 mb-1">Gambar</label><div className="flex flex-col gap-2"><input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} className="block w-full text-xs text-gray-400 file:bg-primary file:text-white file:border-0 file:rounded-full file:px-3" /><input type="text" value={isBase64(currentProduct.image || '') ? '(Gambar terupload)' : currentProduct.image || ''} onChange={e => setCurrentProduct({...currentProduct, image: e.target.value})} disabled={isBase64(currentProduct.image || '')} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white text-xs" placeholder="URL Gambar" /></div></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="block text-sm text-gray-400 mb-1">Harga Normal</label><input type="number" value={currentProduct.price || ''} onChange={e => setCurrentProduct({...currentProduct, price: Number(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
                 <div><label className="block text-sm text-gray-400 mb-1">Harga Diskon</label><input type="number" value={currentProduct.discountPrice || ''} onChange={e => setCurrentProduct({...currentProduct, discountPrice: Number(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
              </div>
               <div><label className="block text-sm text-gray-400 mb-1">Deskripsi</label><textarea value={currentProduct.description || ''} onChange={e => setCurrentProduct({...currentProduct, description: e.target.value})} rows={3} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
               <div><label className="block text-sm text-gray-400 mb-1">File Produk</label><div className="flex flex-col gap-2"><input type="file" onChange={(e) => handleFileUpload(e, 'fileUrl')} className="block w-full text-xs text-gray-400 file:bg-secondary file:text-white file:border-0 file:rounded-full file:px-3" /><input type="text" value={isBase64(currentProduct.fileUrl || '') ? '(File terupload)' : currentProduct.fileUrl || ''} onChange={e => setCurrentProduct({...currentProduct, fileUrl: e.target.value})} placeholder="Link..." disabled={isBase64(currentProduct.fileUrl || '')} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white text-sm" /></div></div>
            </div>
            <div className="flex justify-end gap-4 mt-6"><button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white">Batal</button><button onClick={handleSave} className="px-6 py-2 rounded-lg bg-primary hover:bg-indigo-600 text-white">Simpan</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminCustomers: React.FC = () => {
  const { customers, updateCustomers } = useAppContext();

  const handleDelete = (id: string) => {
    if (confirm('Yakin ingin menghapus akun pelanggan ini?')) {
      updateCustomers(customers.filter(c => c.id !== id));
    }
  };

  return (
    <div className="p-6 pb-24">
      <h2 className="text-2xl font-bold text-white mb-6">Manajemen Pelanggan</h2>
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-dark-900 text-gray-200 uppercase font-medium"><tr><th className="px-6 py-4">Nama</th><th className="px-6 py-4">WhatsApp</th><th className="px-6 py-4">Bergabung</th><th className="px-6 py-4 text-right">Aksi</th></tr></thead>
            <tbody className="divide-y divide-dark-700">
              {customers.length === 0 ? <tr><td colSpan={4} className="px-6 py-8 text-center">Belum ada pelanggan terdaftar.</td></tr> : customers.map(c => (
                <tr key={c.id} className="hover:bg-dark-700/50">
                  <td className="px-6 py-4 font-bold text-white">{c.name}</td>
                  <td className="px-6 py-4 font-mono">{c.whatsapp}</td>
                  <td className="px-6 py-4">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right"><button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-300"><i className="fas fa-trash"></i> Hapus</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AdminVouchers: React.FC = () => {
  const { vouchers, updateVouchers } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [currentVoucher, setCurrentVoucher] = useState<Partial<Voucher>>({});
  const handleSave = () => {
    if (!currentVoucher.code || !currentVoucher.value) return alert("Wajib diisi");
    let newVouchers = [...vouchers];
    if (currentVoucher.id) newVouchers = newVouchers.map(v => v.id === currentVoucher.id ? { ...v, ...currentVoucher } as Voucher : v);
    else newVouchers.push({ id: generateUUID(), code: currentVoucher.code.toUpperCase(), type: currentVoucher.type || 'FIXED', value: Number(currentVoucher.value), isActive: true });
    updateVouchers(newVouchers); setIsEditing(false); setCurrentVoucher({});
  };
  return (
    <div className="p-6 pb-24">
       <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-white">Voucher</h2><button onClick={() => { setCurrentVoucher({ type: 'FIXED', isActive: true }); setIsEditing(true); }} className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg"><i className="fas fa-plus mr-2"></i> Buat</button></div>
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-dark-900 text-gray-200"><tr><th className="px-6 py-4">Kode</th><th className="px-6 py-4">Tipe</th><th className="px-6 py-4">Nilai</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Aksi</th></tr></thead>
            <tbody className="divide-y divide-dark-700">{vouchers.map(v => (<tr key={v.id} className="hover:bg-dark-700/50"><td className="px-6 py-4 font-bold text-white">{v.code}</td><td className="px-6 py-4">{v.type}</td><td className="px-6 py-4">{v.value}</td><td className="px-6 py-4">{v.isActive ? 'Aktif' : 'Off'}</td><td className="px-6 py-4 text-right"><button onClick={() => { setCurrentVoucher(v); setIsEditing(true); }} className="text-blue-400 mr-2"><i className="fas fa-edit"></i></button><button onClick={() => updateVouchers(vouchers.filter(x => x.id !== v.id))} className="text-red-400"><i className="fas fa-trash"></i></button></td></tr>))}</tbody>
        </table>
      </div>
      {isEditing && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="bg-dark-800 p-6 rounded-xl w-full max-w-md border border-dark-700"><h3 className="text-xl font-bold text-white mb-4">Voucher</h3><div className="space-y-4"><input type="text" placeholder="Kode" value={currentVoucher.code || ''} onChange={e => setCurrentVoucher({...currentVoucher, code: e.target.value.toUpperCase()})} className="w-full bg-dark-900 border border-dark-700 rounded px-4 py-2 text-white" /><select value={currentVoucher.type || 'FIXED'} onChange={e => setCurrentVoucher({...currentVoucher, type: e.target.value as any})} className="w-full bg-dark-900 border border-dark-700 rounded px-4 py-2 text-white"><option value="FIXED">Rp</option><option value="PERCENT">%</option></select><input type="number" placeholder="Nilai" value={currentVoucher.value || ''} onChange={e => setCurrentVoucher({...currentVoucher, value: Number(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 rounded px-4 py-2 text-white" /></div><div className="flex justify-end gap-4 mt-6"><button onClick={() => setIsEditing(false)} className="text-gray-400">Batal</button><button onClick={handleSave} className="bg-primary text-white px-4 py-2 rounded-lg">Simpan</button></div></div></div>)}
    </div>
  );
};

const AdminAffiliates: React.FC = () => {
  const { affiliates, updateAffiliates } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [currentAff, setCurrentAff] = useState<Partial<Affiliate>>({});
  const handleSave = () => {
    if (!currentAff.name || !currentAff.code) return alert("Data wajib diisi");
    let newAffs = [...affiliates];
    if (currentAff.id) newAffs = newAffs.map(a => a.id === currentAff.id ? { ...a, ...currentAff } as Affiliate : a);
    else newAffs.push({ id: generateUUID(), name: currentAff.name!, code: currentAff.code!.toUpperCase(), password: currentAff.password || '123', commissionRate: Number(currentAff.commissionRate || 10), totalEarnings: 0, bankDetails: currentAff.bankDetails || '', isActive: true });
    updateAffiliates(newAffs); setIsEditing(false); setCurrentAff({});
  };
  return (
    <div className="p-6 pb-24">
       <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-white">Afiliasi</h2><button onClick={() => { setCurrentAff({ commissionRate: 10, isActive: true }); setIsEditing(true); }} className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg"><i className="fas fa-user-plus mr-2"></i> Partner</button></div>
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-400"><thead className="bg-dark-900 text-gray-200"><tr><th className="px-6 py-4">Partner</th><th className="px-6 py-4">Kode</th><th className="px-6 py-4">Komisi</th><th className="px-6 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-dark-700">{affiliates.map(a => (<tr key={a.id} className="hover:bg-dark-700/50"><td className="px-6 py-4 font-bold text-white">{a.name}</td><td className="px-6 py-4">{a.code}</td><td className="px-6 py-4">{a.commissionRate}%</td><td className="px-6 py-4 text-right"><button onClick={() => { setCurrentAff(a); setIsEditing(true); }} className="text-blue-400 mr-2"><i className="fas fa-edit"></i></button><button onClick={() => updateAffiliates(affiliates.filter(x => x.id !== a.id))} className="text-red-400"><i className="fas fa-trash"></i></button></td></tr>))}</tbody></table>
      </div>
      {isEditing && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="bg-dark-800 p-6 rounded-xl w-full max-w-md border border-dark-700"><h3 className="text-xl font-bold text-white mb-4">Partner</h3><div className="space-y-4"><input type="text" placeholder="Nama" value={currentAff.name || ''} onChange={e => setCurrentAff({...currentAff, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded px-4 py-2 text-white" /><input type="text" placeholder="Kode" value={currentAff.code || ''} onChange={e => setCurrentAff({...currentAff, code: e.target.value.toUpperCase()})} className="w-full bg-dark-900 border border-dark-700 rounded px-4 py-2 text-white" /><input type="number" placeholder="Komisi %" value={currentAff.commissionRate || ''} onChange={e => setCurrentAff({...currentAff, commissionRate: Number(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 rounded px-4 py-2 text-white" /></div><div className="flex justify-end gap-4 mt-6"><button onClick={() => setIsEditing(false)} className="text-gray-400">Batal</button><button onClick={handleSave} className="bg-primary text-white px-4 py-2 rounded-lg">Simpan</button></div></div></div>)}
    </div>
  );
};

const AdminSettings: React.FC = () => {
  const { settings, updateSettings, paymentMethods, updatePayments } = useAppContext();
  const [formData, setFormData] = useState(settings);
  const [payments, setPayments] = useState(paymentMethods);
  
  useEffect(() => { setFormData(settings); }, [settings]);
  useEffect(() => { setPayments(paymentMethods); }, [paymentMethods]);

  const handleSave = () => { updateSettings(formData); updatePayments(payments); };

  return (
    <div className="p-6 pb-24 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Pengaturan Toko</h2>
      <div className="space-y-8">
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Akun Admin</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-400 mb-1">Username Admin</label><input value={formData.adminUsername || 'admin'} onChange={e => setFormData({...formData, adminUsername: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Password Admin</label><input type="text" value={formData.adminPassword || 'admin'} onChange={e => setFormData({...formData, adminPassword: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
          </div>
        </div>

        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Informasi Umum</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-400 mb-1">Nama Toko</label><input value={formData.storeName} onChange={e => setFormData({...formData, storeName: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
            <div><label className="block text-sm text-gray-400 mb-1">WhatsApp</label><input value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Alamat</label><input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Deskripsi</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
          </div>
        </div>

        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
            <h3 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Pembayaran</h3>
            {payments.map((pm, idx) => (
                <div key={pm.id} className="mb-4 pb-4 border-b border-dark-700 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center mb-2"><span className="font-bold text-primary">{pm.type} - {pm.name}</span><input type="checkbox" checked={pm.isActive !== false} onChange={e => { const newP = [...payments]; newP[idx].isActive = e.target.checked; setPayments(newP); }} className="accent-primary w-4 h-4" /></div>
                    {(pm.type === 'BANK' || pm.type === 'E-WALLET') && (<div className="grid grid-cols-2 gap-2"><input value={pm.accountNumber || ''} onChange={e => { const newP = [...payments]; newP[idx].accountNumber = e.target.value; setPayments(newP); }} placeholder="No. Rekening" className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-xs text-white" /><input value={pm.accountName || ''} onChange={e => { const newP = [...payments]; newP[idx].accountName = e.target.value; setPayments(newP); }} placeholder="Atas Nama" className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-xs text-white" /></div>)}
                </div>
            ))}
        </div>
        <button onClick={handleSave} className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl">Simpan & Auto Sync</button>
      </div>
    </div>
  );
};

const AdminDatabase: React.FC = () => {
  const { settings, updateSettings, products, vouchers, affiliates, customers, paymentMethods, supabase, resetLocalData, updateProducts, updateVouchers, updateAffiliates, updateCustomers, updatePayments } = useAppContext();
  const [formData, setFormData] = useState(settings);
  const [showSql, setShowSql] = useState(!settings.supabaseUrl); 
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!supabase) return alert("Supabase belum terkoneksi!");
    if (!confirm("Overwrite cloud data with local data?")) return;
    setIsSyncing(true);
    try {
        if (products.length > 0) { const fp = products.map(ensureUuid); updateProducts(fp); await supabase.from('products').upsert(fp.map(p => ({ id: p.id, name: p.name, category: p.category, description: p.description, price: p.price, discount_price: p.discountPrice, image: p.image, file_url: p.fileUrl, is_popular: p.isPopular }))); }
        if (vouchers.length > 0) { const fv = vouchers.map(ensureUuid); updateVouchers(fv); await supabase.from('vouchers').upsert(fv.map(v => ({ id: v.id, code: v.code, type: v.type, value: v.value, is_active: v.isActive }))); }
        if (affiliates.length > 0) { const fa = affiliates.map(ensureUuid); updateAffiliates(fa); await supabase.from('affiliates').upsert(fa.map(a => ({ id: a.id, name: a.name, code: a.code, password: a.password, commission_rate: a.commissionRate, total_earnings: a.totalEarnings, bank_details: a.bankDetails, is_active: a.isActive }))); }
        // Sync Customers
        if (customers.length > 0) { const fc = customers.map(ensureUuid); updateCustomers(fc); await supabase.from('customers').upsert(fc.map(c => ({ id: c.id, name: c.name, whatsapp: c.whatsapp, password: c.password, created_at: c.createdAt }))); }

        const dbSettings = { id: 'settings_01', store_name: settings.storeName, address: settings.address, whatsapp: settings.whatsapp, email: settings.email, description: settings.description, logo_url: settings.logoUrl, tripay_api_key: settings.tripayApiKey, tripay_private_key: settings.tripayPrivateKey, tripay_merchant_code: settings.tripayMerchantCode, admin_username: settings.adminUsername, admin_password: settings.adminPassword };
        await supabase.from('store_settings').upsert(dbSettings);
        
        const dbPayments = paymentMethods.map(ensureUuid).map(p => ({ id: p.id, type: p.type, name: p.name, account_number: p.accountNumber, account_name: p.accountName, description: p.description, logo: p.logo, is_active: p.isActive }));
        await supabase.from('payment_methods').upsert(dbPayments);

        alert("Upload Berhasil!");
    } catch (e: any) { alert("Gagal upload: " + (e.message || e)); } finally { setIsSyncing(false); }
  };

  return (
    <div className="p-6 pb-24 max-w-4xl mx-auto">
       <h2 className="text-2xl font-bold text-white mb-6">Database & API</h2>
       <div className="space-y-6">
          <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
            <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2"><i className="fas fa-database"></i> Supabase Integration {supabase && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/30">Connected</span>}</h3>
            <div className="bg-dark-900/50 p-4 rounded-lg border border-dark-700 mb-6"><h4 className="font-bold text-white mb-2">Sync Dashboard</h4><p className="text-gray-400 text-sm mb-4">Auto-Sync is Active. Use buttons below for troubleshooting.</p><div className="flex gap-4"><button onClick={handleSync} disabled={isSyncing || !supabase} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">{isSyncing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-upload-alt"></i>}{isSyncing ? "Uploading..." : "FORCE UPLOAD"}</button><button onClick={() => { if(confirm("Reset browser data?")) resetLocalData(); }} className="px-6 py-3 bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-600/50 rounded-lg"><i className="fas fa-redo"></i> Reset Local</button></div></div>
            <div className="space-y-4 pt-4 border-t border-dark-700"><div><label className="text-sm text-gray-400">Supabase URL</label><input type="password" value={formData.supabaseUrl || ''} onChange={e => setFormData({...formData, supabaseUrl: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div><div><label className="text-sm text-gray-400">Anon Key</label><input type="password" value={formData.supabaseKey || ''} onChange={e => setFormData({...formData, supabaseKey: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div><div className="mt-4"><button onClick={() => setShowSql(!showSql)} className="text-primary text-sm font-bold"> {showSql ? 'Hide SQL' : 'Show SQL Schema'} </button>{showSql && <textarea readOnly value={SUPABASE_SCHEMA} className="w-full h-64 bg-dark-900 border border-dark-700 rounded-lg p-4 mt-2 text-xs font-mono text-gray-300" />}</div></div>
          </div>
          <button onClick={() => { updateSettings(formData); alert('Saved. Please refresh.'); }} className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl">Simpan Konfigurasi</button>
       </div>
    </div>
  );
};

// --- Customer Views ---

const CustomerHistory: React.FC = () => {
    const { user, orders, products } = useAppContext();
    const myOrders = orders.filter(o => o.customerWhatsapp === user?.phone).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (!user) return <Navigate to="/login" />;

    return (
        <div className="max-w-2xl mx-auto p-6 pb-24">
            <h2 className="text-2xl font-bold text-white mb-6">Riwayat Pesanan</h2>
            {myOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-dark-800 rounded-xl border border-dark-700">Belum ada riwayat pesanan.</div>
            ) : (
                <div className="space-y-4">
                    {myOrders.map(order => (
                        <div key={order.id} className="bg-dark-800 p-4 rounded-xl border border-dark-700">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${order.status === 'PAID' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{order.status}</span>
                                    <span className="text-gray-400 text-xs ml-2">{new Date(order.date).toLocaleString()}</span>
                                </div>
                                <span className="font-bold text-white">Rp {order.total.toLocaleString()}</span>
                            </div>
                            <div className="space-y-2 border-t border-dark-700 pt-2 mt-2">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-gray-300">{item.name} x{item.quantity}</span>
                                    </div>
                                ))}
                            </div>
                            {order.voucherCode && <div className="text-xs text-green-400 mt-2">Voucher: {order.voucherCode} (-Rp {order.discountAmount?.toLocaleString()})</div>}
                            <div className="mt-3 text-xs text-gray-500">Metode: {order.paymentMethod}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const CustomerHome: React.FC = () => {
  const { products, settings, addToCart, setReferralCode } = useAppContext();
  const [searchParams] = useSearchParams();
  const [categoryFilter, setCategoryFilter] = useState('All');
  useEffect(() => { const ref = searchParams.get('ref'); if (ref) setReferralCode(ref); }, [searchParams, setReferralCode]);
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filteredProducts = categoryFilter === 'All' ? products : products.filter(p => p.category === categoryFilter);
  return (
    <div className="pb-20">
      <div className="relative bg-dark-800 overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 z-0"></div><div className="max-w-6xl mx-auto px-6 py-16 relative z-10 text-center md:text-left"><h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">Produk Digital Terbaik <br/><span className="text-primary">Untuk Kebutuhanmu</span></h1><p className="text-gray-300 text-lg mb-6 max-w-xl">{settings.description}</p><button onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth'})} className="bg-primary hover:bg-indigo-600 text-white px-8 py-3 rounded-full font-bold">Belanja Sekarang</button></div></div>
      <div className="max-w-6xl mx-auto px-6 py-8 overflow-x-auto no-scrollbar"><div className="flex space-x-4">{categories.map(cat => <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-6 py-2 rounded-full border whitespace-nowrap transition-colors ${categoryFilter === cat ? 'bg-primary border-primary text-white' : 'bg-dark-800 border-dark-700 text-gray-400 hover:bg-dark-700'}`}>{cat}</button>)}</div></div>
      <div id="products" className="max-w-6xl mx-auto px-6 mb-12"><h2 className="text-2xl font-bold text-white mb-6">Produk Terbaru</h2><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{filteredProducts.map(p => <ProductCard key={p.id} product={p} onAdd={() => { addToCart(p); alert("Produk ditambahkan!"); }} />)}</div></div>
    </div>
  );
};

const CustomerCart: React.FC = () => {
  const { cart, removeFromCart, clearCart, settings, paymentMethods, vouchers, referralCode, affiliates, updateAffiliates, user, addOrder } = useAppContext();
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const navigate = useNavigate();

  const subTotal = cart.reduce((sum, item) => sum + ((item.discountPrice || item.price) * item.quantity), 0);
  let discountAmount = 0;
  if (appliedVoucher) discountAmount = appliedVoucher.type === 'PERCENT' ? (subTotal * appliedVoucher.value) / 100 : appliedVoucher.value;
  const total = Math.max(0, subTotal - discountAmount);

  const handleApplyVoucher = () => {
    const found = vouchers.find(v => v.code === voucherCode.toUpperCase() && v.isActive);
    if (found) { setAppliedVoucher(found); alert("Voucher digunakan!"); } else { alert("Voucher tidak valid"); setAppliedVoucher(null); }
  };

  const handleCheckout = () => {
    if (!selectedPayment) return alert('Pilih metode pembayaran');
    if (cart.length === 0) return alert('Keranjang kosong');
    // Require login for history feature
    if (!user || user.role !== 'CUSTOMER') {
        alert("Silakan Login terlebih dahulu agar riwayat pesanan Anda tersimpan.");
        navigate('/login');
        return;
    }

    const paymentMethod = paymentMethods.find(p => p.id === selectedPayment);
    
    // Save Order to DB
    const newOrder: Order = {
        id: generateUUID(),
        customerName: user.name,
        customerWhatsapp: user.phone || '',
        items: [...cart],
        total: total,
        paymentMethod: paymentMethod?.name || 'Unknown',
        status: 'PENDING',
        date: new Date().toISOString(),
        voucherCode: appliedVoucher?.code,
        discountAmount: discountAmount
    };
    addOrder(newOrder);

    // Affiliate Logic
    if (referralCode) {
      const affiliate = affiliates.find(a => a.code === referralCode);
      if (affiliate && affiliate.isActive) {
        const commission = Math.round((subTotal * affiliate.commissionRate) / 100);
        updateAffiliates(affiliates.map(a => a.id === affiliate.id ? { ...a, totalEarnings: a.totalEarnings + commission } : a));
      }
    }
    
    let message = `Halo *${settings.storeName}*, saya ingin memesan:\n\n`;
    cart.forEach((item, idx) => { message += `${idx + 1}. ${item.name} x${item.quantity} - Rp ${(item.discountPrice || item.price).toLocaleString()}\n`; });
    message += `\nSubtotal: Rp ${subTotal.toLocaleString()}`;
    if (appliedVoucher) message += `\nVoucher (${appliedVoucher.code}): -Rp ${discountAmount.toLocaleString()}`;
    message += `\n*Total Akhir: Rp ${total.toLocaleString()}*`;
    message += `\nMetode Pembayaran: ${paymentMethod?.name}`;
    message += `\nNama: ${user.name}`;
    if (referralCode) message += `\nRef: ${referralCode}`;
    message += `\n\nMohon diproses, terima kasih.`;
    
    window.open(`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
    clearCart(); navigate('/history');
  };

  if (cart.length === 0) return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"><i className="fas fa-shopping-cart text-6xl text-dark-700 mb-4"></i><h2 className="text-xl font-bold text-white mb-2">Keranjang Kosong</h2><Link to="/" className="text-primary">Kembali Belanja</Link></div>;
  const selectedPaymentDetails = paymentMethods.find(p => p.id === selectedPayment);

  return (
    <div className="max-w-2xl mx-auto p-6 pb-24">
      <h1 className="text-2xl font-bold text-white mb-6">Checkout</h1>
      <div className="bg-dark-800 rounded-xl overflow-hidden mb-6 border border-dark-700">
        {cart.map(item => (<div key={item.id} className="flex items-center gap-4 p-4 border-b border-dark-700"><img src={item.image} className="w-16 h-16 object-cover rounded" /><div className="flex-1"><h4 className="font-bold text-white text-sm">{item.name}</h4><p className="text-primary text-sm">Rp {(item.discountPrice || item.price).toLocaleString()} x {item.quantity}</p></div><button onClick={() => removeFromCart(item.id)} className="text-red-400 p-2"><i className="fas fa-trash"></i></button></div>))}
        <div className="p-4 bg-dark-900 border-b border-dark-700"><div className="flex gap-2"><input type="text" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="Kode voucher?" className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-white uppercase" /><button onClick={handleApplyVoucher} className="bg-secondary text-white px-4 py-2 rounded-lg text-sm">Pakai</button></div>{appliedVoucher && <div className="mt-2 text-green-400 text-sm">Voucher aktif!</div>}</div>
        <div className="p-4 bg-dark-900 space-y-2"><div className="flex justify-between text-gray-400 text-sm"><span>Subtotal</span><span>Rp {subTotal.toLocaleString()}</span></div>{appliedVoucher && <div className="flex justify-between text-green-400 text-sm"><span>Diskon</span><span>-Rp {discountAmount.toLocaleString()}</span></div>}<div className="flex justify-between border-t border-dark-700 pt-2 mt-2"><span className="text-gray-300">Total</span><span className="text-xl font-bold text-white">Rp {total.toLocaleString()}</span></div></div>
      </div>
      <h2 className="text-lg font-bold text-white mb-3">Pilih Pembayaran</h2>
      <div className="grid gap-3 mb-6">{paymentMethods.map(pm => (<div key={pm.id} onClick={() => setSelectedPayment(pm.id)} className={`cursor-pointer p-4 rounded-xl border flex items-center justify-between ${selectedPayment === pm.id ? 'bg-primary/20 border-primary' : 'bg-dark-800 border-dark-700'}`}><span className="font-medium text-white">{pm.name}</span>{selectedPayment === pm.id && <i className="fas fa-check-circle text-primary"></i>}</div>))}</div>
      <button onClick={handleCheckout} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"><i className="fab fa-whatsapp text-xl"></i> Konfirmasi Pesanan</button>
    </div>
  );
};

const AccountView: React.FC = () => {
  const { user, logout } = useAppContext();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" />;
  const handleLogout = () => { logout(); navigate('/'); };
  return (
    <div className="max-w-md mx-auto p-6 pb-24">
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 text-center">
        <div className="w-24 h-24 bg-primary rounded-full mx-auto flex items-center justify-center mb-4"><i className="fas fa-user text-4xl text-white"></i></div>
        <h2 className="text-2xl font-bold text-white mb-1">{user.name}</h2>
        <p className="text-primary text-sm font-semibold mb-6 uppercase">{user.role}</p>
        <div className="space-y-3">
          {user.role === 'ADMIN' && <Link to="/admin" className="block w-full bg-dark-700 hover:bg-dark-600 text-white py-3 rounded-xl border border-dark-600"><i className="fas fa-cogs mr-2"></i> Ke Panel Admin</Link>}
          {user.role === 'AFFILIATE' && <Link to="/affiliate" className="block w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl border border-blue-500"><i className="fas fa-chart-line mr-2"></i> Dashboard Afiliasi</Link>}
          {user.role === 'CUSTOMER' && <Link to="/history" className="block w-full bg-dark-700 hover:bg-dark-600 text-white py-3 rounded-xl border border-dark-600"><i className="fas fa-history mr-2"></i> Riwayat Pesanan</Link>}
          <button onClick={handleLogout} className="block w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 py-3 rounded-xl border border-red-500/20"><i className="fas fa-sign-out-alt mr-2"></i> Keluar</button>
        </div>
      </div>
    </div>
  );
};

const CustomerLayout: React.FC = () => {
  const { cart, user, isCloudConnected, debugDataCount } = useAppContext();
  const location = useLocation();
  return (
    <div className="min-h-screen bg-dark-900 text-gray-100 font-sans">
      <nav className="sticky top-0 z-40 bg-dark-900/80 backdrop-blur-md border-b border-dark-700">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2"><div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"><i className="fas fa-bolt text-white"></i></div><span className="font-bold text-xl tracking-tight text-white">DigiStore</span></Link>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-6 mr-4"><Link to="/" className="text-gray-300 hover:text-white">Produk</Link></div>
            <Link to="/cart" className="relative p-2 text-gray-300 hover:text-white"><i className="fas fa-shopping-cart text-xl"></i>{cart.length > 0 && <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">{cart.length}</span>}</Link>
            {user ? <Link to="/account" className="hidden md:flex items-center gap-2 text-gray-300 hover:text-white"><i className="fas fa-user-circle text-xl"></i></Link> : <Link to="/login" className="hidden md:block bg-primary px-4 py-2 rounded-lg text-sm font-medium text-white">Login</Link>}
          </div>
        </div>
      </nav>
      <div className="min-h-screen"><Routes><Route path="/" element={<CustomerHome />} /><Route path="/cart" element={<CustomerCart />} /><Route path="/categories" element={<CustomerHome />} /><Route path="/account" element={<AccountView />} /><Route path="/affiliate" element={user?.role === 'AFFILIATE' ? <div className="p-6">Dashboard Affiliate</div> : <Navigate to="/account" />} /><Route path="/history" element={<CustomerHistory />} /></Routes></div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-700 pb-safe z-50">
        <div className="grid grid-cols-4 h-16">
          <Link to="/" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/' ? 'text-primary' : 'text-gray-400'}`}><i className="fas fa-store mb-1"></i><span className="text-[10px] font-medium">Toko</span></Link>
           <Link to="/categories" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/categories' ? 'text-primary' : 'text-gray-400'}`}><i className="fas fa-th-large mb-1"></i><span className="text-[10px] font-medium">Kategori</span></Link>
           <Link to="/history" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/history' ? 'text-primary' : 'text-gray-400'}`}><i className="fas fa-history mb-1"></i><span className="text-[10px] font-medium">Riwayat</span></Link>
          <Link to="/account" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.startsWith('/account') ? 'text-primary' : 'text-gray-400'}`}><i className="fas fa-user mb-1"></i><span className="text-[10px] font-medium">Akun</span></Link>
        </div>
        <div className="text-[10px] text-center pb-2 bg-dark-800 opacity-50 flex justify-center gap-2">{isCloudConnected ? <span className="text-green-500">● Cloud Connected</span> : <span>○ Local Mode</span>}<span className="text-gray-500">| Loaded: {debugDataCount} items</span></div>
      </div>
    </div>
  );
};

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { logout, saveNotification } = useAppContext();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-dark-900 text-gray-100 overflow-hidden">
      <AdminSidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => { logout(); navigate('/login'); }} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center justify-between bg-dark-800 p-4 border-b border-dark-700"><button onClick={() => setSidebarOpen(true)} className="text-gray-300"><i className="fas fa-bars text-xl"></i></button><span className="font-bold text-white">Admin Panel</span><div className="w-6"></div></header>
        <main className="flex-1 overflow-y-auto bg-dark-900 relative">
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'products' && <AdminProducts />}
          {activeTab === 'customers' && <AdminCustomers />}
          {activeTab === 'vouchers' && <AdminVouchers />}
          {activeTab === 'affiliates' && <AdminAffiliates />}
          {activeTab === 'settings' && <AdminSettings />}
          {activeTab === 'database' && <AdminDatabase />}
        </main>
        {saveNotification && (<div className="fixed bottom-6 right-6 z-50 bg-primary text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-bounce"><i className="fas fa-cloud-upload-alt"></i><span className="font-medium">{saveNotification}</span></div>)}
      </div>
    </div>
  );
};

const Login: React.FC = () => {
  const { login, affiliates, settings, customers, updateCustomers } = useAppContext();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Register Flow
    if (isRegister) {
        if (!username || !password || !name) return alert("Semua kolom wajib diisi.");
        if (customers.find(c => c.whatsapp === username)) return alert("Nomor WhatsApp sudah terdaftar.");
        
        const newCustomer: Customer = {
            id: generateUUID(),
            name: name,
            whatsapp: username,
            password: password,
            createdAt: new Date().toISOString()
        };
        updateCustomers([...customers, newCustomer]);
        alert("Pendaftaran berhasil! Silakan login.");
        setIsRegister(false);
        setPassword('');
        return;
    }

    // Login Flow
    // 1. Check Admin (Dynamic from Settings)
    const adminUser = settings.adminUsername || 'admin';
    const adminPass = settings.adminPassword || 'admin';
    if (username === adminUser && password === adminPass) {
      login('ADMIN', 'Admin User');
      navigate('/admin');
      return;
    }

    // 2. Check Affiliates
    const affiliate = affiliates.find(a => a.code === username.toUpperCase() && a.password === password);
    if (affiliate) {
        if (!affiliate.isActive) return alert("Akun affiliate non-aktif.");
        login('AFFILIATE', affiliate.name, affiliate.id);
        navigate('/account');
        return;
    }

    // 3. Check Customers
    const customer = customers.find(c => c.whatsapp === username && c.password === password);
    if (customer) {
        login('CUSTOMER', customer.name, customer.id, customer.whatsapp);
        navigate('/');
        return;
    }

    alert('Login Gagal. Periksa Username/No WA dan Password.');
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="bg-dark-800 p-8 rounded-2xl shadow-2xl border border-dark-700 w-full max-w-md">
        <div className="text-center mb-8"><div className="w-16 h-16 bg-primary rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg"><i className="fas fa-bolt text-3xl text-white"></i></div><h1 className="text-2xl font-bold text-white">{isRegister ? 'Daftar Akun' : 'Masuk'}</h1></div>
        <form onSubmit={handleAuth} className="space-y-6">
          {isRegister && <div><label className="block text-sm text-gray-400 mb-1">Nama Lengkap</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white" /></div>}
          <div><label className="block text-sm text-gray-400 mb-1">{isRegister ? 'Nomor WhatsApp' : 'Username / No. WA'}</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white" /></div>
          <button type="submit" className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg">{isRegister ? 'Daftar Sekarang' : 'Masuk'}</button>
        </form>
        <div className="mt-6 text-center text-sm">
            {isRegister ? (
                <span className="text-gray-500">Sudah punya akun? <button onClick={() => setIsRegister(false)} className="text-primary hover:underline">Login disini</button></span>
            ) : (
                <span className="text-gray-500">Belum punya akun? <button onClick={() => setIsRegister(true)} className="text-primary hover:underline">Daftar disini</button></span>
            )}
        </div>
        <div className="mt-4 text-center"><Link to="/" className="text-gray-500 hover:text-white text-sm">Kembali ke Toko</Link></div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user } = useAppContext();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/*" element={user?.role === 'ADMIN' ? <AdminLayout /> : <Navigate to="/login" />} />
      <Route path="/*" element={<CustomerLayout />} />
    </Routes>
  );
};

export default function App() {
  const [settings, setSettings] = useState<StoreSettings>(DataService.getSettings());
  const [products, setProducts] = useState<Product[]>(DataService.getProducts());
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DataService.getPayments());
  const [vouchers, setVouchers] = useState<Voucher[]>(DataService.getVouchers());
  const [affiliates, setAffiliates] = useState<Affiliate[]>(DataService.getAffiliates());
  const [customers, setCustomers] = useState<Customer[]>(DataService.getCustomers());
  const [orders, setOrders] = useState<Order[]>(DataService.getOrders());
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [debugDataCount, setDebugDataCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  const supabase = useMemo(() => {
    if (settings.supabaseUrl && settings.supabaseKey) {
      try { return createClient(settings.supabaseUrl, settings.supabaseKey); } catch (e) { console.error(e); return null; }
    }
    return null;
  }, [settings.supabaseUrl, settings.supabaseKey]);

  useEffect(() => {
    if (!supabase) { setIsDataLoaded(true); return; }
    const fetchData = async () => {
      setFetchError(null);
      try {
          const { data: prodData } = await supabase.from('products').select('*');
          if (prodData) {
            const mappedProducts = prodData.map((p: any) => ({ id: p.id, name: p.name, category: p.category, description: p.description, price: Number(p.price), discountPrice: p.discount_price ? Number(p.discount_price) : undefined, image: p.image, fileUrl: p.file_url, isPopular: p.is_popular }));
            setProducts(mappedProducts); DataService.saveProducts(mappedProducts);
          }
          const { data: vouchData } = await supabase.from('vouchers').select('*');
          if (vouchData) {
            const mappedVouchers = vouchData.map((v: any) => ({ id: v.id, code: v.code, type: v.type, value: Number(v.value), isActive: v.is_active }));
            setVouchers(mappedVouchers); DataService.saveVouchers(mappedVouchers);
          }
          const { data: affData } = await supabase.from('affiliates').select('*');
          if (affData) {
            const mappedAff = affData.map((a: any) => ({ id: a.id, name: a.name, code: a.code, password: a.password, commissionRate: Number(a.commission_rate), totalEarnings: Number(a.total_earnings), bankDetails: a.bank_details, isActive: a.is_active }));
            setAffiliates(mappedAff); DataService.saveAffiliates(mappedAff);
          }
          const { data: custData } = await supabase.from('customers').select('*');
          if (custData) {
            const mappedCust = custData.map((c: any) => ({ id: c.id, name: c.name, whatsapp: c.whatsapp, password: c.password, createdAt: c.created_at }));
            setCustomers(mappedCust); DataService.saveCustomers(mappedCust);
          }
          const { data: settingsData } = await supabase.from('store_settings').select('*').single();
          if (settingsData) {
             const newSettings: StoreSettings = { ...settings, storeName: settingsData.store_name, address: settingsData.address, whatsapp: settingsData.whatsapp, email: settingsData.email, description: settingsData.description, logoUrl: settingsData.logo_url, tripayApiKey: settingsData.tripay_api_key, tripayPrivateKey: settingsData.tripay_private_key, tripayMerchantCode: settingsData.tripay_merchant_code, adminUsername: settingsData.admin_username, adminPassword: settingsData.admin_password };
             setSettings(newSettings); DataService.saveSettings(newSettings);
          }
          const { data: payData } = await supabase.from('payment_methods').select('*');
          if (payData) {
              const mappedPayments = payData.map((p: any) => ({ id: p.id, type: p.type, name: p.name, accountNumber: p.account_number, accountName: p.account_name, description: p.description, logo: p.logo, is_active: p.is_active }));
              setPaymentMethods(mappedPayments); DataService.savePayments(mappedPayments);
          }
          // Fetch Orders (New)
          const { data: orderData } = await supabase.from('orders').select('*');
          if (orderData) {
             const mappedOrders = orderData.map((o: any) => ({ id: o.id, customerName: o.customer_name, customerWhatsapp: o.customer_whatsapp, total: Number(o.total), paymentMethod: o.payment_method, status: o.status, items: o.items, voucherCode: o.voucher_code, discountAmount: Number(o.discount_amount), date: o.created_at }));
             setOrders(mappedOrders); DataService.saveOrders(mappedOrders);
          }
          
          setIsCloudConnected(true); setDebugDataCount(prodData ? prodData.length : 0);
      } catch (err: any) { console.error(err); setFetchError(err.message); } finally { setIsDataLoaded(true); }
    };
    fetchData();
  }, [supabase]);

  // Auto-Sync Logic
  const shouldSync = isCloudConnected && isDataLoaded && user?.role === 'ADMIN';

  const useAutoSync = (data: any, table: string, mapper: (item: any) => any, saveLocal: (d: any) => void) => {
    useEffect(() => {
        if (!shouldSync || !supabase) return;
        const timer = setTimeout(async () => {
            setSaveNotification(`Saving ${table}...`);
            await supabase.from(table).upsert(data.map(ensureUuid).map(mapper));
            setSaveNotification(`${table} Saved!`); setTimeout(() => setSaveNotification(null), 2000);
            saveLocal(data);
        }, 2000);
        return () => clearTimeout(timer);
    }, [data, shouldSync, supabase]);
  };

  useAutoSync(products, 'products', p => ({ id: p.id, name: p.name, category: p.category, description: p.description, price: p.price, discount_price: p.discountPrice, image: p.image, file_url: p.fileUrl, is_popular: p.isPopular }), DataService.saveProducts);
  useAutoSync(vouchers, 'vouchers', v => ({ id: v.id, code: v.code, type: v.type, value: v.value, is_active: v.isActive }), DataService.saveVouchers);
  useAutoSync(affiliates, 'affiliates', a => ({ id: a.id, name: a.name, code: a.code, password: a.password, commission_rate: a.commissionRate, total_earnings: a.totalEarnings, bank_details: a.bankDetails, is_active: a.isActive }), DataService.saveAffiliates);
  useAutoSync(customers, 'customers', c => ({ id: c.id, name: c.name, whatsapp: c.whatsapp, password: c.password, created_at: c.createdAt }), DataService.saveCustomers);
  useAutoSync(orders, 'orders', o => ({ id: o.id, customer_name: o.customerName, customer_whatsapp: o.customerWhatsapp, total: o.total, payment_method: o.paymentMethod, status: o.status, items: o.items, voucher_code: o.voucherCode, discount_amount: o.discountAmount, created_at: o.date }), DataService.saveOrders);

  // Settings & Payments Special Sync
  useEffect(() => {
    if (!shouldSync || !supabase) return;
    const timer = setTimeout(async () => {
        setSaveNotification("Saving Settings...");
        const dbSettings = { id: 'settings_01', store_name: settings.storeName, address: settings.address, whatsapp: settings.whatsapp, email: settings.email, description: settings.description, logo_url: settings.logoUrl, tripay_api_key: settings.tripayApiKey, tripay_private_key: settings.tripayPrivateKey, tripay_merchant_code: settings.tripayMerchantCode, admin_username: settings.adminUsername, admin_password: settings.adminPassword };
        await supabase.from('store_settings').upsert(dbSettings);
        const dbPayments = paymentMethods.map(ensureUuid).map(p => ({ id: p.id, type: p.type, name: p.name, account_number: p.accountNumber, account_name: p.accountName, description: p.description, logo: p.logo, is_active: p.isActive }));
        await supabase.from('payment_methods').upsert(dbPayments);
        setSaveNotification("Settings Saved!"); setTimeout(() => setSaveNotification(null), 2000);
        DataService.saveSettings(settings); DataService.savePayments(paymentMethods);
    }, 2000);
    return () => clearTimeout(timer);
  }, [settings, paymentMethods, shouldSync, supabase]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      return existing ? prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p) : [...prev, { ...product, quantity: 1 }];
    });
  };

  const addOrder = (order: Order) => {
    const newOrders = [order, ...orders];
    setOrders(newOrders);
    DataService.saveOrder(order); // Local fallback
  };

  const login = (role: 'ADMIN' | 'CUSTOMER' | 'AFFILIATE', name: string, id?: string, phone?: string) => setUser({ role, name, id, phone });
  const resetLocalData = () => { localStorage.clear(); window.location.reload(); };

  return (
    <AppContext.Provider value={{
      settings, updateSettings: setSettings, products, updateProducts: setProducts, vouchers, updateVouchers: setVouchers, affiliates, updateAffiliates: setAffiliates, customers, updateCustomers: setCustomers, orders, addOrder, cart, addToCart, removeFromCart: (id) => setCart(p => p.filter(x => x.id !== id)), clearCart: () => setCart([]), user, login, logout: () => setUser(null), paymentMethods, updatePayments: setPaymentMethods, referralCode, setReferralCode, supabase, isCloudConnected, debugDataCount, resetLocalData, fetchError, saveNotification
    }}>
      <Router>
        <AppContent />
      </Router>
    </AppContext.Provider>
  );
}
