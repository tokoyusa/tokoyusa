
import React, { useState } from 'react';
import { CartItem, UserProfile, StoreSettings, Voucher } from '../types';
import { formatRupiah, generateWhatsAppLink } from '../services/helpers';
import { Trash2, CreditCard, Wallet, QrCode, CheckCircle, Smartphone, Ticket, Loader2, X, User as UserIcon, AlertTriangle } from 'lucide-react';
import { getSupabase, GUEST_ORDER_MIGRATION_SQL } from '../services/supabase';
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
  const [processing, setProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [lastOrderTotal, setLastOrderTotal] = useState(0); 
  
  // Guest Info
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [migrationError, setMigrationError] = useState(false);

  // Voucher States
  const [voucherCode, setVoucherCode] = useState('');
  const [checkingVoucher, setCheckingVoucher] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState('');

  const navigate = useNavigate();

  // Basic total from items
  const subtotal = cart.reduce((acc, item) => acc + (item.discount_price || item.price) * item.quantity, 0);

  // Calculate discount
  let discountAmount = 0;
  if (appliedVoucher) {
     if (appliedVoucher.discount_type === 'percentage') {
        discountAmount = Math.floor(subtotal * (appliedVoucher.discount_value / 100));
     } else {
        discountAmount = appliedVoucher.discount_value;
     }
  }
  // Ensure discount doesn't exceed subtotal
  if (discountAmount > subtotal) discountAmount = subtotal;

  const finalTotal = subtotal - discountAmount;

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    setCheckingVoucher(true);
    setVoucherError('');
    setAppliedVoucher(null);

    const supabase = getSupabase();
    if (!supabase) {
      setCheckingVoucher(false);
      return;
    }

    try {
      const { data, error } = await supabase
         .from('vouchers')
         .select('*')
         .eq('code', voucherCode.toUpperCase().trim())
         .eq('is_active', true)
         .single();
      
      if (error || !data) {
         setVoucherError('Voucher tidak valid atau tidak ditemukan.');
      } else {
         setAppliedVoucher(data as Voucher);
      }
    } catch (err) {
       console.error(err);
       setVoucherError('Terjadi kesalahan saat mengecek voucher.');
    } finally {
       setCheckingVoucher(false);
    }
  };

  const removeVoucher = () => {
     setAppliedVoucher(null);
     setVoucherCode('');
     setVoucherError('');
  };

  const processAffiliateCommission = async (orderTotal: number) => {
    if (!user || !user.referred_by || !settings.affiliate_commission_rate || settings.affiliate_commission_rate <= 0) return;

    const supabase = getSupabase();
    if (!supabase) return;

    // 1. Find the referrer
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id')
      .eq('affiliate_code', user.referred_by)
      .single();

    if (referrer) {
      const commissionAmount = Math.floor(orderTotal * (settings.affiliate_commission_rate / 100));
      if (commissionAmount > 0) {
        // 2. Call the Secure RPC function to update balance
        const { error } = await supabase.rpc('increment_balance', { 
           user_id: referrer.id, 
           amount: commissionAmount 
        });
        
        if (error) {
           console.error("Failed to add commission", error);
        }
      }
    }
  };

  const handleCheckout = async () => {
    // Guest Validation
    if (!user) {
       if (!guestName.trim() || !guestPhone.trim()) {
          alert("Mohon lengkapi Data Pembeli (Nama & WhatsApp) sebelum membayar.");
          return;
       }
    }

    if (cart.length === 0) return;

    setProcessing(true);
    setMigrationError(false);
    const supabase = getSupabase();
    
    // Create Order
    const payload: any = {
        user_id: user ? user.id : null, // Null if guest
        guest_info: user ? null : { name: guestName, phone: guestPhone },
        subtotal: subtotal,
        discount_amount: discountAmount,
        voucher_code: appliedVoucher ? appliedVoucher.code : null,
        total_amount: finalTotal,
        status: 'pending',
        payment_method: selectedMethod,
        items: cart
    };

    const { data: order, error } = await supabase!
      .from('orders')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.message.includes('guest_info') || error.message.includes('column') || error.message.includes('null value in column "user_id"')) {
         setMigrationError(true);
         alert("Gagal Checkout: Database belum mendukung mode Tamu. Silakan copy SQL yang muncul.");
      } else {
         alert('Gagal membuat pesanan: ' + error.message);
      }
      setProcessing(false);
      return;
    }

    // Process Affiliate Commission based on FINAL total (Only for registered users)
    if (user) {
       await processAffiliateCommission(finalTotal);
    }

    setLastOrderTotal(finalTotal);
    setOrderSuccess(order.id);
    clearCart();
    setProcessing(false);
  };

  const handleConfirmWA = () => {
    if (!orderSuccess) return;
    
    const buyerName = user?.full_name || guestName;
    const msg = `Halo Admin, saya sudah melakukan pesanan.\nID: ${orderSuccess.slice(0, 8)}\nNama: ${buyerName}\nTotal: ${formatRupiah(lastOrderTotal)}\nMetode: ${selectedMethod}`;
    window.open(generateWhatsAppLink(settings.whatsapp_number, msg), '_blank');
  };

  const handleTripay = () => {
     alert("Redirecting to Tripay (Simulation)... In production this would open the Tripay payment URL.");
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
                <p className="text-sm text-slate-400">Silakan transfer ke salah satu rekening berikut:</p>
                {settings.bank_accounts.map((acc, idx) => (
                  <div key={idx} className="bg-slate-900 p-3 rounded">
                    <p className="font-bold text-primary">{acc.bank}</p>
                    <p className="text-lg font-mono">{acc.number}</p>
                    <p className="text-sm text-slate-500">a.n {acc.name}</p>
                  </div>
                ))}
             </div>
           )}

           {selectedMethod === 'EWALLET' && (
             <div className="space-y-4">
                <p className="text-sm text-slate-400">Silakan transfer saldo E-Wallet ke nomor berikut:</p>
                {settings.e_wallets && settings.e_wallets.length > 0 ? (
                  settings.e_wallets.map((wallet, idx) => (
                    <div key={idx} className="bg-slate-900 p-3 rounded flex justify-between items-center">
                      <div>
                        <p className="font-bold text-primary">{wallet.provider}</p>
                        <p className="text-lg font-mono tracking-wide">{wallet.number}</p>
                        <p className="text-sm text-slate-500">a.n {wallet.name}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-yellow-500 text-sm">Nomor E-Wallet belum dikonfigurasi oleh Admin.</p>
                )}
             </div>
           )}

           {selectedMethod === 'QRIS' && (
             <div className="flex flex-col items-center">
               <p className="text-sm text-slate-400 mb-2">Scan QRIS berikut:</p>
               {settings.qris_url ? (
                 <img src={settings.qris_url} alt="QRIS" className="w-48 h-48 rounded bg-white" />
               ) : (
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=Transfer ${lastOrderTotal} to Store`} alt="QRIS" className="w-48 h-48 rounded" />
               )}
             </div>
           )}

           {selectedMethod === 'TRIPAY' && (
              <div className="text-center">
                 <p className="mb-2">Selesaikan pembayaran via Tripay.</p>
                 <button onClick={handleTripay} className="bg-indigo-600 text-white px-4 py-2 rounded">Bayar Sekarang</button>
              </div>
           )}
           
           <div className="mt-6 pt-4 border-t border-slate-700">
             <p className="text-sm text-slate-400 mb-2">Setelah transfer, konfirmasi ke Admin:</p>
             <button onClick={handleConfirmWA} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded flex items-center justify-center gap-2">
                <Smartphone size={18} /> Konfirmasi WhatsApp
             </button>
           </div>
        </div>
        
        {user ? (
           <button onClick={() => navigate('/profile')} className="text-primary hover:underline">
              Lihat Riwayat Pesanan
           </button>
        ) : (
           <button onClick={() => navigate('/')} className="text-primary hover:underline">
              Kembali ke Toko
           </button>
        )}
      </div>
    );
  }

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold mb-6">Keranjang Belanja</h1>
      
      {migrationError && (
         <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg mb-6 animate-pulse max-w-4xl mx-auto">
            <div className="flex items-center gap-2 text-yellow-500 font-bold mb-2">
               <AlertTriangle size={20} /> Perbaikan Database Guest Mode
            </div>
            <p className="text-sm text-yellow-200 mb-2">
               Database belum mendukung checkout tanpa login. Silakan copy & jalankan kode SQL ini.
            </p>
            <div className="bg-slate-950 p-3 rounded font-mono text-xs text-green-400 relative overflow-x-auto">
               <pre>{GUEST_ORDER_MIGRATION_SQL}</pre>
               <button 
                  onClick={() => {
                     navigator.clipboard.writeText(GUEST_ORDER_MIGRATION_SQL);
                     alert("SQL disalin! Buka Supabase > SQL Editor > Paste > Run.");
                  }}
                  className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded text-[10px]"
               >
                  Copy SQL
               </button>
            </div>
         </div>
      )}

      {cart.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-slate-400 mb-4">Keranjang Anda kosong</p>
          <button onClick={() => navigate('/')} className="text-primary hover:underline">Mulai Belanja</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {/* Items List */}
          <div className="md:col-span-2 space-y-6">
            <div className="space-y-4">
               {cart.map(item => (
                 <div key={item.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex gap-4 items-center">
                    <img src={item.image_url || 'https://picsum.photos/100'} alt={item.name} className="w-16 h-16 rounded object-cover" />
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

            {/* GUEST INFO FORM (Only if not logged in) */}
            {!user && (
               <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                     <UserIcon className="text-primary" size={20} /> Data Pembeli
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm text-slate-400 mb-1">Nama Lengkap</label>
                        <input 
                           type="text" 
                           className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                           placeholder="Contoh: Budi Santoso"
                           value={guestName}
                           onChange={e => setGuestName(e.target.value)}
                        />
                     </div>
                     <div>
                        <label className="block text-sm text-slate-400 mb-1">No. WhatsApp</label>
                        <input 
                           type="text" 
                           className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                           placeholder="0812..."
                           value={guestPhone}
                           onChange={e => setGuestPhone(e.target.value)}
                        />
                     </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                     * Data ini digunakan untuk konfirmasi pesanan. Ingin simpan riwayat belanja? <button onClick={() => navigate('/login')} className="text-primary underline">Login / Daftar</button>
                  </p>
               </div>
            )}
          </div>

          {/* Checkout Summary */}
          <div className="md:col-span-1">
             <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 sticky top-24">
                <h3 className="text-xl font-bold mb-4">Ringkasan</h3>
                
                {/* Voucher Input */}
                <div className="mb-6 border-b border-slate-700 pb-6">
                   <label className="text-sm text-slate-400 mb-1 flex items-center gap-1"><Ticket size={14}/> Kode Voucher</label>
                   {appliedVoucher ? (
                     <div className="flex justify-between items-center bg-green-500/10 border border-green-500/20 p-2 rounded text-green-400 text-sm">
                        <span>Kode: <strong>{appliedVoucher.code}</strong></span>
                        <button onClick={removeVoucher}><X size={16} /></button>
                     </div>
                   ) : (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Masukkan kode..." 
                          className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-sm uppercase focus:border-primary outline-none"
                          value={voucherCode}
                          onChange={e => setVoucherCode(e.target.value)}
                        />
                        <button 
                           onClick={handleApplyVoucher} 
                           disabled={checkingVoucher || !voucherCode}
                           className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
                        >
                           {checkingVoucher ? <Loader2 size={16} className="animate-spin" /> : 'Pakai'}
                        </button>
                      </div>
                   )}
                   {voucherError && <p className="text-red-500 text-xs mt-1">{voucherError}</p>}
                </div>

                <div className="space-y-2 mb-4 text-slate-300">
                   <div className="flex justify-between">
                     <span>Total Item</span>
                     <span>{cart.length}</span>
                   </div>
                   <div className="flex justify-between">
                     <span>Subtotal</span>
                     <span>{formatRupiah(subtotal)}</span>
                   </div>
                   {appliedVoucher && (
                     <div className="flex justify-between text-green-400">
                        <span>Diskon {appliedVoucher.discount_type === 'percentage' ? `(${appliedVoucher.discount_value}%)` : ''}</span>
                        <span>- {formatRupiah(discountAmount)}</span>
                     </div>
                   )}
                </div>

                <div className="flex justify-between mb-6 text-xl font-bold text-white border-t border-slate-700 pt-2">
                  <span>Total Bayar</span>
                  <span>{formatRupiah(finalTotal)}</span>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-sm font-medium text-slate-400 mb-2">Metode Pembayaran</p>
                  
                  <button 
                    onClick={() => setSelectedMethod('TRANSFER')}
                    className={`w-full flex items-center p-3 rounded-lg border ${selectedMethod === 'TRANSFER' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-600 hover:border-slate-500'}`}
                  >
                    <CreditCard size={18} className="mr-3" /> Transfer Bank
                  </button>
                  
                  <button 
                    onClick={() => setSelectedMethod('EWALLET')}
                    className={`w-full flex items-center p-3 rounded-lg border ${selectedMethod === 'EWALLET' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-600 hover:border-slate-500'}`}
                  >
                    <Wallet size={18} className="mr-3" /> E-Wallet (Dana/Ovo/Gopay)
                  </button>

                  <button 
                    onClick={() => setSelectedMethod('QRIS')}
                    className={`w-full flex items-center p-3 rounded-lg border ${selectedMethod === 'QRIS' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-600 hover:border-slate-500'}`}
                  >
                    <QrCode size={18} className="mr-3" /> QRIS
                  </button>

                   {settings.tripay_api_key && (
                    <button 
                      onClick={() => setSelectedMethod('TRIPAY')}
                      className={`w-full flex items-center p-3 rounded-lg border ${selectedMethod === 'TRIPAY' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-600 hover:border-slate-500'}`}
                    >
                      <img src="https://tripay.co.id/favicon.ico" className="w-5 h-5 mr-3 rounded" alt="tripay" /> Tripay Otomatis
                    </button>
                   )}
                </div>

                <button 
                  onClick={handleCheckout} 
                  disabled={processing}
                  className="w-full bg-primary hover:bg-blue-600 disabled:bg-slate-600 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  {processing ? 'Memproses...' : 'Bayar Sekarang'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
