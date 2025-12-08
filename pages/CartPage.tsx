
import React, { useState } from 'react';
import { CartItem, UserProfile, StoreSettings, Voucher } from '../types';
import { formatRupiah, generateWhatsAppLink } from '../services/helpers';
import { Trash2, CreditCard, Wallet, QrCode, CheckCircle, Smartphone, Ticket, Loader2, X, UserPlus, Lock, Mail, User, ExternalLink } from 'lucide-react';
import { getSupabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

interface CartPageProps {
  cart: CartItem[];
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  user: UserProfile | null;
  settings: StoreSettings;
}

type PaymentMethod = 'TRANSFER' | 'EWALLET' | 'QRIS' | 'TRIPAY';

const CartPage: React.FC<CartPageProps> = ({ cart, removeFromCart, clearCart, user, settings }) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('TRANSFER');
  const [selectedProvider, setSelectedProvider] = useState<string>(''); // For specific bank/wallet selection
  const [processing, setProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [lastOrderTotal, setLastOrderTotal] = useState(0); 
  const [lastOrderItems, setLastOrderItems] = useState<CartItem[]>([]); // To remember items for WA message
  
  // Voucher States
  const [voucherCode, setVoucherCode] = useState('');
  const [checkingVoucher, setCheckingVoucher] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState('');

  // Guest / Auto-Register State
  const [guestData, setGuestData] = useState({
    fullName: '',
    email: '',
    password: ''
  });

  const navigate = useNavigate();
  const supabase = getSupabase();

  // Basic total from items (Ensure numbers)
  const subtotal = cart.reduce((acc, item) => {
      const price = item.discount_price ? Number(item.discount_price) : Number(item.price);
      return acc + (price * item.quantity);
  }, 0);

  // Calculate discount
  let discountAmount = 0;
  if (appliedVoucher) {
     const val = Number(appliedVoucher.discount_value);
     if (appliedVoucher.discount_type === 'percentage') {
        discountAmount = Math.floor(subtotal * (val / 100));
     } else {
        discountAmount = val;
     }
  }
  
  // Prevent negative total
  if (discountAmount > subtotal) discountAmount = subtotal;

  const finalTotal = subtotal - discountAmount;

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    setCheckingVoucher(true);
    setVoucherError('');
    setAppliedVoucher(null);

    if (!supabase) { setCheckingVoucher(false); return; }

    try {
      // Fetch voucher strictly
      const codeToSearch = voucherCode.trim().toUpperCase();
      
      const { data, error } = await supabase
         .from('vouchers')
         .select('*')
         .eq('code', codeToSearch)
         .eq('is_active', true)
         .single();
      
      if (error || !data) {
         setVoucherError('Voucher tidak valid atau sudah tidak aktif.');
      } else {
         setAppliedVoucher(data as Voucher);
      }
    } catch (err) {
       setVoucherError('Gagal mengecek voucher.');
    } finally {
       setCheckingVoucher(false);
    }
  };

  const removeVoucher = () => {
     setAppliedVoucher(null);
     setVoucherCode('');
     setVoucherError('');
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!supabase) return;

    // Validation for specific provider
    if (selectedMethod === 'TRANSFER' && settings.bank_accounts.length > 0 && !selectedProvider) {
        alert("Silakan pilih Bank tujuan transfer.");
        return;
    }
    if (selectedMethod === 'EWALLET' && settings.e_wallets.length > 0 && !selectedProvider) {
        alert("Silakan pilih E-Wallet tujuan.");
        return;
    }

    setProcessing(true);
    let userId = user?.id;
    let userReferral = user?.referred_by;

    // CHECK LOCAL STORAGE FOR REFERRAL (If user doesn't have one)
    if (!userReferral) {
        const localRef = localStorage.getItem('digitalstore_referral');
        if (localRef) {
             // Prevent self-referral
             if (!user?.affiliate_code || user.affiliate_code !== localRef) {
                 userReferral = localRef;
             }
        }
    }

    try {
        // 1. AUTO-REGISTER logic if user is not logged in
        if (!userId) {
            if (!guestData.email || !guestData.password || !guestData.fullName) {
                alert("Mohon lengkapi data pendaftaran.");
                setProcessing(false);
                return;
            }

            // Sign Up
            const { data: authData, error: authError } = await (supabase.auth as any).signUp({
                email: guestData.email,
                password: guestData.password,
                options: { data: { full_name: guestData.fullName } }
            });

            if (authError) throw authError;

            if (authData.user) {
                userId = authData.user.id;
                
                // Create Profile for new user
                const profilePayload: any = {
                    id: userId,
                    email: guestData.email,
                    full_name: guestData.fullName,
                    role: 'user'
                };
                
                // Save referral code to profile if exists
                if (userReferral) {
                    profilePayload.referred_by = userReferral;
                }

                const { error: profileError } = await supabase.from('profiles').insert(profilePayload);
                
                if (profileError) {
                   // Ignore duplicate key error (if user recreated profile quickly)
                   if (!profileError.message.includes('duplicate')) throw profileError;
                }

                // Auto Login
                await (supabase.auth as any).signInWithPassword({
                    email: guestData.email,
                    password: guestData.password
                });
            } else {
                throw new Error("Gagal membuat akun.");
            }
        } else if (userReferral && !user?.referred_by) {
             // If existing user doesn't have referral but clicked a link, update their profile
             await supabase.from('profiles').update({ referred_by: userReferral }).eq('id', userId);
        }

        // Construct detailed payment method string for database
        let detailedMethod = selectedMethod;
        if (selectedProvider) {
            detailedMethod = `${selectedMethod} - ${selectedProvider}`;
        }

        // 2. Create Order
        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            user_id: userId,
            subtotal: subtotal,
            discount_amount: discountAmount,
            voucher_code: appliedVoucher ? appliedVoucher.code : null,
            total_amount: finalTotal,
            status: 'pending',
            payment_method: detailedMethod,
            items: cart,
            commission_paid: false
          })
          .select()
          .single();

        if (error || !order) throw error;
        
        setLastOrderTotal(finalTotal);
        setLastOrderItems([...cart]); // Store items for WA message
        setOrderSuccess(order.id);
        clearCart();
        
        // Clear local storage referral if used
        localStorage.removeItem('digitalstore_referral');
        
    } catch (err: any) {
        console.error(err);
        alert("Terjadi kesalahan: " + err.message);
    } finally {
        setProcessing(false);
    }
  };

  const handleConfirmWA = () => {
    if (!orderSuccess) return;
    
    // Construct Product List String
    const productList = lastOrderItems.map(item => `- ${item.name} (x${item.quantity})`).join('\n');
    
    // Construct Method String
    let methodString = selectedMethod;
    if (selectedProvider) {
        methodString = `${selectedMethod} - ${selectedProvider}`;
    }

    const msg = `Halo Admin, saya sudah melakukan pesanan.\n\nID Pesanan: ${orderSuccess.slice(0, 8)}\n\nProduk:\n${productList}\n\nTotal: ${formatRupiah(lastOrderTotal)}\nMetode Pembayaran: ${methodString}\n\nMohon segera diproses.`;
    
    window.open(generateWhatsAppLink(settings.whatsapp_number, msg), '_blank');
  };

  if (orderSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="text-green-500 w-20 h-20 mb-6" />
        <h2 className="text-3xl font-bold text-white mb-2">Pesanan Berhasil!</h2>
        <p className="text-slate-400 mb-6">ID Pesanan: #{orderSuccess.slice(0, 8)}</p>
        
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-md w-full mb-6 text-left">
           <h3 className="font-bold text-lg mb-4 border-b border-slate-700 pb-2">Instruksi Pembayaran</h3>
           <div className="mb-4 text-center">
              <span className="text-slate-400">Total yang harus dibayar:</span>
              <p className="text-2xl font-bold text-white">{formatRupiah(lastOrderTotal)}</p>
           </div>
           
           {selectedMethod === 'TRANSFER' && settings.bank_accounts.length > 0 && (
             <div className="space-y-4">
                <p className="text-sm text-slate-400">Silakan transfer ke rekening berikut:</p>
                {/* Show only selected bank if available, else show all */}
                {settings.bank_accounts.filter(b => !selectedProvider || b.bank === selectedProvider).map((acc, idx) => (
                  <div key={idx} className="bg-slate-900 p-3 rounded border border-primary/30">
                    <p className="font-bold text-primary">{acc.bank}</p>
                    <p className="text-lg font-mono">{acc.number}</p>
                    <p className="text-sm text-slate-500">a.n {acc.name}</p>
                  </div>
                ))}
             </div>
           )}

           {selectedMethod === 'EWALLET' && (
             <div className="space-y-4">
                <p className="text-sm text-slate-400">Silakan transfer saldo ke:</p>
                {settings.e_wallets?.filter(w => !selectedProvider || w.provider === selectedProvider).map((wallet, idx) => (
                    <div key={idx} className="bg-slate-900 p-3 rounded border border-primary/30">
                        <p className="font-bold text-primary">{wallet.provider}</p>
                        <p className="text-lg font-mono">{wallet.number}</p>
                        <p className="text-sm text-slate-500">a.n {wallet.name}</p>
                    </div>
                ))}
             </div>
           )}

           {selectedMethod === 'QRIS' && (
             <div className="space-y-4 flex flex-col items-center w-full">
                <p className="text-sm text-slate-400">Scan QRIS untuk membayar:</p>
                {settings.qris_url ? (
                  <div className="flex flex-col items-center w-full">
                      <div className="bg-white p-4 rounded-xl inline-block w-full max-w-[300px] shadow-lg flex items-center justify-center min-h-[250px]">
                        <img 
                            src={settings.qris_url} 
                            alt="QRIS Code" 
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const parent = (e.target as HTMLElement).parentElement;
                                if(parent) {
                                    parent.innerHTML = '<div class="text-red-500 text-sm text-center font-medium">Gambar tidak dapat dimuat.<br/>Silakan upload ulang di Admin.</div>';
                                }
                            }}
                        />
                      </div>
                      <a href={settings.qris_url} target="_blank" className="mt-4 text-xs text-primary hover:underline flex items-center gap-1">
                          <ExternalLink size={12}/> Buka Gambar Full Size
                      </a>
                  </div>
                ) : (
                  <div className="bg-slate-900 p-8 rounded-xl border border-slate-700 text-center text-slate-500 w-full max-w-[300px]">
                    <QrCode size={48} className="mx-auto mb-2 opacity-50"/>
                    <p className="text-xs">QRIS belum diatur oleh Admin.</p>
                  </div>
                )}
             </div>
           )}
           
           <div className="mt-6 pt-4 border-t border-slate-700">
             <button onClick={handleConfirmWA} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded flex items-center justify-center gap-2">
                <Smartphone size={18} /> Konfirmasi WhatsApp
             </button>
           </div>
        </div>
        
        <button onClick={() => { window.location.href = '#/profile'; window.location.reload(); }} className="text-primary hover:underline">
           Lihat Akun Baru Saya
        </button>
      </div>
    );
  }

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold mb-6">Keranjang Belanja</h1>
      
      {cart.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-slate-400 mb-4">Keranjang Anda kosong</p>
          <button onClick={() => navigate('/')} className="text-primary hover:underline">Mulai Belanja</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {/* Items List */}
          <div className="md:col-span-2 space-y-4">
            {cart.map(item => (
              <div key={item.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex gap-4 items-center">
                 <img src={item.image_url || 'https://via.placeholder.com/100'} alt={item.name} className="w-16 h-16 rounded object-cover" />
                 <div className="flex-1">
                   <h3 className="font-bold text-slate-200">{item.name}</h3>
                   <p className="text-primary font-medium">{formatRupiah(item.discount_price || item.price)}</p>
                 </div>
                 <button onClick={() => removeFromCart(item.id)} className="text-red-500 p-2 hover:bg-slate-700 rounded-full">
                   <Trash2 size={20} />
                 </button>
              </div>
            ))}
          </div>

          {/* Checkout Form */}
          <div className="md:col-span-1">
             <form onSubmit={handleCheckout} className="bg-slate-800 p-6 rounded-xl border border-slate-700 sticky top-24">
                <h3 className="text-xl font-bold mb-4">Ringkasan</h3>
                
                {/* Voucher Input */}
                <div className="mb-6 border-b border-slate-700 pb-6">
                   <label className="text-sm text-slate-400 mb-1 flex items-center gap-1"><Ticket size={14}/> Kode Voucher</label>
                   {appliedVoucher ? (
                     <div className="flex justify-between items-center bg-green-500/10 border border-green-500/20 p-2 rounded text-green-400 text-sm">
                        <span>{appliedVoucher.code}</span>
                        <button type="button" onClick={removeVoucher}><X size={16} /></button>
                     </div>
                   ) : (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Masukkan kode..." 
                          className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-sm uppercase outline-none"
                          value={voucherCode}
                          onChange={e => setVoucherCode(e.target.value)}
                        />
                        <button type="button" onClick={handleApplyVoucher} disabled={checkingVoucher} className="bg-slate-700 px-3 py-2 rounded text-sm">
                           {checkingVoucher ? <Loader2 size={16} className="animate-spin" /> : 'Cek'}
                        </button>
                      </div>
                   )}
                   {voucherError && <p className="text-red-500 text-xs mt-1">{voucherError}</p>}
                </div>

                {/* Total Calculation */}
                <div className="space-y-2 mb-4 text-slate-300">
                   <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
                   {appliedVoucher && (
                     <div className="flex justify-between text-green-400"><span>Diskon</span><span>- {formatRupiah(discountAmount)}</span></div>
                   )}
                </div>
                <div className="flex justify-between mb-6 text-xl font-bold text-white border-t border-slate-700 pt-2">
                  <span>Total Bayar</span><span>{formatRupiah(finalTotal)}</span>
                </div>

                {/* AUTO REGISTER FORM IF NOT LOGGED IN */}
                {!user && (
                    <div className="bg-slate-900 p-4 rounded-lg mb-6 border border-slate-700">
                        <div className="flex items-center gap-2 mb-3 text-primary font-bold text-sm">
                            <UserPlus size={16} /> Daftar Member Otomatis
                        </div>
                        <div className="space-y-3">
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input 
                                    required 
                                    type="text" 
                                    placeholder="Nama Lengkap" 
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 pl-9 text-sm focus:border-primary outline-none"
                                    value={guestData.fullName}
                                    onChange={e => setGuestData({...guestData, fullName: e.target.value})}
                                />
                            </div>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input 
                                    required 
                                    type="email" 
                                    placeholder="Email Aktif" 
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 pl-9 text-sm focus:border-primary outline-none"
                                    value={guestData.email}
                                    onChange={e => setGuestData({...guestData, email: e.target.value})}
                                />
                            </div>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input 
                                    required 
                                    type="password" 
                                    placeholder="Buat Password" 
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 pl-9 text-sm focus:border-primary outline-none"
                                    value={guestData.password}
                                    onChange={e => setGuestData({...guestData, password: e.target.value})}
                                />
                            </div>
                            <div className="text-xs text-slate-500 mt-2 text-center">
                                Sudah punya akun? <span className="text-primary cursor-pointer hover:underline" onClick={() => navigate('/login')}>Login di sini</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Methods */}
                <div className="space-y-3 mb-6">
                    <p className="text-sm font-medium text-slate-400">Metode Pembayaran</p>
                    
                    {/* TRANSFER */}
                    <button type="button" onClick={() => { setSelectedMethod('TRANSFER'); setSelectedProvider(''); }} className={`w-full flex items-center p-3 rounded-lg border ${selectedMethod === 'TRANSFER' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-600'}`}><CreditCard size={18} className="mr-3" /> Transfer Bank</button>
                    
                    {/* Provider Dropdown for Transfer */}
                    {selectedMethod === 'TRANSFER' && settings.bank_accounts.length > 0 && (
                        <select 
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm mt-2 outline-none focus:border-primary"
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                        >
                            <option value="">-- Pilih Bank --</option>
                            {settings.bank_accounts.map((acc, idx) => (
                                <option key={idx} value={acc.bank}>{acc.bank} - {acc.number}</option>
                            ))}
                        </select>
                    )}

                    {/* E-WALLET */}
                    <button type="button" onClick={() => { setSelectedMethod('EWALLET'); setSelectedProvider(''); }} className={`w-full flex items-center p-3 rounded-lg border ${selectedMethod === 'EWALLET' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-600'}`}><Wallet size={18} className="mr-3" /> E-Wallet</button>
                    
                    {/* Provider Dropdown for E-Wallet */}
                    {selectedMethod === 'EWALLET' && settings.e_wallets?.length > 0 && (
                         <select 
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm mt-2 outline-none focus:border-primary"
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                        >
                            <option value="">-- Pilih E-Wallet --</option>
                            {settings.e_wallets.map((wallet, idx) => (
                                <option key={idx} value={wallet.provider}>{wallet.provider} - {wallet.number}</option>
                            ))}
                        </select>
                    )}

                    {/* QRIS */}
                    <button type="button" onClick={() => { setSelectedMethod('QRIS'); setSelectedProvider('QRIS'); }} className={`w-full flex items-center p-3 rounded-lg border ${selectedMethod === 'QRIS' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-600'}`}><QrCode size={18} className="mr-3" /> QRIS</button>
                </div>

                <button 
                  type="submit" 
                  disabled={processing}
                  className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {processing ? 'Memproses...' : user ? 'Bayar Sekarang' : 'Daftar & Bayar'}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
