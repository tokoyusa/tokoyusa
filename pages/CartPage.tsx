
import React, { useState } from 'react';
import { CartItem, UserProfile, StoreSettings } from '../types';
import { formatRupiah, generateWhatsAppLink } from '../services/helpers';
import { Trash2, CreditCard, Wallet, QrCode, CheckCircle, Smartphone } from 'lucide-react';
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
  const [processing, setProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [lastOrderTotal, setLastOrderTotal] = useState(0); // Store total for success message
  const navigate = useNavigate();

  const total = cart.reduce((acc, item) => acc + (item.discount_price || item.price) * item.quantity, 0);

  const processAffiliateCommission = async (orderTotal: number) => {
    if (!user?.referred_by || !settings.affiliate_commission_rate || settings.affiliate_commission_rate <= 0) return;

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
    if (!user) {
      navigate('/login');
      return;
    }
    if (cart.length === 0) return;

    setProcessing(true);
    const supabase = getSupabase();
    
    // Create Order
    // Note: Items saved here include file_url from Product (via CartItem extension)
    const { data: order, error } = await supabase!
      .from('orders')
      .insert({
        user_id: user.id,
        total_amount: total,
        status: 'pending',
        payment_method: selectedMethod,
        items: cart
      })
      .select()
      .single();

    if (error || !order) {
      alert('Gagal membuat pesanan');
      setProcessing(false);
      return;
    }

    // Process Affiliate Commission (Fire and Forget)
    await processAffiliateCommission(total);

    setLastOrderTotal(total);
    setOrderSuccess(order.id);
    clearCart();
    setProcessing(false);
  };

  const handleConfirmWA = () => {
    if (!orderSuccess) return;
    const msg = `Halo Admin, saya sudah melakukan pesanan dengan ID: ${orderSuccess.slice(0, 8)}. Mohon diproses.\nTotal: ${formatRupiah(lastOrderTotal)}\nMetode: ${selectedMethod}`;
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
        
        <button onClick={() => navigate('/profile')} className="text-primary hover:underline">
           Lihat Riwayat Pesanan
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

          {/* Checkout Summary */}
          <div className="md:col-span-1">
             <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 sticky top-24">
                <h3 className="text-xl font-bold mb-4">Ringkasan</h3>
                <div className="flex justify-between mb-2 text-slate-300">
                  <span>Total Item</span>
                  <span>{cart.length}</span>
                </div>
                <div className="flex justify-between mb-6 text-xl font-bold text-white border-t border-slate-700 pt-2">
                  <span>Total</span>
                  <span>{formatRupiah(total)}</span>
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
