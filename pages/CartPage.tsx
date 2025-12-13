
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
  const [lastOrderMethod, setLastOrderMethod] = useState<string>('');
  const [isFreeOrder, setIsFreeOrder] = useState(false);

  // Voucher State
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [checkingVoucher, setCheckingVoucher] = useState(false);

  // Guest/Auto-Register Checkout State
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const navigate = useNavigate();
  const supabase = getSupabase();

  // --- CALCULATION LOGIC ---
  const rawSubtotal = cart.reduce((sum, item) => {
    const price = item.discount_price || item.price;
    return sum + (Number(price) * item.quantity);
  }, 0);

  let discountAmount = 0;
  if (appliedVoucher) {
    if (appliedVoucher.discount_type === 'percentage') {
       discountAmount = Math.round(rawSubtotal * (Number(appliedVoucher.discount_value) / 100));
    } else {
       discountAmount = Number(appliedVoucher.discount_value);
    }
  }

  // Ensure discount doesn't exceed subtotal
  if (discountAmount > rawSubtotal) discountAmount = rawSubtotal;

  const finalTotal = Math.max(0, rawSubtotal - discountAmount);
  
  // --- VOUCHER HANDLER ---
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim() || !supabase) return;
    setCheckingVoucher(true);
    setAppliedVoucher(null);

    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', voucherCode.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !data) {
       alert("Voucher tidak valid atau sudah kadaluarsa.");
    } else {
       setAppliedVoucher(data as Voucher);
       alert("Voucher berhasil dipasang!");
    }
    setCheckingVoucher(false);
  };

  const handleRemoveVoucher = () => {
     setAppliedVoucher(null);
     setVoucherCode('');
  };

  // --- CHECKOUT HANDLER ---
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!supabase) return;

    // VALIDASI INPUT GUEST
    if (!user) {
        if (!guestName || !guestEmail || !guestPassword || !guestPhone) {
            alert("Mohon lengkapi data diri Anda untuk pendaftaran otomatis.");
            return;
        }
    } else if (selectedMethod !== 'QRIS' && selectedMethod !== 'TRIPAY') {
       // Validate Provider selection for specific methods if Logged In
       if (selectedMethod === 'TRANSFER' && settings.bank_accounts.length > 0 && !selectedProvider) {
          alert("Silakan pilih Bank tujuan.");
          return;
       }
       if (selectedMethod === 'EWALLET' && settings.e_wallets.length > 0 && !selectedProvider) {
          alert("Silakan pilih E-Wallet tujuan.");
          return;
       }
    }

    setProcessing(true);

    try {
      let userId = user?.id;

      // 1. AUTO-REGISTER / LOGIN IF GUEST
      if (!user) {
         // Check if email exists
         const { data: existingUser } = await supabase.from('profiles').select('id').eq('email', guestEmail).single();
         
         if (existingUser) {
             // Try to login (Simplification: In real app, prompt for password)
             const { data: loginData, error: loginError } = await (supabase.auth as any).signInWithPassword({
                 email: guestEmail,
                 password: guestPassword
             });
             
             if (loginError) {
                 alert("Email sudah terdaftar. Gagal login otomatis: " + loginError.message);
                 setProcessing(false);
                 return;
             }
             userId = loginData.user.id;
         } else {
             // Register New User
             const { data: authData, error: authError } = await (supabase.auth as any).signUp({
                 email: guestEmail,
                 password: guestPassword,
                 options: { data: { full_name: guestName } }
             });

             if (authError) throw authError;
             
             userId = authData.user?.id;
             
             // Create Profile Manual Ensure
             if (userId) {
                // Check if profile created by trigger, if not create
                const { error: profileError } = await supabase.from('profiles').insert({
                    id: userId,
                    email: guestEmail,
                    full_name: guestName,
                    phone: guestPhone,
                    role: 'user'
                }).select();
                
                if (profileError && !profileError.message.includes('duplicate')) {
                    console.error("Profile creation error", profileError);
                }
             }
         }
      }

      // 2. CHECK REFERRAL (AFFILIATE) from LocalStorage
      let referredBy = null;
      if (user?.referred_by) {
          referredBy = user.referred_by;
      } else {
          referredBy = localStorage.getItem('digitalstore_referral');
      }

      // If user was just created (guest), update their referral code
      if (userId && referredBy && !user?.referred_by) {
          await supabase.from('profiles').update({ referred_by: referredBy }).eq('id', userId);
      }

      // 3. PREPARE DETAILED PAYMENT METHOD STRING
      let detailedMethod: string = selectedMethod;
      if (finalTotal <= 0) {
          detailedMethod = 'GRATIS / FREE';
      } else if (selectedMethod === 'TRANSFER' || selectedMethod === 'EWALLET') {
          // Add Provider Name (e.g., "EWALLET - DANA")
          if (selectedProvider) {
              detailedMethod = `${selectedMethod} - ${selectedProvider}`;
          }
      }

      // 4. CREATE ORDER
      const status = finalTotal <= 0 ? 'completed' : 'pending';

      const payload: any = {
        user_id: userId, // Can be null if really Guest, but we auto-registered
        total_amount: finalTotal,
        subtotal: rawSubtotal,
        discount_amount: discountAmount,
        voucher_code: appliedVoucher?.code || null,
        status: status, 
        payment_method: detailedMethod,
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          price: item.discount_price || item.price,
          cost_price: item.cost_price || 0, // SNAPSHOT COST PRICE FOR PROFIT CALC
          file_url: item.file_url 
        })),
        guest_info: !userId ? { name: guestName, whatsapp: guestPhone } : null
      };

      const { data: orderData, error } = await supabase
        .from('orders')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // 5. SUCCESS HANDLING
      setLastOrderTotal(finalTotal);
      setLastOrderItems(cart); // Save items for WA message
      setLastOrderMethod(detailedMethod); // Save specific method
      setIsFreeOrder(finalTotal <= 0);
      setOrderSuccess(orderData.id);
      clearCart();
      
      // Clear voucher
      setAppliedVoucher(null);
      setVoucherCode('');

    } catch (err: any) {
      alert("Gagal membuat pesanan: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmWA = () => {
    // Build Detailed Product List
    const itemsList = lastOrderItems.map((item, idx) => `${idx + 1}. ${item.name} (x${item.quantity})`).join('\n');

    const message = `Halo Admin, saya sudah melakukan checkout.

*Detail Pesanan:*
${itemsList}

*Total:* ${formatRupiah(lastOrderTotal)}
*Metode Pembayaran:* ${lastOrderMethod}
*ID Pesanan:* ${orderSuccess?.substring(0, 8)}

Mohon segera diproses. Terima kasih.`;
    
    const adminNumber = settings.whatsapp_number || '6281234567890';
    window.open(generateWhatsAppLink(adminNumber, message), '_blank');
  };

  const openFullImage = (url: string) => {
    window.open(url, '_blank');
  };

  // --- RENDER SUCCESS SCREEN ---
  if (orderSuccess) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
            <CheckCircle className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Pesanan Berhasil!</h2>
          <p className="text-slate-400 mb-6 text-sm">ID: <span className="font-mono text-slate-300">{orderSuccess}</span></p>
          
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-6">
            <p className="text-sm text-slate-400 mb-1">Total Pembayaran</p>
            <p className="text-2xl font-bold text-primary">{formatRupiah(lastOrderTotal)}</p>
            {isFreeOrder && <p className="text-green-500 text-xs font-bold mt-1">LUNAS (GRATIS)</p>}
          </div>

          {isFreeOrder ? (
              <div className="space-y-4">
                  <p className="text-slate-300 text-sm">
                      Terima kasih! Karena total belanja Anda Rp 0, pesanan otomatis selesai.
                  </p>
                  <button 
                    onClick={() => navigate('/profile')}
                    className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                  >
                    <Download size={20} /> Lihat & Download Produk
                  </button>
              </div>
          ) : (
              <div className="space-y-4">
                <p className="text-slate-300 text-sm mb-4">
                    Silakan selesaikan pembayaran dan kirim konfirmasi ke WhatsApp Admin agar pesanan segera diproses.
                </p>

                {selectedMethod === 'QRIS' && settings.qris_url && (
                    <div className="mb-6 flex flex-col items-center">
                        <div className="p-3 bg-white rounded-lg shadow-md max-w-[250px] overflow-hidden relative">
                             <img 
                                src={settings.qris_url} 
                                alt="QRIS" 
                                className="w-full h-auto object-contain"
                                onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                             />
                        </div>
                        <button 
                           onClick={() => openFullImage(settings.qris_url!)}
                           className="text-xs text-primary mt-2 flex items-center gap-1 hover:underline"
                        >
                           <ExternalLink size={12} /> Buka Gambar Full Size
                        </button>
                        <p className="text-xs text-slate-400 mt-2">Scan QRIS di atas untuk membayar</p>
                    </div>
                )}

                <button 
                    onClick={handleConfirmWA}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20"
                >
                    <Smartphone size={20} /> Konfirmasi via WhatsApp
                </button>
                
                <button 
                    onClick={() => navigate('/profile')}
                    className="text-slate-400 text-sm hover:text-white mt-4"
                >
                    Lihat Riwayat Pesanan
                </button>
              </div>
          )}
        </div>
      </div>
    );
  }

  // --- RENDER EMPTY CART ---
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="bg-slate-800 p-6 rounded-full mb-4 shadow-xl">
           <ShoppingBag className="w-12 h-12 text-slate-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Keranjang Kosong</h2>
        <p className="text-slate-400 mb-6">Belum ada produk yang ditambahkan.</p>
        <button onClick={() => window.location.href = '/'} className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-full font-medium transition-colors">
          Mulai Belanja
        </button>
      </div>
    );
  }

  // --- RENDER CHECKOUT FORM ---
  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
         <ShoppingBag className="text-primary"/> Keranjang Belanja
      </h1>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* LEFT: Cart Items */}
        <div className="flex-1 space-y-4">
          <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
            {cart.map((item) => (
              <div key={item.id} className="p-4 flex gap-4 border-b border-slate-700 last:border-0 hover:bg-slate-750 transition-colors">
                <img src={item.image_url || 'https://via.placeholder.com/80'} className="w-20 h-20 object-cover rounded bg-slate-700" alt={item.name} />
                <div className="flex-1">
                  <h3 className="font-bold text-white line-clamp-2">{item.name}</h3>
                  <p className="text-sm text-slate-400 mb-2">{item.category}</p>
                  <div className="flex justify-between items-end">
                    <p className="text-primary font-bold">{formatRupiah(item.discount_price || item.price)}</p>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-400/10 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Voucher Section */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
             <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Ticket size={18} className="text-accent"/> Voucher Diskon</h3>
             
             {appliedVoucher ? (
                <div className="flex justify-between items-center bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                   <div>
                      <span className="font-mono font-bold text-green-500">{appliedVoucher.code}</span>
                      <p className="text-xs text-green-400">Diskon {appliedVoucher.discount_type === 'percentage' ? `${appliedVoucher.discount_value}%` : formatRupiah(Number(appliedVoucher.discount_value))}</p>
                   </div>
                   <button onClick={handleRemoveVoucher} className="text-red-400 hover:text-red-300 p-1">
                      <X size={18} />
                   </button>
                </div>
             ) : (
                <div className="flex gap-2">
                   <input 
                      type="text" 
                      placeholder="Masukkan Kode Voucher"
                      className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 uppercase focus:border-primary outline-none"
                      value={voucherCode}
                      onChange={e => setVoucherCode(e.target.value)}
                   />
                   <button 
                      onClick={handleApplyVoucher}
                      disabled={checkingVoucher || !voucherCode}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
                   >
                      {checkingVoucher ? <Loader2 size={18} className="animate-spin"/> : 'Pakai'}
                   </button>
                </div>
             )}
          </div>
        </div>

        {/* RIGHT: Payment & Summary */}
        <div className="lg:w-96 space-y-6">
            
            {/* Auto-Register Form for Guest */}
            {!user && (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <h2 className="font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                        <UserPlus size={18} className="text-primary"/> Data Pembeli
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">Isi data ini untuk pendaftaran akun otomatis.</p>
                    
                    <div className="space-y-3">
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-slate-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="Nama Lengkap" 
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 pl-9 text-sm focus:border-primary outline-none"
                                value={guestName}
                                onChange={e => setGuestName(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Smartphone className="absolute left-3 top-3 text-slate-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="No. WhatsApp" 
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 pl-9 text-sm focus:border-primary outline-none"
                                value={guestPhone}
                                onChange={e => setGuestPhone(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-slate-500" size={16} />
                            <input 
                                type="email" 
                                placeholder="Email" 
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 pl-9 text-sm focus:border-primary outline-none"
                                value={guestEmail}
                                onChange={e => setGuestEmail(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-500" size={16} />
                            <input 
                                type="password" 
                                placeholder="Buat Password" 
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 pl-9 text-sm focus:border-primary outline-none"
                                value={guestPassword}
                                onChange={e => setGuestPassword(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Method Selection */}
            {finalTotal > 0 && (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h2 className="font-bold text-white mb-4 flex items-center gap-2">Metode Pembayaran</h2>
                    <div className="space-y-2">
                        {settings.bank_accounts.length > 0 && (
                            <button 
                                onClick={() => { setSelectedMethod('TRANSFER'); setSelectedProvider(''); }}
                                className={`w-full p-3 rounded-lg flex items-center gap-3 border transition-all ${selectedMethod === 'TRANSFER' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                            >
                                <CreditCard size={20} /> Transfer Bank Manual
                            </button>
                        )}
                        
                        {/* Sub-selection for Bank */}
                        {selectedMethod === 'TRANSFER' && settings.bank_accounts.length > 0 && (
                            <div className="pl-4 pr-1 mb-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                {settings.bank_accounts.map((bank, idx) => (
                                    <label key={idx} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                                        <input 
                                            type="radio" 
                                            name="bank_provider" 
                                            value={bank.bank} 
                                            checked={selectedProvider === bank.bank}
                                            onChange={() => setSelectedProvider(bank.bank)}
                                            className="accent-primary"
                                        />
                                        <span className="text-sm text-slate-300">{bank.bank} - {bank.number}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {settings.e_wallets.length > 0 && (
                            <button 
                                onClick={() => { setSelectedMethod('EWALLET'); setSelectedProvider(''); }}
                                className={`w-full p-3 rounded-lg flex items-center gap-3 border transition-all ${selectedMethod === 'EWALLET' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                            >
                                <Wallet size={20} /> E-Wallet (DANA/OVO/DLL)
                            </button>
                        )}

                        {/* Sub-selection for E-Wallet */}
                        {selectedMethod === 'EWALLET' && settings.e_wallets.length > 0 && (
                             <div className="pl-4 pr-1 mb-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                {settings.e_wallets.map((wallet, idx) => (
                                    <label key={idx} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                                        <input 
                                            type="radio" 
                                            name="wallet_provider" 
                                            value={wallet.provider} 
                                            checked={selectedProvider === wallet.provider}
                                            onChange={() => setSelectedProvider(wallet.provider)}
                                            className="accent-primary"
                                        />
                                        <span className="text-sm text-slate-300">{wallet.provider} - {wallet.number}</span>
                                    </label>
                                ))}
                             </div>
                        )}

                        {settings.qris_url && (
                            <button 
                                onClick={() => setSelectedMethod('QRIS')}
                                className={`w-full p-3 rounded-lg flex items-center gap-3 border transition-all ${selectedMethod === 'QRIS' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                            >
                                <QrCode size={20} /> QRIS (Scan Barcode)
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Summary & Pay Button */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 sticky top-24">
                <h2 className="font-bold text-white mb-4">Ringkasan Belanja</h2>
                <div className="space-y-2 text-sm text-slate-400 mb-4 border-b border-slate-700 pb-4">
                    <div className="flex justify-between">
                        <span>Total Harga ({cart.length} item)</span>
                        <span>{formatRupiah(rawSubtotal)}</span>
                    </div>
                    {appliedVoucher && (
                        <div className="flex justify-between text-green-400">
                            <span>Diskon Voucher</span>
                            <span>- {formatRupiah(discountAmount)}</span>
                        </div>
                    )}
                </div>
                
                <div className="flex justify-between items-end mb-6">
                    <span className="font-bold text-white">Total Bayar</span>
                    <span className="text-2xl font-bold text-primary">{formatRupiah(finalTotal)}</span>
                </div>

                <button 
                    onClick={handleCheckout}
                    disabled={processing}
                    className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {processing ? (
                        <>
                           <Loader2 size={20} className="animate-spin" /> Memproses...
                        </>
                    ) : (
                        <>
                           <CheckCircle size={20} /> 
                           {finalTotal <= 0 ? 'Proses Pesanan Gratis' : 'Bayar Sekarang'}
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
