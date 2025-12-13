
import React, { useEffect, useState } from 'react';
import { getSupabase, BANK_MIGRATION_SQL, HISTORY_MIGRATION_SQL } from '../services/supabase';
import { UserProfile, Order, CommissionLog } from '../types';
import { formatRupiah, generateWhatsAppLink, formatProductName } from '../services/helpers';
import { User, Package, Gift, LogOut, Save, Download, Smartphone, CreditCard, DollarSign, Copy, Check, AlertTriangle, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProfilePageProps {
  user: UserProfile;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'affiliate'>('profile');
  const [orders, setOrders] = useState<Order[]>([]);
  const [commissionLogs, setCommissionLogs] = useState<any[]>([]); // Use any to allow joined data
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  
  // Form States
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    phone: user.phone || '',
    bank_name: user.bank_name || '',
    bank_number: user.bank_number || '',
    bank_holder: user.bank_holder || ''
  });
  
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [migrationError, setMigrationError] = useState(false);

  const navigate = useNavigate();
  const supabase = getSupabase();

  // 1. Sync Form Data with User Prop & Fetch Latest Profile
  useEffect(() => {
     const syncProfile = async () => {
        if (!supabase) return;
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
            setFormData({
                full_name: data.full_name || '',
                phone: data.phone || '',
                bank_name: data.bank_name || '',
                bank_number: data.bank_number || '',
                bank_holder: data.bank_holder || ''
            });
        }
     };
     syncProfile();
  }, [user.id]);

  // 2. Fetch Orders or Commission History based on Tab
  useEffect(() => {
    const fetchOrders = async () => {
      if (!supabase) return;
      setLoadingOrders(true);
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (data) {
          // ENRICH DATA: If product_name is missing in JSON, fetch from products table
          const enrichedOrders = await Promise.all(data.map(async (order: any) => {
             if (order.items && Array.isArray(order.items)) {
                const newItems = await Promise.all(order.items.map(async (item: any) => {
                    // Check if name is missing or looks like "1x"
                    if (!item.product_name || item.product_name.trim() === '') {
                        const { data: prod } = await supabase.from('products').select('name').eq('id', item.product_id).single();
                        if (prod) return { ...item, product_name: prod.name };
                    }
                    return item;
                }));
                return { ...order, items: newItems };
             }
             return order;
          }));
          setOrders(enrichedOrders as Order[]);
      }
      setLoadingOrders(false);
    };

    const fetchCommissions = async () => {
      if (!supabase) return;
      setLoadingCommissions(true);
      
      // Fetch commissions AND join with orders to fallback if name is missing
      const { data, error } = await supabase
        .from('commission_history')
        .select('*, orders(items)')
        .eq('affiliate_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) {
         // Process data to fix missing product names
         const processedData = data.map((log: any) => {
            let displayProduct = log.products;
            
            // If log.products is empty or just "(-)", try to get from joined order
            if (!displayProduct || displayProduct === '(-)' || displayProduct.trim() === '') {
                if (log.orders && log.orders.items && Array.isArray(log.orders.items)) {
                    // Extract names from order items
                    const names = log.orders.items.map((i: any) => i.product_name || 'Produk').join(', ');
                    displayProduct = names;
                }
            }
            return { ...log, products: displayProduct };
         });
         
         // Second pass: if still empty, we might need to fetch IDs (edge case, skipping for perf unless needed)
         setCommissionLogs(processedData);

      } else if (error && error.message.includes('relation "public.commission_history" does not exist')) {
         console.warn("Commission history table missing");
      }
      setLoadingCommissions(false);
    };

    if (activeTab === 'orders') {
      fetchOrders();
    } else if (activeTab === 'affiliate' && user.affiliate_code) {
      fetchCommissions();
    }
  }, [activeTab, user.id, user.affiliate_code]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setMigrationError(false);
    
    const { error } = await supabase
      .from('profiles')
      .update(formData)
      .eq('id', user.id);
      
    if (error) {
      if (error.message.includes('Could not find') || error.message.includes('column') || error.message.includes('schema cache')) {
         setMigrationError(true);
      } else {
         alert("Gagal update profil: " + error.message);
      }
    } else {
      alert("Profil berhasil diperbarui!");
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    if (supabase) {
      await (supabase.auth as any).signOut();
      window.location.href = '/';
    }
  };

  const copyAffiliateLink = () => {
    if (!user.affiliate_code) return;
    const link = `${window.location.origin}/#/login?ref=${user.affiliate_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateAffiliateCode = async () => {
      if(!supabase) return;
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await supabase.from('profiles').update({ affiliate_code: code }).eq('id', user.id);
      setActiveTab('affiliate');
      window.location.reload();
  };

  const handleWithdrawal = async () => {
     if (!user.balance || user.balance < 100000) {
         alert("Minimal penarikan adalah Rp 100.000");
         return;
     }
     
     if (!formData.bank_number) {
         alert("Mohon lengkapi data rekening di tab 'Profil' terlebih dahulu.");
         setActiveTab('profile');
         return;
     }

     const { data: settings } = await supabase!
        .from('settings')
        .select('value')
        .eq('key', 'store_settings')
        .single();
        
     const adminWa = settings?.value?.whatsapp_number || '';
     const msg = `Halo Admin, saya ingin menarik saldo affiliate.\n\nNama: ${user.full_name}\nSaldo: ${formatRupiah(user.balance)}\nBank: ${formData.bank_name}\nRek: ${formData.bank_number}\nA.n: ${formData.bank_holder}`;
     
     window.open(generateWhatsAppLink(adminWa, msg), '_blank');
  };

  return (
    <div className="py-6 max-w-4xl mx-auto">
      {/* Header Profile */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 text-2xl font-bold">
            {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="text-center md:text-left flex-1">
            <h1 className="text-2xl font-bold text-white">{user.full_name || 'Pengguna'}</h1>
            <p className="text-slate-400">{user.email}</p>
            {user.role === 'admin' && (
                <span className="inline-block bg-primary/20 text-primary text-xs px-2 py-1 rounded mt-2 font-bold">ADMINISTRATOR</span>
            )}
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 min-w-[150px]">
                    <p className="text-xs text-slate-500 mb-1">Saldo Affiliate</p>
                    <p className="text-xl font-bold text-green-400">{formatRupiah(user.balance || 0)}</p>
                </div>
            </div>
        </div>

        {/* PROMINENT REGISTER AFFILIATE BUTTON */}
        {!user.affiliate_code && (
            <div className="mt-6 pt-6 border-t border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="text-accent" size={18} /> Jadi Affiliate & Dapat Uang
                    </h3>
                    <p className="text-sm text-slate-400">Bagikan link, dapatkan komisi dari setiap penjualan.</p>
                </div>
                <button 
                    onClick={generateAffiliateCode}
                    className="bg-accent hover:bg-yellow-600 text-white font-bold px-6 py-2 rounded-lg flex items-center gap-2 transition-transform transform hover:scale-105 shadow-lg shadow-accent/20"
                >
                    <Gift size={18} /> Daftar Affiliate Sekarang
                </button>
            </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto space-x-2 mb-6 pb-2 no-scrollbar">
        <button 
           onClick={() => setActiveTab('profile')}
           className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'profile' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
           <User size={18} /> Profil & Rekening
        </button>
        <button 
           onClick={() => setActiveTab('orders')}
           className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'orders' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
           <Package size={18} /> Riwayat Pesanan
        </button>
        <button 
           onClick={() => setActiveTab('affiliate')}
           className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'affiliate' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
           <Gift size={18} /> Affiliate Program
        </button>
      </div>

      {/* Content */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 min-h-[400px]">
        
        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
           <form onSubmit={handleUpdateProfile} className="max-w-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><User className="text-primary"/> Data Pribadi</h2>
              
              {migrationError && (
                 <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg mb-6 animate-pulse">
                    <div className="flex items-center gap-2 text-yellow-500 font-bold mb-2">
                       <AlertTriangle size={20} /> Perbaikan Database Diperlukan
                    </div>
                    <p className="text-sm text-yellow-200 mb-2">
                       Supabase belum mendeteksi kolom rekening bank. Silakan copy & jalankan kode di bawah ini di <strong>Supabase SQL Editor</strong> untuk memperbaikinya.
                    </p>
                    <div className="bg-slate-950 p-3 rounded font-mono text-xs text-green-400 relative overflow-x-auto">
                       <pre>{BANK_MIGRATION_SQL}</pre>
                       <button 
                          type="button"
                          onClick={() => {
                             navigator.clipboard.writeText(BANK_MIGRATION_SQL);
                             alert("SQL disalin! Buka Supabase > SQL Editor > Paste > Run.");
                          }}
                          className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded text-[10px]"
                       >
                          Copy SQL
                       </button>
                    </div>
                    <div className="mt-3 border-t border-yellow-500/20 pt-2 flex justify-end">
                       <button 
                          type="button"
                          onClick={() => window.location.reload()}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                       >
                          <RefreshCw size={14} className="animate-spin-slow" /> Sudah Dijalankan? Refresh App
                       </button>
                    </div>
                 </div>
              )}

              <div className="space-y-4 mb-8">
                 <div>
                    <label className="block text-sm text-slate-400 mb-1">Nama Lengkap</label>
                    <input 
                       type="text" 
                       className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                       value={formData.full_name}
                       onChange={e => setFormData({...formData, full_name: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-sm text-slate-400 mb-1">Email (Tidak bisa diubah)</label>
                    <input 
                       type="email" disabled
                       className="w-full bg-slate-900/50 border border-slate-700 rounded p-2 text-slate-500 cursor-not-allowed"
                       value={user.email}
                    />
                 </div>
                 <div>
                    <label className="block text-sm text-slate-400 mb-1">No. WhatsApp</label>
                    <div className="relative">
                       <Smartphone size={16} className="absolute left-3 top-3 text-slate-500" />
                       <input 
                          type="text" 
                          className="w-full bg-slate-900 border border-slate-600 rounded p-2 pl-9 focus:border-primary outline-none"
                          placeholder="0812..."
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                       />
                    </div>
                 </div>
              </div>

              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 pt-4 border-t border-slate-700"><CreditCard className="text-primary"/> Rekening Pencairan</h2>
              <p className="text-sm text-slate-400 mb-4">Data ini digunakan Admin untuk mentransfer komisi affiliate Anda.</p>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-sm text-slate-400 mb-1">Nama Bank / E-Wallet</label>
                    <input 
                       type="text" 
                       className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                       placeholder="Contoh: BCA / DANA"
                       value={formData.bank_name}
                       onChange={e => setFormData({...formData, bank_name: e.target.value})}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Nomor Rekening</label>
                        <input 
                           type="text" 
                           className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                           placeholder="1234567890"
                           value={formData.bank_number}
                           onChange={e => setFormData({...formData, bank_number: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Atas Nama</label>
                        <input 
                           type="text" 
                           className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                           placeholder="Nama Pemilik Rekening"
                           value={formData.bank_holder}
                           onChange={e => setFormData({...formData, bank_holder: e.target.value})}
                        />
                    </div>
                 </div>
              </div>

              <div className="mt-8">
                 <button 
                    type="submit" 
                    disabled={saving}
                    className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold transition-colors disabled:opacity-50"
                 >
                    {saving ? 'Menyimpan...' : <><Save size={18} /> Simpan Perubahan</>}
                 </button>
              </div>
           </form>
        )}

        {/* TAB: ORDERS */}
        {activeTab === 'orders' && (
           <div>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Package className="text-primary"/> Riwayat Pesanan</h2>
              {loadingOrders ? (
                 <div className="text-center py-10 text-slate-500">Memuat pesanan...</div>
              ) : orders.length === 0 ? (
                 <div className="text-center py-10 bg-slate-900/50 rounded-lg">
                    <p className="text-slate-400 mb-2">Belum ada pesanan.</p>
                    <button onClick={() => navigate('/')} className="text-primary hover:underline">Belanja Sekarang</button>
                 </div>
              ) : (
                 <div className="space-y-4">
                    {orders.map(order => (
                       <div key={order.id} className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                          <div className="flex justify-between items-start mb-3 border-b border-slate-800 pb-2">
                             <div>
                                <span className="text-xs text-slate-500 font-mono">#{order.id.slice(0,8)}</span>
                                <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString()}</p>
                             </div>
                             <div className="text-right">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase mb-1 ${
                                   order.status === 'completed' ? 'bg-green-500/10 text-green-500' : 
                                   order.status === 'cancelled' ? 'bg-red-500/10 text-red-500' : 
                                   'bg-yellow-500/10 text-yellow-500'
                                }`}>
                                   {order.status}
                                </span>
                                <p className="font-bold text-white">{formatRupiah(order.total_amount)}</p>
                             </div>
                          </div>
                          
                          <div className="space-y-2">
                             {order.items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                   <div className="flex gap-2">
                                       <span className="text-slate-500">{item.quantity || 1}x</span>
                                       {/* UPDATE: Pakai helper formatProductName */}
                                       <span className="text-white font-semibold">{formatProductName(item.product_name)}</span>
                                   </div>
                                   
                                   {/* DOWNLOAD BUTTON Logic */}
                                   {order.status === 'completed' ? (
                                      item.file_url ? (
                                         <a 
                                            href={item.file_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs bg-primary hover:bg-blue-600 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                         >
                                            <Download size={12} /> Download
                                         </a>
                                      ) : (
                                         <span className="text-xs text-slate-500 italic">No File</span>
                                      )
                                   ) : (
                                      <span className="text-xs text-slate-500">Menunggu</span>
                                   )}
                                </div>
                             ))}
                          </div>
                       </div>
                    ))}
                 </div>
              )}
           </div>
        )}

        {/* TAB: AFFILIATE */}
        {activeTab === 'affiliate' && (
           <div>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Gift className="text-primary"/> Affiliate Dashboard</h2>
              
              {!user.affiliate_code ? (
                 <div className="text-center py-8">
                    <p className="text-slate-400 mb-4">Anda belum memiliki kode affiliate.</p>
                    <button 
                       onClick={generateAffiliateCode}
                       className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
                    >
                       Generate Kode Affiliate
                    </button>
                 </div>
              ) : (
                 <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                       <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                          <p className="text-sm text-slate-400 mb-1">Kode Referral Anda</p>
                          <div className="flex items-center gap-2">
                             <span className="text-2xl font-mono font-bold text-accent">{user.affiliate_code}</span>
                             <button onClick={copyAffiliateLink} className="text-slate-400 hover:text-white" title="Copy Link">
                                {copied ? <Check size={20} className="text-green-500"/> : <Copy size={20}/>}
                             </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">Bagikan kode ini untuk mendapatkan komisi.</p>
                       </div>
                       
                       <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                          <p className="text-sm text-slate-400 mb-1">Saldo Komisi</p>
                          <span className="text-2xl font-bold text-green-400">{formatRupiah(user.balance || 0)}</span>
                          <button 
                             onClick={handleWithdrawal}
                             disabled={!user.balance || user.balance < 100000}
                             className="mt-3 w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2 rounded flex items-center justify-center gap-2 text-sm font-bold transition-colors"
                          >
                             <DollarSign size={16} /> Tarik Saldo (Min. 100rb)
                          </button>
                       </div>
                    </div>
                    
                    {/* RIWAYAT PENDAPATAN SECTION (NEW) */}
                    <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <DollarSign size={16} className="text-green-400" /> Riwayat Pendapatan
                            </h3>
                            {commissionLogs.length === 0 && (
                                <span className="text-xs text-slate-500">Belum ada data</span>
                            )}
                        </div>
                        
                        {loadingCommissions ? (
                            <div className="p-6 text-center text-sm text-slate-500">Loading history...</div>
                        ) : commissionLogs.length > 0 ? (
                            <div className="max-h-[300px] overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-950 text-slate-500 text-xs uppercase sticky top-0">
                                        <tr>
                                            <th className="p-3">Tanggal</th>
                                            <th className="p-3">Produk</th>
                                            <th className="p-3">Dari</th>
                                            <th className="p-3 text-right">Komisi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {commissionLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-800/50">
                                                <td className="p-3 text-slate-400 whitespace-nowrap">
                                                    {new Date(log.created_at).toLocaleDateString('id-ID')}
                                                </td>
                                                <td className="p-3 text-white font-medium max-w-[150px] truncate" title={log.products}>
                                                    {/* UPDATE: Pakai helper formatProductName */}
                                                    {formatProductName(log.products)}
                                                </td>
                                                <td className="p-3 text-slate-400">
                                                    {log.source_buyer}
                                                </td>
                                                <td className="p-3 text-right text-green-400 font-bold">
                                                    +{formatRupiah(log.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                             <div className="p-6 text-center">
                                 <p className="text-sm text-slate-500">
                                     Belum ada riwayat komisi yang tercatat. Bagikan link referral Anda untuk mulai mendapatkan penghasilan!
                                 </p>
                                 <div className="mt-4 flex flex-col gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-200 text-left">
                                     <strong className="flex items-center gap-1"><AlertCircle size={12}/> Note:</strong> 
                                     Jika Anda baru saja mendapatkan komisi tapi tidak muncul di sini, kemungkinan Admin belum mengupdate database untuk fitur "Riwayat". Riwayat baru akan muncul untuk transaksi kedepannya.
                                 </div>
                             </div>
                        )}
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg text-sm text-blue-200">
                       <strong>Cara Kerja:</strong>
                       <ul className="list-disc ml-5 mt-2 space-y-1">
                          <li>Bagikan link referral ke teman Anda.</li>
                          <li>Jika teman mendaftar menggunakan kode Anda dan berbelanja, Anda dapat komisi.</li>
                          <li>Saldo bisa ditarik ke rekening bank yang terdaftar di profil.</li>
                       </ul>
                    </div>
                 </div>
              )}
           </div>
        )}

      </div>
      
      {/* Logout Button (Mobile Friendly) */}
      <button 
        onClick={handleLogout}
        className="w-full mt-8 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
         <LogOut size={20} /> Logout dari Aplikasi
      </button>

    </div>
  );
};

export default ProfilePage;
