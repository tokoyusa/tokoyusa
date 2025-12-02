
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, StoreSettings, CartItem, PaymentMethod, User, Voucher, Affiliate, Order, Customer } from './types';
import { DataService } from './services/dataService';
import AdminSidebar from './components/AdminSidebar';

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
          <h2 className="text-2xl font-bold text-white">Dashboard <span className="text-xs text-yellow-400 font-mono font-normal ml-2 bg-yellow-900/30 px-2 py-1 rounded border border-yellow-500/30">v6.0 (UI DEBUG)</span></h2>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isCloudConnected ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
              {isCloudConnected ? '● Cloud Connected' : '○ Local Mode'}
          </div>
      </div>

      {fetchError && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg mb-6 text-red-400 text-sm">
              <strong>Connection Error:</strong> {fetchError}
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
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  
  // Initialize internal state from context
  useEffect(() => { setFormData(settings); }, [settings]);
  useEffect(() => { 
      // Safe guard against null/undefined paymentMethods
      if (paymentMethods && Array.isArray(paymentMethods)) {
          setPayments(paymentMethods); 
      }
  }, [paymentMethods]);

  const handleSave = () => { updateSettings(formData); updatePayments(payments); };

  const handleResetPayments = () => {
      if (confirm("Reset metode pembayaran ke default? Data yang ada sekarang akan ditimpa.")) {
          const defaults: PaymentMethod[] = DataService.getPayments(); 
          setPayments(defaults);
          updatePayments(defaults);
      }
  };

  return (
    <div className="p-6 pb-24 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Pengaturan Toko</h2>
      <div className="space-y-8">
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Informasi Umum</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div><label className="text-xs text-gray-400">Nama Toko</label><input type="text" value={formData.storeName} onChange={e => setFormData({...formData, storeName: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2 text-white" /></div>
             <div><label className="text-xs text-gray-400">WhatsApp Admin</label><input type="text" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2 text-white" /></div>
             <div><label className="text-xs text-gray-400">Alamat</label><input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2 text-white" /></div>
             <div><label className="text-xs text-gray-400">Email</label><input type="text" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2 text-white" /></div>
          </div>
          <div className="mt-4"><label className="text-xs text-gray-400">Deskripsi Toko</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2 text-white" rows={2} /></div>
        </div>

        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
           <h3 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Keamanan Admin</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs text-gray-400">Username</label><input type="text" value={formData.adminUsername || ''} onChange={e => setFormData({...formData, adminUsername: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2 text-white" /></div>
              <div><label className="text-xs text-gray-400">Password</label><input type="text" value={formData.adminPassword || ''} onChange={e => setFormData({...formData, adminPassword: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded p-2 text-white" /></div>
           </div>
        </div>

        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
           <div className="flex justify-between items-center mb-4 border-b border-dark-700 pb-2">
               <h3 className="text-lg font-bold text-white">Metode Pembayaran (v6.0)</h3>
               <button onClick={handleResetPayments} className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded hover:bg-red-500/20">Reset Default Payments</button>
           </div>
           
           <div className="space-y-4">
              {payments.map((method, index) => {
                  const safeType = (method.type || 'BANK').toUpperCase();
                  const isTripay = safeType === 'TRIPAY';
                  
                  return (
                    <div key={method.id || index} className="p-4 bg-dark-900 rounded-lg border border-dark-700">
                        <div className="flex justify-between items-center mb-2">
                             <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-xs font-bold rounded ${isTripay ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>{safeType}</span>
                                <input 
                                    type="text" 
                                    value={method.name} 
                                    onChange={(e) => {
                                        const newP = [...payments];
                                        newP[index].name = e.target.value;
                                        setPayments(newP);
                                    }}
                                    className="bg-transparent border-b border-dark-700 text-white font-bold text-sm focus:border-primary outline-none w-48"
                                />
                             </div>
                             <button 
                                onClick={() => {
                                    const newP = [...payments];
                                    newP[index].isActive = !newP[index].isActive;
                                    setPayments(newP);
                                }}
                                className={`text-xs px-2 py-1 rounded ${method.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                             >
                                {method.isActive ? 'AKTIF' : 'NON-AKTIF'}
                             </button>
                        </div>

                        {/* INPUTS FORCED TO RENDER ALWAYS - NO HIDING LOGIC */}
                         <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-gray-900/50 rounded">
                            <div>
                                <label className="text-[10px] text-gray-400 block mb-1">Nomor Rekening / No. HP</label>
                                <input 
                                    type="text" 
                                    value={method.accountNumber || ''} 
                                    onChange={(e) => {
                                        const newP = [...payments];
                                        newP[index].accountNumber = e.target.value;
                                        setPayments(newP);
                                    }}
                                    className="w-full bg-white text-black border border-gray-300 rounded px-2 py-1 text-xs font-semibold"
                                    placeholder="Isi Disini..."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 block mb-1">Atas Nama</label>
                                <input 
                                    type="text" 
                                    value={method.accountName || ''} 
                                    onChange={(e) => {
                                        const newP = [...payments];
                                        newP[index].accountName = e.target.value;
                                        setPayments(newP);
                                    }}
                                    className="w-full bg-white text-black border border-gray-300 rounded px-2 py-1 text-xs font-semibold"
                                    placeholder="Isi Disini..."
                                />
                            </div>
                         </div>
                        
                        <div className="mt-2">
                             <label className="text-[10px] text-gray-500">Deskripsi / Catatan</label>
                             <input 
                                type="text" 
                                value={method.description || ''} 
                                onChange={(e) => {
                                    const newP = [...payments];
                                    newP[index].description = e.target.value;
                                    setPayments(newP);
                                }}
                                className="w-full bg-dark-800 border border-dark-700 rounded px-2 py-1 text-xs text-white"
                                placeholder="Instruksi tambahan..."
                            />
                        </div>
                    </div>
                  );
              })}
           </div>
        </div>

        <button onClick={handleSave} className="w-full bg-primary hover:bg-indigo-600 text-white py-3 rounded-lg font-bold text-lg sticky bottom-6 shadow-xl">
            Simpan Perubahan
        </button>
      </div>
    </div>
  );
};

const AdminDatabase: React.FC = () => {
    const { supabase, resetLocalData } = useAppContext();
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  
    const handleUpload = async () => {
        if (!supabase) return alert("Supabase belum terhubung. Cek Environment Variables.");
        if (!confirm("INI AKAN MENIMPA DATA DI CLOUD DENGAN DATA LOKAL ANDA. Lanjutkan?")) return;
        
        setUploadStatus('uploading');
        try {
            const products = DataService.getProducts().map(ensureUuid);
            const settings = [ensureUuid(DataService.getSettings())];
            const payments = DataService.getPayments().map(p => ({ ...ensureUuid(p), is_active: p.isActive })); // Map isActive
            const vouchers = DataService.getVouchers().map(v => ({ ...ensureUuid(v), is_active: v.isActive }));
            const affiliates = DataService.getAffiliates().map(a => ({ ...ensureUuid(a), is_active: a.isActive }));
            const customers = DataService.getCustomers().map(c => ensureUuid(c));
            
            // Upsert all
            await supabase.from('products').upsert(products);
            await supabase.from('store_settings').upsert(settings);
            await supabase.from('payment_methods').upsert(payments);
            await supabase.from('vouchers').upsert(vouchers);
            await supabase.from('affiliates').upsert(affiliates);
            if (customers.length > 0) await supabase.from('customers').upsert(customers);
            
            setUploadStatus('success');
            alert("Upload Berhasil! Data lokal admin sekarang sudah tersimpan di Supabase.");
        } catch (err: any) {
            console.error(err);
            setUploadStatus('error');
            alert("Gagal Upload: " + err.message);
        }
    };
  
    const SUPABASE_SCHEMA = `-- Enable UUID extension
create extension if not exists "uuid-ossp";

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

create table products (id text primary key, name text, category text, description text, price numeric, discount_price numeric, image text, file_url text, is_popular boolean default false, created_at timestamp with time zone default timezone('utc'::text, now()));
create table store_settings (id text primary key, store_name text, address text, whatsapp text, email text, description text, logo_url text, tripay_api_key text, tripay_private_key text, tripay_merchant_code text, admin_username text, admin_password text, updated_at timestamp with time zone default timezone('utc'::text, now()));
create table payment_methods (id text primary key, type text, name text, account_number text, account_name text, description text, logo text, is_active boolean default true, created_at timestamp with time zone default timezone('utc'::text, now()));
create table vouchers (id text primary key, code text unique, type text, value numeric, is_active boolean default true, created_at timestamp with time zone default timezone('utc'::text, now()));
create table affiliates (id text primary key, name text, code text unique, password text, commission_rate numeric, total_earnings numeric default 0, bank_details text, is_active boolean default true, created_at timestamp with time zone default timezone('utc'::text, now()));
create table customers (id text primary key, name text, whatsapp text unique, password text, created_at timestamp with time zone default timezone('utc'::text, now()));
create table orders (id text primary key, customer_name text, customer_whatsapp text, total numeric, payment_method text, status text default 'PENDING', items jsonb, voucher_code text, discount_amount numeric, created_at timestamp with time zone default timezone('utc'::text, now()));

alter table products enable row level security;
alter table store_settings enable row level security;
alter table payment_methods enable row level security;
alter table vouchers enable row level security;
alter table affiliates enable row level security;
alter table orders enable row level security;
alter table customers enable row level security;

create policy "Public Access Products" on products for all using (true) with check (true);
create policy "Public Access Settings" on store_settings for all using (true) with check (true);
create policy "Public Access Payments" on payment_methods for all using (true) with check (true);
create policy "Public Access Vouchers" on vouchers for all using (true) with check (true);
create policy "Public Access Affiliates" on affiliates for all using (true) with check (true);
create policy "Public Access Orders" on orders for all using (true) with check (true);
create policy "Public Access Customers" on customers for all using (true) with check (true);
`;

    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Database & API</h2>
        
        <div className="space-y-6">
             {/* RESET BUTTON */}
             <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-xl">
                 <h3 className="text-lg font-bold text-red-400 mb-2">Zona Bahaya</h3>
                 <p className="text-sm text-gray-400 mb-4">Jika aplikasi error atau data tidak sinkron, gunakan tombol ini untuk menghapus cache browser dan memuat ulang.</p>
                 <button onClick={resetLocalData} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold">
                     Reset Local & Reload
                 </button>
             </div>

             <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
                <h3 className="text-lg font-bold text-white mb-2">Sync Dashboard</h3>
                <p className="text-gray-400 text-sm mb-4">Status Koneksi: {supabase ? <span className="text-green-400">Connected to Supabase</span> : <span className="text-red-400">Disconnected (Check Env Vars)</span>}</p>
                
                <button 
                    onClick={handleUpload} 
                    disabled={!supabase || uploadStatus === 'uploading'}
                    className={`w-full py-3 rounded-lg font-bold text-white ${uploadStatus === 'uploading' ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-500'}`}
                >
                    {uploadStatus === 'uploading' ? 'Uploading...' : 'UPLOAD LOCAL DATA TO CLOUD'}
                </button>
             </div>

             <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
                <h3 className="text-lg font-bold text-white mb-2">Supabase SQL Setup</h3>
                <p className="text-sm text-gray-400 mb-2">Copy kode ini dan jalankan di Supabase SQL Editor untuk membuat tabel.</p>
                <div className="relative">
                    <pre className="bg-dark-900 p-4 rounded-lg text-xs text-green-400 overflow-x-auto h-64 no-scrollbar">
                        {SUPABASE_SCHEMA}
                    </pre>
                    <button 
                        onClick={() => navigator.clipboard.writeText(SUPABASE_SCHEMA)}
                        className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded"
                    >
                        Copy
                    </button>
                </div>
             </div>
        </div>
      </div>
    );
};

// --- Main Layout ---

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { logout } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Simple active tab logic based on path
  const currentTab = location.pathname.split('/admin/')[1] || 'dashboard';

  return (
    <div className="flex h-screen bg-dark-900 text-gray-100 overflow-hidden font-sans">
      <AdminSidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        activeTab={currentTab}
        setActiveTab={(tab) => navigate(`/admin/${tab}`)}
        onLogout={logout}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-dark-800 border-b border-dark-700 flex items-center justify-between px-4 md:px-6 z-10">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-400 hover:text-white"><i className="fas fa-bars text-xl"></i></button>
          <div className="flex items-center gap-4 ml-auto">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold">A</div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-dark-900 no-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

const CustomerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, cart, user, logout, isCloudConnected, debugDataCount } = useAppContext();
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-dark-900 text-gray-100 font-sans pb-20 md:pb-0">
      <nav className="sticky top-0 z-40 bg-dark-800/80 backdrop-blur-md border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"><i className="fas fa-bolt text-white"></i></div>
              <span className="font-bold text-xl text-white">{settings.storeName}</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
               <Link to="/" className="text-gray-300 hover:text-white transition-colors">Toko</Link>
               {user && <Link to="/history" className="text-gray-300 hover:text-white transition-colors">Riwayat</Link>}
               <Link to="/cart" className="relative text-gray-300 hover:text-white transition-colors">
                  <i className="fas fa-shopping-cart text-lg"></i>
                  {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{cart.length}</span>}
               </Link>
               {user ? (
                   <div className="flex items-center gap-4">
                       <span className="text-sm text-primary">Hi, {user.name}</span>
                       <button onClick={logout} className="text-sm text-red-400 hover:text-red-300">Keluar</button>
                   </div>
               ) : (
                   <Link to="/login" className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Masuk</Link>
               )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-dark-800 border-t border-dark-700 pb-safe z-50">
        <div className="grid grid-cols-4 h-16">
          <Link to="/" className="flex flex-col items-center justify-center text-gray-400 hover:text-primary"><i className="fas fa-store mb-1"></i><span className="text-[10px]">Toko</span></Link>
          <Link to="/" className="flex flex-col items-center justify-center text-gray-400 hover:text-primary"><i className="fas fa-th-large mb-1"></i><span className="text-[10px]">Kategori</span></Link>
          <Link to={user ? "/history" : "/login"} className="flex flex-col items-center justify-center text-gray-400 hover:text-primary"><i className="fas fa-history mb-1"></i><span className="text-[10px]">Riwayat</span></Link>
          <Link to={user ? "/account" : "/login"} className="flex flex-col items-center justify-center text-gray-400 hover:text-primary"><i className="fas fa-user mb-1"></i><span className="text-[10px]">Akun</span></Link>
        </div>
      </div>

       {/* Floating Cart Button Mobile */}
       <Link to="/cart" className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-primary rounded-full shadow-lg shadow-primary/40 flex items-center justify-center text-white z-40">
          <i className="fas fa-shopping-cart text-xl"></i>
          {cart.length > 0 && <span className="absolute top-0 right-0 bg-red-500 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center border-2 border-dark-900">{cart.length}</span>}
       </Link>

       {/* Footer Debug Info */}
       <div className="text-center py-4 text-[10px] text-gray-600 font-mono">
           {isCloudConnected ? `● Cloud Connected | Loaded: ${debugDataCount} items` : '○ Local Mode'}
       </div>
    </div>
  );
};

const CustomerHome: React.FC = () => {
  const { products, addToCart } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = category === 'All' || p.category === category;
    return matchSearch && matchCat;
  });

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  return (
    <div className="pb-20">
       <div className="mb-8 text-center">
           <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">Digital Products for <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Creators</span></h1>
           <p className="text-gray-400 max-w-2xl mx-auto">Temukan aset digital terbaik untuk mempercepat pekerjaan Anda.</p>
       </div>

       <div className="flex flex-col md:flex-row gap-4 mb-8 sticky top-20 z-30 bg-dark-900/90 py-4 backdrop-blur">
          <div className="relative flex-1">
             <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
             <input type="text" placeholder="Cari produk..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-dark-800 border border-dark-700 rounded-full pl-12 pr-4 py-3 text-white focus:border-primary outline-none shadow-sm" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
             {categories.map(cat => (
                 <button key={cat} onClick={() => setCategory(cat)} className={`px-6 py-3 rounded-full text-sm font-medium whitespace-nowrap transition-all ${category === cat ? 'bg-white text-dark-900' : 'bg-dark-800 text-gray-400 hover:bg-dark-700'}`}>
                     {cat}
                 </button>
             ))}
          </div>
       </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map(p => <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />)}
       </div>
       {filtered.length === 0 && <div className="text-center py-20 text-gray-500">Produk tidak ditemukan.</div>}
    </div>
  );
};

const CustomerCart: React.FC = () => {
  const { cart, removeFromCart, clearCart, settings, paymentMethods, referralCode, addOrder, user, vouchers } = useAppContext();
  const [selectedPayment, setSelectedPayment] = useState('');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerWhatsapp, setCustomerWhatsapp] = useState(user?.phone || '');
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
     if (user) {
         setCustomerName(user.name);
         setCustomerWhatsapp(user.phone || '');
     }
  }, [user]);

  const subtotal = cart.reduce((sum, item) => sum + ((item.discountPrice || item.price) * item.quantity), 0);
  
  // Calculate Discount
  let discountAmount = 0;
  if (appliedVoucher) {
      if (appliedVoucher.type === 'FIXED') {
          discountAmount = appliedVoucher.value;
      } else {
          discountAmount = (subtotal * appliedVoucher.value) / 100;
      }
  }
  const total = Math.max(0, subtotal - discountAmount);

  const activePayments = paymentMethods.filter(p => p.isActive);

  const handleApplyVoucher = () => {
      const v = vouchers.find(vc => vc.code === voucherInput.toUpperCase() && vc.isActive);
      if (v) {
          setAppliedVoucher(v);
          alert("Voucher berhasil dipasang!");
      } else {
          alert("Voucher tidak valid atau kadaluarsa.");
          setAppliedVoucher(null);
      }
  };

  const handleCheckout = () => {
    if (!customerName || !customerWhatsapp || !selectedPayment) return alert("Mohon lengkapi data pemesan.");
    
    // Save Order Local/Cloud
    const newOrder: Order = {
        id: generateUUID(),
        items: cart,
        total,
        customerName,
        customerWhatsapp,
        paymentMethod: selectedPayment,
        status: 'PENDING',
        date: new Date().toISOString(),
        voucherCode: appliedVoucher?.code,
        discountAmount
    };
    addOrder(newOrder);

    // Format WhatsApp Message
    const payMethod = paymentMethods.find(p => p.id === selectedPayment);
    let itemsList = cart.map(i => `- ${i.name} (x${i.quantity})`).join('\n');
    let message = `Halo ${settings.storeName}, saya ingin memesan:\n\n${itemsList}\n\n`;
    message += `Subtotal: Rp ${subtotal.toLocaleString()}\n`;
    if (appliedVoucher) message += `Voucher (${appliedVoucher.code}): -Rp ${discountAmount.toLocaleString()}\n`;
    message += `*Total: Rp ${total.toLocaleString()}*\n\n`;
    message += `Nama: ${customerName}\nWA: ${customerWhatsapp}\nPembayaran: ${payMethod?.name}\n`;
    if (referralCode) message += `Ref Code: ${referralCode}`;

    const url = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    clearCart();
  };

  if (cart.length === 0) return <div className="text-center py-20"><i className="fas fa-shopping-cart text-6xl text-dark-700 mb-4"></i><h2 className="text-2xl font-bold text-white mb-2">Keranjang Kosong</h2><Link to="/" className="text-primary hover:underline">Mulai Belanja</Link></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-24">
       <div className="lg:col-span-2 space-y-4">
          <h2 className="text-2xl font-bold text-white mb-4">Keranjang Belanja</h2>
          {cart.map(item => (
            <div key={item.id} className="bg-dark-800 p-4 rounded-xl border border-dark-700 flex gap-4">
              <img src={item.image} className="w-20 h-20 object-cover rounded-lg" alt={item.name} />
              <div className="flex-1">
                <h3 className="font-bold text-white">{item.name}</h3>
                <p className="text-sm text-gray-400">{item.category}</p>
                <div className="mt-2 flex justify-between items-center">
                   <span className="font-bold text-primary">Rp {(item.discountPrice || item.price).toLocaleString()}</span>
                   <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300 text-sm"><i className="fas fa-trash"></i> Hapus</button>
                </div>
              </div>
            </div>
          ))}
       </div>

       <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 h-fit space-y-6">
          <h3 className="text-xl font-bold text-white">Informasi Pesanan</h3>
          <div className="space-y-3">
             <input type="text" placeholder="Nama Lengkap" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-white" />
             <input type="text" placeholder="Nomor WhatsApp (08...)" value={customerWhatsapp} onChange={e => setCustomerWhatsapp(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-white" />
          </div>

          <div>
             <label className="block text-sm text-gray-400 mb-2">Metode Pembayaran</label>
             <div className="grid grid-cols-1 gap-2">
                {activePayments.map(p => (
                   <button key={p.id} onClick={() => setSelectedPayment(p.id)} className={`p-3 rounded-lg border text-left transition-all ${selectedPayment === p.id ? 'bg-primary/20 border-primary text-white' : 'bg-dark-900 border-dark-700 text-gray-400 hover:bg-dark-700'}`}>
                      <span className="block font-bold text-sm">{p.name}</span>
                      <span className="text-xs">{p.type}</span>
                   </button>
                ))}
             </div>
          </div>

          {/* Voucher */}
          <div>
              <label className="block text-sm text-gray-400 mb-2">Kode Voucher</label>
              <div className="flex gap-2">
                  <input type="text" placeholder="Masukan kode..." value={voucherInput} onChange={e => setVoucherInput(e.target.value)} className="flex-1 bg-dark-900 border border-dark-700 rounded p-2 text-white uppercase" />
                  <button onClick={handleApplyVoucher} className="bg-dark-700 text-white px-3 py-2 rounded hover:bg-dark-600">Pakai</button>
              </div>
          </div>

          <div className="border-t border-dark-700 pt-4 space-y-2">
             <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>Rp {subtotal.toLocaleString()}</span></div>
             {appliedVoucher && <div className="flex justify-between text-green-400"><span>Diskon ({appliedVoucher.code})</span><span>-Rp {discountAmount.toLocaleString()}</span></div>}
             <div className="flex justify-between text-white font-bold text-lg pt-2"><span>Total</span><span>Rp {total.toLocaleString()}</span></div>
          </div>

          <button onClick={handleCheckout} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-500/20 transition-all">
             Checkout via WhatsApp <i className="fab fa-whatsapp ml-2"></i>
          </button>
       </div>
    </div>
  );
};

const CustomerHistory: React.FC = () => {
    const { orders, user } = useAppContext();
    // Filter orders by current user phone
    const myOrders = orders.filter(o => o.customerWhatsapp === user?.phone).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="max-w-3xl mx-auto pb-24">
            <h2 className="text-2xl font-bold text-white mb-6">Riwayat Pesanan</h2>
            <div className="space-y-4">
                {myOrders.length === 0 ? <p className="text-gray-500 text-center">Belum ada riwayat pesanan.</p> : myOrders.map(order => (
                    <div key={order.id} className="bg-dark-800 p-4 rounded-xl border border-dark-700">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <span className="text-xs text-gray-500">{new Date(order.date).toLocaleDateString()}</span>
                                <h4 className="font-bold text-white text-lg">Rp {order.total.toLocaleString()}</h4>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{order.status}</span>
                        </div>
                        <div className="border-t border-dark-700 my-2 pt-2">
                            {order.items.map((item, idx) => (
                                <div key={idx} className="text-sm text-gray-300 flex justify-between">
                                    <span>{item.name} x{item.quantity}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CustomerAccount: React.FC = () => {
    const { user, logout } = useAppContext();
    if (!user) return <Navigate to="/login" />;

    return (
        <div className="max-w-md mx-auto p-6 bg-dark-800 rounded-xl border border-dark-700">
            <div className="text-center mb-6">
                <div className="w-20 h-20 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                    {user.name.charAt(0)}
                </div>
                <h2 className="text-xl font-bold text-white">{user.name}</h2>
                <p className="text-gray-400">{user.phone}</p>
                <div className="mt-2 inline-block px-3 py-1 bg-dark-700 rounded text-xs text-gray-300">{user.role}</div>
            </div>
            
            <div className="space-y-3">
                <Link to="/history" className="block w-full text-center bg-dark-700 hover:bg-dark-600 text-white py-2 rounded-lg">Riwayat Pesanan</Link>
                <button onClick={logout} className="w-full bg-red-500/10 text-red-400 hover:bg-red-500/20 py-2 rounded-lg">Keluar</button>
            </div>
        </div>
    );
};

const AuthPage: React.FC = () => {
  const { login, settings, customers, updateCustomers, customers: allCustomers } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'ADMIN'|'CUSTOMER'|'AFFILIATE'>('CUSTOMER');
  
  // Login Form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register Form
  const [regName, setRegName] = useState('');
  const [regWa, setRegWa] = useState('');
  const [regPass, setRegPass] = useState('');

  const navigate = useNavigate();

  const handleLogin = () => {
    if (role === 'ADMIN') {
        // Use credentials from settings (or default)
        const validUser = settings.adminUsername || 'admin';
        const validPass = settings.adminPassword || 'admin';
        if (username === validUser && password === validPass) {
             login('ADMIN', 'Administrator');
             navigate('/admin/dashboard');
        } else {
            alert("Username/Password Admin salah!");
        }
    } else if (role === 'CUSTOMER') {
        const cust = allCustomers.find(c => c.whatsapp === username && c.password === password);
        if (cust) {
            login('CUSTOMER', cust.name, cust.id, cust.whatsapp);
            navigate('/');
        } else {
            alert("Nomor WA atau Password salah. Silakan daftar jika belum punya akun.");
        }
    } else {
        // Affiliate logic (simple)
        const aff = DataService.getAffiliates().find(a => a.code === username && a.password === password);
        if (aff) {
            login('AFFILIATE', aff.name, aff.id);
            navigate('/'); // or affiliate dashboard
        } else {
            alert("Kode/Password afiliasi salah");
        }
    }
  };

  const handleRegister = () => {
      if (!regName || !regWa || !regPass) return alert("Isi semua data!");
      if (allCustomers.find(c => c.whatsapp === regWa)) return alert("Nomor WA sudah terdaftar!");
      
      const newCust: Customer = {
          id: generateUUID(),
          name: regName,
          whatsapp: regWa,
          password: regPass,
          createdAt: new Date().toISOString()
      };
      updateCustomers([...allCustomers, newCust]);
      alert("Pendaftaran berhasil! Silakan login.");
      setIsLogin(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 p-4">
      <div className="bg-dark-800 p-8 rounded-2xl border border-dark-700 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
           <h1 className="text-3xl font-bold text-white mb-2">{settings.storeName}</h1>
           <p className="text-gray-400">{isLogin ? 'Masuk ke akun Anda' : 'Daftar Akun Baru'}</p>
        </div>

        {isLogin ? (
            <>
                <div className="flex bg-dark-900 rounded-lg p-1 mb-6">
                    {(['CUSTOMER', 'AFFILIATE', 'ADMIN'] as const).map(r => (
                        <button key={r} onClick={() => setRole(r)} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${role === r ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                            {r}
                        </button>
                    ))}
                </div>
                <div className="space-y-4">
                    <input type="text" placeholder={role === 'ADMIN' ? 'Username' : (role === 'AFFILIATE' ? 'Kode Afiliasi' : 'Nomor WhatsApp')} value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white focus:border-primary outline-none" />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white focus:border-primary outline-none" />
                    <button onClick={handleLogin} className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-lg transition-all">Masuk</button>
                </div>
                {role === 'CUSTOMER' && (
                    <div className="mt-6 text-center text-sm">
                        <span className="text-gray-400">Belum punya akun? </span>
                        <button onClick={() => setIsLogin(false)} className="text-primary hover:underline font-bold">Daftar Sekarang</button>
                    </div>
                )}
            </>
        ) : (
            <div className="space-y-4">
                <input type="text" placeholder="Nama Lengkap" value={regName} onChange={e => setRegName(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white" />
                <input type="text" placeholder="Nomor WhatsApp" value={regWa} onChange={e => setRegWa(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white" />
                <input type="password" placeholder="Buat Password" value={regPass} onChange={e => setRegPass(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white" />
                <button onClick={handleRegister} className="w-full bg-secondary hover:bg-purple-600 text-white font-bold py-3 rounded-lg transition-all">Daftar</button>
                <div className="mt-4 text-center text-sm">
                    <button onClick={() => setIsLogin(true)} className="text-gray-400 hover:text-white">Kembali ke Login</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

// --- App Container ---

const App: React.FC = () => {
  const [settings, setSettings] = useState<StoreSettings>(DataService.getSettings());
  const [products, setProducts] = useState<Product[]>(DataService.getProducts());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DataService.getPayments());
  const [vouchers, setVouchers] = useState<Voucher[]>(DataService.getVouchers());
  const [affiliates, setAffiliates] = useState<Affiliate[]>(DataService.getAffiliates());
  const [customers, setCustomers] = useState<Customer[]>(DataService.getCustomers());
  const [orders, setOrders] = useState<Order[]>(DataService.getOrders());
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  // Initialize Supabase
  useEffect(() => {
    if (settings.supabaseUrl && settings.supabaseKey) {
        try {
            const client = createClient(settings.supabaseUrl, settings.supabaseKey);
            setSupabase(client);
            setIsCloudConnected(true);
        } catch (e) {
            console.error("Invalid Supabase config", e);
            setIsCloudConnected(false);
        }
    }
  }, [settings.supabaseUrl, settings.supabaseKey]);

  // Fetch Data from Supabase
  const fetchData = async () => {
      if (!supabase) return;
      try {
          const [pRes, sRes, payRes, vRes, aRes, cRes] = await Promise.all([
              supabase.from('products').select('*'),
              supabase.from('store_settings').select('*').limit(1),
              supabase.from('payment_methods').select('*'),
              supabase.from('vouchers').select('*'),
              supabase.from('affiliates').select('*'),
              supabase.from('customers').select('*')
          ]);

          if (pRes.error) throw pRes.error;

          // Mapping logic (Snake Case DB -> Camel Case App)
          if (pRes.data) setProducts(pRes.data);
          
          if (sRes.data && sRes.data.length > 0) {
              const s = sRes.data[0];
              setSettings({
                  ...settings, // Keep local secrets if needed, or overwrite
                  storeName: s.store_name,
                  address: s.address,
                  whatsapp: s.whatsapp,
                  email: s.email,
                  description: s.description,
                  logoUrl: s.logo_url,
                  adminUsername: s.admin_username,
                  adminPassword: s.admin_password
              });
          }

          if (payRes.data) {
              setPaymentMethods(payRes.data.map((p: any) => ({
                  ...p,
                  accountNumber: p.account_number,
                  accountName: p.account_name,
                  isActive: p.is_active // Map snake to camel
              })));
          }

          if (vRes.data) setVouchers(vRes.data.map((v: any) => ({ ...v, isActive: v.is_active })));
          if (aRes.data) setAffiliates(aRes.data.map((a: any) => ({ ...a, commissionRate: a.commission_rate, totalEarnings: a.total_earnings, bankDetails: a.bank_details, isActive: a.is_active })));
          if (cRes.data) setCustomers(cRes.data);

          setIsDataLoaded(true);
          setFetchError(null);
      } catch (err: any) {
          console.error("Fetch error:", err);
          // RLS Policy error detection
          if (err.message?.includes("policy") || err.code === "42501") {
             setFetchError("Database Policies (RLS) not set. Please run the SQL Schema again.");
          } else {
             setFetchError(err.message);
          }
      }
  };

  // Initial Fetch
  useEffect(() => {
      if (supabase && !isDataLoaded) {
          fetchData();
      }
  }, [supabase, isDataLoaded]);

  // Auto-Save Logic (Debounced)
  const isFirstRun = useRef(true);
  useEffect(() => {
      if (isFirstRun.current) { isFirstRun.current = false; return; }
      if (!supabase || !isDataLoaded) return; // Don't overwrite cloud with initial empty state if loading
      if (user?.role !== 'ADMIN') return; // Only admin saves config changes

      const timer = setTimeout(async () => {
          setSaveNotification("Saving to cloud...");
          try {
             const payPayload = paymentMethods.map(p => ({ ...ensureUuid(p), is_active: p.isActive, account_number: p.accountNumber, account_name: p.accountName }));
             const prodPayload = products.map(ensureUuid);
             const vouchPayload = vouchers.map(v => ({ ...ensureUuid(v), is_active: v.isActive }));
             const affPayload = affiliates.map(a => ({ ...ensureUuid(a), is_active: a.isActive, commission_rate: a.commissionRate, total_earnings: a.totalEarnings, bank_details: a.bankDetails }));
             
             // Settings Mapping
             const setPayload = {
                 ...ensureUuid(settings),
                 store_name: settings.storeName,
                 logo_url: settings.logoUrl,
                 admin_username: settings.adminUsername,
                 admin_password: settings.adminPassword,
                 // other snake_case fields handled by spread if keys match, else manual map
             };

             await Promise.all([
                 supabase.from('products').upsert(prodPayload),
                 supabase.from('payment_methods').upsert(payPayload),
                 supabase.from('vouchers').upsert(vouchPayload),
                 supabase.from('affiliates').upsert(affPayload),
                 supabase.from('store_settings').upsert(setPayload),
                 // Customers are saved on registration separately
             ]);
             setSaveNotification("Saved ✔");
             setTimeout(() => setSaveNotification(null), 2000);
          } catch (e) {
              console.error("Auto save failed", e);
              setSaveNotification("Save Failed ❌");
          }
      }, 1000); // 1 sec debounce

      return () => clearTimeout(timer);
  }, [products, paymentMethods, vouchers, affiliates, settings, supabase, isDataLoaded, user]);

  // --- Local Storage Fallback (Sync State to LS) ---
  useEffect(() => { DataService.saveSettings(settings); }, [settings]);
  useEffect(() => { DataService.saveProducts(products); }, [products]);
  useEffect(() => { DataService.savePayments(paymentMethods); }, [paymentMethods]);
  useEffect(() => { DataService.saveVouchers(vouchers); }, [vouchers]);
  useEffect(() => { DataService.saveAffiliates(affiliates); }, [affiliates]);
  useEffect(() => { DataService.saveCustomers(customers); }, [customers]);
  useEffect(() => { DataService.saveOrders(orders); }, [orders]);

  const contextValue = {
    settings, updateSettings: setSettings,
    products, updateProducts: setProducts,
    cart,
    addToCart: (p: Product) => {
        setCart(prev => {
            const exist = prev.find(i => i.id === p.id);
            return exist ? prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...p, quantity: 1 }];
        });
    },
    removeFromCart: (id: string) => setCart(prev => prev.filter(i => i.id !== id)),
    clearCart: () => setCart([]),
    user,
    login: (role: any, name: string, id?: string, phone?: string) => setUser({ role, name, id, phone }),
    logout: () => { setUser(null); setCart([]); },
    paymentMethods, updatePayments: setPaymentMethods,
    vouchers, updateVouchers: setVouchers,
    affiliates, updateAffiliates: setAffiliates,
    customers, updateCustomers: setCustomers,
    orders, addOrder: (o: Order) => setOrders(prev => [o, ...prev]),
    referralCode, setReferralCode,
    supabase, isCloudConnected, debugDataCount: products.length,
    resetLocalData: () => {
        localStorage.clear();
        window.location.reload();
    },
    fetchError, saveNotification
  };

  return (
    <AppContext.Provider value={contextValue}>
      <Router>
        {saveNotification && (
            <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white px-3 py-1 rounded-full text-xs font-mono border border-gray-700">
                {saveNotification}
            </div>
        )}
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={user?.role === 'ADMIN' ? <AdminLayout><AdminDashboard /></AdminLayout> : <Navigate to="/login" />} />
          <Route path="/admin/dashboard" element={user?.role === 'ADMIN' ? <AdminLayout><AdminDashboard /></AdminLayout> : <Navigate to="/login" />} />
          <Route path="/admin/products" element={user?.role === 'ADMIN' ? <AdminLayout><AdminProducts /></AdminLayout> : <Navigate to="/login" />} />
          <Route path="/admin/customers" element={user?.role === 'ADMIN' ? <AdminLayout><AdminCustomers /></AdminLayout> : <Navigate to="/login" />} />
          <Route path="/admin/vouchers" element={user?.role === 'ADMIN' ? <AdminLayout><AdminVouchers /></AdminLayout> : <Navigate to="/login" />} />
          <Route path="/admin/affiliates" element={user?.role === 'ADMIN' ? <AdminLayout><AdminAffiliates /></AdminLayout> : <Navigate to="/login" />} />
          <Route path="/admin/settings" element={user?.role === 'ADMIN' ? <AdminLayout><AdminSettings /></AdminLayout> : <Navigate to="/login" />} />
          <Route path="/admin/database" element={user?.role === 'ADMIN' ? <AdminLayout><AdminDatabase /></AdminLayout> : <Navigate to="/login" />} />

          {/* Customer Routes */}
          <Route path="/" element={<CustomerLayout><CustomerHome /></CustomerLayout>} />
          <Route path="/cart" element={<CustomerLayout><CustomerCart /></CustomerLayout>} />
          <Route path="/history" element={user ? <CustomerLayout><CustomerHistory /></CustomerLayout> : <Navigate to="/login" />} />
          <Route path="/account" element={user ? <CustomerLayout><CustomerAccount /></CustomerLayout> : <Navigate to="/login" />} />
        </Routes>
      </Router>
    </AppContext.Provider>
  );
};

export default App;
