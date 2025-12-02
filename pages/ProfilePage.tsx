
import React, { useEffect, useState } from 'react';
import { UserProfile, Order } from '../types';
import { getSupabase } from '../services/supabase';
import { formatRupiah, generateAffiliateCode, generateWhatsAppLink } from '../services/helpers';
import { User, Copy, ShoppingBag, CreditCard, Gift, Save, LogOut } from 'lucide-react';

interface ProfilePageProps {
  user: UserProfile;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'orders' | 'affiliate'>('info');
  const [affiliateCode, setAffiliateCode] = useState(user.affiliate_code || '');
  
  // Profile Form State
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    phone: user.phone || '',
    bank_name: user.bank_name || '',
    bank_number: user.bank_number || '',
    bank_holder: user.bank_holder || ''
  });
  const [saving, setSaving] = useState(false);

  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase) return;

    const fetchOrders = async () => {
      const { data } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (data) setOrders(data);
    };

    fetchOrders();
  }, [user.id]);

  const activateAffiliate = async () => {
    if (!supabase) return;
    const code = generateAffiliateCode();
    const { error } = await supabase.from('profiles').update({ affiliate_code: code }).eq('id', user.id);
    if (!error) setAffiliateCode(code);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    
    const { error } = await supabase.from('profiles').update(formData).eq('id', user.id);
    
    if (error) {
      alert("Gagal mengupdate profil: " + error.message);
    } else {
      alert("Profil berhasil disimpan!");
    }
    setSaving(false);
  };

  const handleWithdraw = async () => {
    const minWithdraw = 100000;
    const balance = user.balance || 0;

    if (balance < minWithdraw) {
      alert(`Minimal penarikan saldo adalah ${formatRupiah(minWithdraw)}`);
      return;
    }

    if (!user.bank_name || !user.bank_number || !user.bank_holder) {
      alert("Mohon lengkapi data rekening bank di menu 'Informasi Akun' terlebih dahulu.");
      setActiveTab('info');
      return;
    }

    // Since we don't have a 'withdrawals' table in this simple version, 
    // we use WhatsApp to request withdrawal to Admin manually.
    const message = `Halo Admin, saya ingin melakukan penarikan saldo Affiliate.\n\n` +
      `Nama: ${user.full_name}\n` +
      `Email: ${user.email}\n` +
      `Jumlah: ${formatRupiah(balance)}\n\n` +
      `Rekening Tujuan:\n` +
      `Bank: ${user.bank_name}\n` +
      `No. Rek: ${user.bank_number}\n` +
      `A.n: ${user.bank_holder}`;

    // Fetch store settings to get WA number
    const { data: settings } = await supabase!.from('settings').select('value').eq('key', 'store_settings').single();
    if (settings && settings.value.whatsapp_number) {
       window.open(generateWhatsAppLink(settings.value.whatsapp_number, message), '_blank');
    } else {
       alert("Nomor WhatsApp Admin belum dikonfigurasi.");
    }
  };

  // Check role manually from DB for troubleshooting UI
  const checkAdminStatus = async () => {
     if(!supabase) return;
     const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
     if (count === 1) {
        await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id);
        alert("Status diperbarui. Silakan refresh halaman.");
        window.location.reload();
     } else {
        alert("Anda bukan user tunggal di database, tidak bisa auto-claim admin.");
     }
  };

  return (
    <div className="py-8 max-w-4xl mx-auto">
      <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 flex flex-col md:flex-row gap-6 items-center md:items-start mb-8">
        <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center text-4xl font-bold text-slate-400">
           {user.full_name ? user.full_name[0].toUpperCase() : <User />}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl font-bold text-white">{user.full_name || 'Pengguna'}</h1>
          <p className="text-slate-400">{user.email}</p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-2">
            <span className="inline-block px-3 py-1 bg-primary/20 text-primary text-xs rounded-full uppercase font-bold">{user.role}</span>
            {user.role === 'user' && (
               <button onClick={checkAdminStatus} className="text-[10px] text-slate-500 hover:text-white underline">
                 Cek Status Admin
               </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 mb-6 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('info')} className={`px-6 py-3 font-medium whitespace-nowrap ${activeTab === 'info' ? 'text-primary border-b-2 border-primary' : 'text-slate-400'}`}>Informasi Akun</button>
        <button onClick={() => setActiveTab('orders')} className={`px-6 py-3 font-medium whitespace-nowrap ${activeTab === 'orders' ? 'text-primary border-b-2 border-primary' : 'text-slate-400'}`}>Riwayat Pesanan</button>
        <button onClick={() => setActiveTab('affiliate')} className={`px-6 py-3 font-medium whitespace-nowrap ${activeTab === 'affiliate' ? 'text-primary border-b-2 border-primary' : 'text-slate-400'}`}>Affiliate Program</button>
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        {activeTab === 'info' && (
           <form onSubmit={handleUpdateProfile} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-4 text-white">Data Pribadi</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Nama Lengkap</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                      value={formData.full_name}
                      onChange={e => setFormData({...formData, full_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Nomor WhatsApp / HP</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      placeholder="08..."
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-6">
                <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
                  <CreditCard size={20} className="text-primary" /> Data Rekening (Untuk Pencairan Affiliate)
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Nama Bank / E-Wallet</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                      value={formData.bank_name}
                      onChange={e => setFormData({...formData, bank_name: e.target.value})}
                      placeholder="BCA / DANA"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Nomor Rekening</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                      value={formData.bank_number}
                      onChange={e => setFormData({...formData, bank_number: e.target.value})}
                      placeholder="123xxxx"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Atas Nama</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                      value={formData.bank_holder}
                      onChange={e => setFormData({...formData, bank_holder: e.target.value})}
                      placeholder="Nama Pemilik"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 text-right">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="bg-primary hover:bg-blue-600 text-white font-bold px-6 py-2 rounded-lg flex items-center gap-2 ml-auto"
                >
                  <Save size={18} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
           </form>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Belum ada pesanan.</p>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                       <span className="font-mono text-xs bg-slate-900 px-2 py-1 rounded text-slate-400">#{order.id.slice(0,8)}</span>
                       <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                         order.status === 'completed' ? 'bg-green-500/20 text-green-500' : 
                         order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'
                       }`}>{order.status}</span>
                    </div>
                    <p className="font-bold text-white">{formatRupiah(order.total_amount)}</p>
                    <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  {order.status === 'completed' && (
                    <button 
                       className="px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm hover:bg-primary/30"
                       onClick={() => alert("Menuju link download produk... (Mock)")}
                    >
                      Download Produk
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'affiliate' && (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            {!affiliateCode ? (
              <div className="text-center py-8">
                <Gift className="w-16 h-16 text-accent mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Jadilah Affiliate Partner!</h3>
                <p className="text-slate-400 mb-6">Dapatkan komisi untuk setiap penjualan yang menggunakan kode referral Anda.</p>
                <button onClick={activateAffiliate} className="bg-accent hover:bg-yellow-600 text-slate-900 font-bold px-6 py-2 rounded-full transition-colors">
                  Aktifkan Affiliate
                </button>
              </div>
            ) : (
              <div>
                <h3 className="font-bold text-lg mb-6">Dashboard Affiliate</h3>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Kode Referral Anda</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-mono font-bold text-accent tracking-widest">{affiliateCode}</span>
                      <button onClick={() => navigator.clipboard.writeText(affiliateCode)} className="p-2 hover:bg-slate-800 rounded text-slate-300"><Copy size={16}/></button>
                    </div>
                  </div>
                  <div className="text-center md:text-right">
                    <p className="text-sm text-slate-400 mb-1">Total Saldo Komisi</p>
                    <p className="text-3xl font-bold text-green-400">{formatRupiah(user.balance || 0)}</p>
                  </div>
                </div>
                
                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600 mb-6">
                  <h4 className="font-bold text-sm mb-2 text-slate-300">Rekening Pencairan</h4>
                  {user.bank_name && user.bank_number ? (
                     <div className="flex items-center gap-3">
                        <CreditCard className="text-primary" size={20} />
                        <div>
                           <p className="text-white font-medium">{user.bank_name} - {user.bank_number}</p>
                           <p className="text-xs text-slate-400">a.n {user.bank_holder}</p>
                        </div>
                        <button onClick={() => setActiveTab('info')} className="ml-auto text-xs text-primary underline">Ubah</button>
                     </div>
                  ) : (
                     <div className="flex items-center justify-between">
                        <p className="text-sm text-yellow-500">Rekening belum diatur.</p>
                        <button onClick={() => setActiveTab('info')} className="text-xs bg-slate-700 px-3 py-1 rounded">Atur Sekarang</button>
                     </div>
                  )}
                </div>

                <div className="flex justify-end">
                   <button 
                     onClick={handleWithdraw}
                     className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     disabled={(user.balance || 0) < 100000}
                   >
                     <DollarSign size={20} /> Tarik Saldo (Min Rp 100.000)
                   </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Simple Icon component for the button
const DollarSign = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
);

export default ProfilePage;
