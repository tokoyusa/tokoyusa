
import React, { useState } from 'react';
import { CartItem, UserProfile, StoreSettings, Voucher } from '../types';
import { formatRupiah, generateWhatsAppLink } from '../services/helpers';
import { Trash2, CreditCard, Wallet, QrCode, CheckCircle, Smartphone, Ticket, Loader2, X, UserPlus, Lock, Mail, User, ExternalLink, ShoppingBag, Download } from 'lucide-react';
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
  
  // State to remember order details for WhatsApp
  const [lastOrderTotal, setLastOrderTotal] = useState(0); 
  const [lastOrderItems, setLastOrderItems] = useState<CartItem[]>([]); 
  const [lastOrderMethod, setLastOrderMethod] = useState(''); 
  
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

    // Validation for specific provider (Only if Price > 0)
    if (finalTotal > 0) {
        if (selectedMethod === 'TRANSFER' && settings.bank_accounts.length > 0 && !selectedProvider) {
            alert("Silakan pilih Bank tujuan transfer.");
            return;
        }
        if (selectedMethod === 'EWALLET' && settings.e_wallets.length > 0 && !selectedProvider) {
            alert("Silakan pilih E-Wallet tujuan.");
            return;
        }
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

        // Logic for FREE ORDER (Price 0)
        const isFreeOrder = finalTotal <= 0;
        
        // Construct detailed payment method string for database
        let detailedMethod: string = selectedMethod;
        if (isFreeOrder) {
            detailedMethod = 'GRATIS / FREE';
        } else if (selectedProvider) {
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
            status: isFreeOrder ? 'completed' : 'pending', // Auto-complete if free
            payment_method: detailedMethod,
            items: cart,
            commission_paid: false
          })
          .select()
          .single();

        if (error || !order) throw error;
        
        // Save State for Success Screen BEFORE clearing cart
        setLastOrderTotal(finalTotal);
        setLastOrderItems([...cart]); 
        setLastOrderMethod(detailedMethod);
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
    
    // Construct Product List String with numbering
    const productList = lastOrderItems.map((item, index) => `${index + 1}. ${item.name} (${item.quantity}x)`).join('\n');
    
    // Construct Message
    const msg = `Halo Admin, saya ada pesanan baru di Website.\n\n*ID Pesanan:* #${orderSuccess.slice(0, 8)}\n\n*Detail Produk:* \n${productList}\n\n*Total Bayar:* ${formatRupiah(lastOrderTotal)}\n*Metode Pembayaran:* ${lastOrderMethod}\n\nMohon dicek dan diproses. Terima kasih.`;
    
    window.open(generateWhatsAppLink(settings.whatsapp_number, msg), '_blank');
  };

  if (orderSuccess) {
    const isFree = lastOrderTotal <= 0;

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <CheckCircle className="text-green-500 w-20 h-20 mb-6 animate-in zoom-in" />
        <h2 className="text-3xl font-bold text-white mb-2">{isFree ? 'Produk Berhasil Diklaim!' : 'Pesanan Berhasil!'}</h2>
        <p className="text-slate-400 mb-6">ID Pesanan: #{orderSuccess.slice(0, 8)}</p>
        
        {isFree ? (
           // UI FOR FREE ORDER
           <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-md w-full mb-6 shadow-lg">
               <p className="text-lg text-white mb-4">Karena total belanja Rp 0, pesanan Anda telah otomatis diselesaikan.</p>
               <button 
                  onClick={() => { window.location.href = '#/profile'; window.location.reload(); }} 
                  className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-blue-500/20"
                >
                  <Download size={20} /> Lihat & Download Produk
               </button>
           </div>
        ) : (
           // UI FOR PAID ORDER
           <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-md w-full mb-6 text-left shadow-lg">
               <h3 className="font-bold text-lg mb-4 border-b border-slate-700 pb-2">Instruksi Pembayaran</h3>
               <div className="mb-4 text-center">
                  <span className="text-slate-400">Total yang harus dibayar:</span>
                  <p className="text-3xl font-bold text-white text-primary mt-1">{formatRupiah(lastOrderTotal)}</p>
               </div>
               
               {/* Detailed Payment Instructions */}
               {selectedMethod === 'TRANSFER' && settings.bank_accounts.length > 0 && (
                 <div className="space-y-4">
                    <p className="text-sm text-slate-400 font-medium bg-slate-900/50 p-2 rounded">Silakan transfer ke rekening berikut:</p>
                    {settings.bank_accounts.filter(b => !selectedProvider || b.bank === selectedProvider).map((acc, idx) => (
                      <div key={idx} className="bg-slate-900 p-4 rounded border border-primary/30 relative">
                        <p className="font-bold text-primary text-lg">{acc.bank}</p>
                        <div className="flex items-center justify-between mt-1">
                            <p className="text-xl font-mono tracking-wide">{acc.number}</p>
                            <button onClick={() => {navigator.clipboard.writeText(acc.number); alert('Disalin!')}} className="text-xs bg-slate-800 p-1 rounded hover:text-white text-slate-400">Salin</button>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">a.n {acc.name}</p>
                      </div>
                    ))}
                 </div>
               )}

               {selectedMethod === 'EWALLET' && (
                 <div className="space-y-4">
                    <p className="text-sm text-slate-400 font-medium bg-slate-900/50 p-2 rounded">Silakan transfer saldo ke:</p>
                    {settings.e_wallets?.filter(w => !selectedProvider || w.provider === selectedProvider).map((wallet, idx) => (
                        <div key={idx} className="bg-slate-900 p-4 rounded border border-primary/30 relative">
                            <p className="font-bold text-primary text-lg">{wallet.provider}</p>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xl font-mono tracking-wide">{wallet.number}</p>
                                <button onClick={() => {navigator.clipboard.writeText(wallet.number); alert('Disalin!')}} className="text-xs bg-slate-800 p-1 rounded hover:text-white text-slate-400">Salin</button>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">a.n {wallet.name}</p>
                        </div>
                    ))}
                 </div>
               )}

               {selectedMethod === 'QRIS' && (
                 <div className="space-y-4 flex flex-col items-center w-full">
                    <p className="text-sm text-slate-400 font-medium w-full text-center bg-slate-900/50 p-2 rounded">Scan QRIS untuk membayar:</p>
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
               
               <div className="mt-8 pt-6 border-t border-slate-700">
                 <button onClick={handleConfirmWA} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 transition-all hover:scale-[1.02]">
                    <Smartphone size={20} /> Konfirmasi Pembayaran ke WA
                 </button>
                 <p className="text-xs text-center text-slate-500 mt-3">
                    Wajib kirim bukti transfer agar pesanan diproses.
                 </p>
               </div>
               
               <button onClick={() => { window.location.href = '#/profile'; window.location.reload(); }} className="w-full mt-4 text-primary hover:underline font-medium text-center">
                   Lihat Akun & Pesanan Saya
               </button>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><CreditCard className="text-primary"/> Keranjang Belanja</h1>
      
      {cart.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
          <ShoppingBag size={48} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 mb-4 text-lg">Keranjang Anda masih kosong</p>
          <button onClick={() => navigate('/')} className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-full font-bold transition-colors">Mulai Belanja</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {/* Items List */}
          <div className="md:col-span-2 space-y-4">
            {cart.map(item => (
              <div key={item.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex gap-4 items-center shadow-sm">
                 <img src={item.image_url || 'https://via.placeholder.com/100'} alt={item.name} className="w-20 h-20 rounded-lg object-cover bg-slate-700" />
                 <div className="flex-1">
                   <h3 className="font-bold text-slate-200 text-lg">{item.name}</h3>
                   <span className="text-xs text-slate-500 uppercase">{item.category}</span>
                   <p className="text-primary font-bold mt-1">{formatRupiah(item.discount_price || item.price)}</p>
                 </div>
                 <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-slate-700 rounded-full transition-colors">
                   <Trash2 size={20} />
                 </button>
              </div>
            ))}
          </div>

          {/* Checkout Form */}
          <div className="md:col-span-1">
             <form onSubmit={handleCheckout} className="bg-slate-800 p-6 rounded-xl border border-slate-700 sticky top-24 shadow-xl">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Wallet size={20}/> Ringkasan</h3>
                
                {/* Voucher Input */}
                <div className="mb-6 border-b border-slate-700 pb-6">
                   <label className="text-sm text-slate-400 mb-2 flex items-center gap-1 font-medium"><Ticket size={14}/> Kode Voucher</label>
                   {appliedVoucher ? (
                     <div className="flex justify-between items-center bg-green-500/10 border border-green-500/20 p-3 rounded-lg text-green-400 text-sm">
                        <span className="font-mono font-bold">{appliedVoucher.code}</span>
                        <button type="button" onClick={removeVoucher} className="hover:text-white"><X size={16} /></button>
                     </div>
                   ) : (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Masukkan kode..." 
                          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm uppercase outline-none focus:border-primary transition-colors"
                          value={voucherCode}
                          onChange={e => setVoucherCode(e.target.value)}
                        />
                        <button type="button" onClick={handleApplyVoucher} disabled={checkingVoucher} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                           {checkingVoucher ? <Loader2 size={16} className="animate-spin" /> : 'Cek'}
                        </button>
                      </div>
                   )}
                   {voucherError && <p className="text-red-500 text-xs mt-2 flex items-center gap-1"><X size={12}/> {voucherError}</p>}
                </div>

                {/* Total Calculation */}
                <div className="space-y-2 mb-4 text-slate-300 text-sm">
                   <div className="flex justify-between"><span>Subtotal ({cart.length} item)</span><span>{formatRupiah(subtotal)}</span></div>
                   {appliedVoucher && (
                     <div className="flex justify-between text-green-400"><span>Diskon Voucher</span><span>- {formatRupiah(discountAmount)}</span></div>
                   )}
                </div>
                <div className="flex justify-between mb-6 text-xl font-bold text-white border-t border-slate-700 pt-4">
                  <span>Total Bayar</span><span className="text-primary">{formatRupiah(finalTotal)}</span>
                </div>

                {/* AUTO REGISTER FORM IF NOT LOGGED IN */}
                {!user && (
                    <div className="bg-slate-900 p-4 rounded-xl mb-6 border border-slate-700 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                        <div className="flex items-center gap-2 mb-4 text-white font-bold text-sm">
                            <UserPlus size={18} className="text-primary" /> Data Pemesan (Auto-Daftar)
                        </div>
                        <div className="space-y-3">
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input 
                                    required 
                                    type="text" 
                                    placeholder="Nama Lengkap" 
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 pl-10 text-sm focus:border-primary outline-none focus:bg-slate-800 transition-colors"
                                    value={guestData.fullName}
                                    onChange={e => setGuestData({...guestData, fullName: e.target.value})}
                                />
                            </div>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input 
                                    required 
                                    type="email" 
                                    placeholder="Email Aktif (Untuk login)" 
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 pl-10 text-sm focus:border-primary outline-none focus:bg-slate-800 transition-colors"
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
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 pl-10 text-sm focus:border-primary outline-none focus:bg-slate-800 transition-colors"
                                    value={guestData.password}
                                    onChange={e => setGuestData({...guestData, password: e.target.value})}
                                />
                            </div>
                            <div className="text-xs text-slate-500 mt-2 text-center">
                                Sudah punya akun? <span className="text-primary cursor-pointer hover:underline font-bold" onClick={() => navigate('/login')}>Login di sini</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Methods (Only Show if Total > 0) */}
                {finalTotal > 0 && (
                  <div className="space-y-3 mb-6">
                      <p className="text-sm font-bold text-white mb-2">Pilih Metode Pembayaran</p>
                      
                      {/* TRANSFER */}
                      <div className={`rounded-lg border transition-all duration-200 overflow-hidden ${selectedMethod === 'TRANSFER' ? 'border-primary bg-slate-900' : 'border-slate-600 bg-slate-800'}`}>
                          <button type="button" onClick={() => { setSelectedMethod('TRANSFER'); setSelectedProvider(''); }} className="w-full flex items-center p-3 text-left">
                              <CreditCard size={18} className={`mr-3 ${selectedMethod === 'TRANSFER' ? 'text-primary' : 'text-slate-400'}`} /> 
                              <span className={selectedMethod === 'TRANSFER' ? 'text-primary font-bold' : 'text-slate-300'}>Transfer Bank</span>
                          </button>
                          
                          {/* Provider Dropdown for Transfer */}
                          {selectedMethod === 'TRANSFER' && settings.bank_accounts.length > 0 && (
                              <div className="px-3 pb-3 animate-in slide-in-from-top-2">
                                  <select 
                                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-primary text-slate-200"
                                      value={selectedProvider}
                                      onChange={(e) => setSelectedProvider(e.target.value)}
                                  >
                                      <option value="">-- Pilih Bank --</option>
                                      {settings.bank_accounts.map((acc, idx) => (
                                          <option key={idx} value={acc.bank}>{acc.bank} - {acc.number}</option>
                                      ))}
                                  </select>
                              </div>
                          )}
                      </div>

                      {/* E-WALLET */}
                      <div className={`rounded-lg border transition-all duration-200 overflow-hidden ${selectedMethod === 'EWALLET' ? 'border-primary bg-slate-900' : 'border-slate-600 bg-slate-800'}`}>
                          <button type="button" onClick={() => { setSelectedMethod('EWALLET'); setSelectedProvider(''); }} className="w-full flex items-center p-3 text-left">
                              <Wallet size={18} className={`mr-3 ${selectedMethod === 'EWALLET' ? 'text-primary' : 'text-slate-400'}`} /> 
                              <span className={selectedMethod === 'EWALLET' ? 'text-primary font-bold' : 'text-slate-300'}>E-Wallet</span>
                          </button>
                          
                          {/* Provider Dropdown for E-Wallet */}
                          {selectedMethod === 'EWALLET' && settings.e_wallets?.length > 0 && (
                              <div className="px-3 pb-3 animate-in slide-in-from-top-2">
                                  <select 
                                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-primary text-slate-200"
                                      value={selectedProvider}
                                      onChange={(e) => setSelectedProvider(e.target.value)}
                                  >
                                      <option value="">-- Pilih E-Wallet --</option>
                                      {settings.e_wallets.map((wallet, idx) => (
                                          <option key={idx} value={wallet.provider}>{wallet.provider} - {wallet.number}</option>
                                      ))}
                                  </select>
                              </div>
                          )}
                      </div>

                      {/* QRIS */}
                      <div className={`rounded-lg border transition-all duration-200 overflow-hidden ${selectedMethod === 'QRIS' ? 'border-primary bg-slate-900' : 'border-slate-600 bg-slate-800'}`}>
                          <button type="button" onClick={() => { setSelectedMethod('QRIS'); setSelectedProvider('QRIS'); }} className="w-full flex items-center p-3 text-left">
                              <QrCode size={18} className={`mr-3 ${selectedMethod === 'QRIS' ? 'text-primary' : 'text-slate-400'}`} /> 
                              <span className={selectedMethod === 'QRIS' ? 'text-primary font-bold' : 'text-slate-300'}>QRIS (Scan)</span>
                          </button>
                      </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2 transform active:scale-[0.98]"
                >
                  {processing ? (
                      <><Loader2 size={20} className="animate-spin" /> Memproses...</>
                  ) : (
                      user 
                        ? (finalTotal > 0 ? 'Bayar Sekarang' : 'Klaim Sekarang (Gratis)') 
                        : 'Daftar & Bayar'
                  )}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
