
import React, { useEffect, useState } from 'react';
import { getSupabase, FIX_AFFILIATE_AND_QRIS_SQL, HISTORY_MIGRATION_SQL } from '../../services/supabase';
import { Order, OrderItem } from '../../types';
import { formatRupiah } from '../../services/helpers';
import { ClipboardList, Filter, ChevronDown, CheckCircle, XCircle, Clock, Loader2, DollarSign, AlertTriangle } from 'lucide-react';

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [showSql, setShowSql] = useState(false);
  const [activeSql, setActiveSql] = useState('');

  const supabase = getSupabase();

  const fetchOrders = async () => {
    if (!supabase) return;
    setLoading(true);
    
    // Fetch orders with user profiles to show names
    const { data, error } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false });

    if (data) {
       setOrders(data as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const processCommission = async (order: Order) => {
    if (!supabase || order.commission_paid || !order.user_id) return;
    
    // 1. Check if user was referred
    const { data: userProfile } = await supabase
        .from('profiles')
        .select('referred_by')
        .eq('id', order.user_id)
        .single();
        
    if (!userProfile || !userProfile.referred_by) return; // No referral

    // 2. Get affiliate profile
    const { data: affiliate } = await supabase
        .from('profiles')
        .select('id')
        .eq('affiliate_code', userProfile.referred_by)
        .single();
    
    if (!affiliate) return;

    // 3. Get Commission Rate
    const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'store_settings')
        .single();
    
    const rate = settings?.value?.affiliate_commission_rate || 0;
    if (rate <= 0) return;

    // 4. Calculate PROFIT (Margin)
    let totalSellPrice = 0;
    let totalCostPrice = 0;
    let productNames: string[] = [];

    // Helper to fetch live product data if snapshot missing cost
    const getProductCost = async (prodId: string): Promise<number> => {
       const { data } = await supabase.from('products').select('cost_price').eq('id', prodId).single();
       return data?.cost_price || 0;
    };

    if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
             const qty = item.quantity || 1; 
             const price = Number(item.price) || 0;
             let cost = Number(item.cost_price) || 0;
             
             // FALLBACK: If cost is 0 in snapshot (legacy order), try to fetch from real product table
             if (cost === 0) {
                 const liveCost = await getProductCost(item.product_id);
                 if (liveCost > 0) cost = liveCost;
             }
             
             totalSellPrice += (price * qty);
             totalCostPrice += (cost * qty);
             productNames.push(item.product_name);
        }
    }

    const discount = Number(order.discount_amount) || 0;
    
    // Net Profit Calculation
    const grossProfit = totalSellPrice - totalCostPrice;
    const netProfit = Math.max(0, grossProfit - discount); 

    // 5. Calculate Commission Amount based on Net Profit
    const commission = Math.floor(netProfit * (rate / 100));

    if (commission > 0) {
        // Use RPC to safely increment balance
        const { error } = await supabase.rpc('increment_balance', { 
            user_id: affiliate.id, 
            amount: commission 
        });

        if (!error) {
            // INSERT INTO HISTORY
            await supabase.from('commission_history').insert({
                affiliate_id: affiliate.id,
                order_id: order.id,
                amount: commission,
                source_buyer: order.profiles?.full_name || 'Guest',
                products: productNames.join(', '),
            });

            // 6. Mark order as commission paid
            await supabase
                .from('orders')
                .update({ commission_paid: true })
                .eq('id', order.id);
            
            alert(`Komisi Affiliate Berhasil: Rp ${formatRupiah(commission)}\n(Profit Order: ${formatRupiah(netProfit)} | Rate: ${rate}%)`);
        } else {
            console.error("Failed to add commission", error);
            if (error.message.includes('function') && error.message.includes('does not exist')) {
                 alert("Gagal memproses komisi: Fungsi Database 'increment_balance' belum dibuat.");
                 setActiveSql(FIX_AFFILIATE_AND_QRIS_SQL);
                 setShowSql(true);
            }
        }
    } else {
        await supabase.from('orders').update({ commission_paid: true }).eq('id', order.id);
        console.log("Commission is 0");
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
     if (!supabase) return;
     setUpdatingId(orderId);
     
     const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select('*, profiles(full_name)')
        .single();
     
     setUpdatingId(null);

     if (!error && data) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
        if (newStatus === 'completed') {
            try {
                await processCommission(data as Order);
            } catch (err: any) {
                if (err.message.includes('relation "public.commission_history" does not exist')) {
                    alert("ERROR: Tabel riwayat komisi belum dibuat. Silakan jalankan SQL migrasi di halaman Settings.");
                    setActiveSql(HISTORY_MIGRATION_SQL);
                    setShowSql(true);
                }
            }
        }
     } else {
        const errorMessage = error?.message || "Unknown error";
        if (errorMessage.includes('commission_paid')) {
             alert("Error: Kolom 'commission_paid' tidak ditemukan di database.");
             setActiveSql(FIX_AFFILIATE_AND_QRIS_SQL);
             setShowSql(true);
        } else {
             alert("Gagal update status: " + errorMessage);
        }
     }
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const getStatusColor = (status: string) => {
     switch(status) {
         case 'completed': return 'text-green-500 bg-green-500/10';
         case 'processing': return 'text-blue-500 bg-blue-500/10';
         case 'cancelled': return 'text-red-500 bg-red-500/10';
         default: return 'text-yellow-500 bg-yellow-500/10';
     }
  };

  const getStatusLabel = (status: string) => {
     switch(status) {
         case 'completed': return 'Selesai';
         case 'processing': return 'Proses';
         case 'cancelled': return 'Cancel';
         default: return 'Pending';
     }
  };

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="text-primary" /> Manajemen Pesanan
        </h1>
        
        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
           <Filter size={16} className="text-slate-400 ml-2" />
           <select 
             className="bg-transparent text-sm p-2 outline-none text-slate-200"
             value={filter}
             onChange={(e) => setFilter(e.target.value)}
           >
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Proses</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Cancel</option>
           </select>
        </div>
      </div>

      {showSql && (
         <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg mb-6 animate-pulse">
             <div className="flex items-center gap-2 text-yellow-500 font-bold mb-2">
                <AlertTriangle size={20} /> Perbaikan Database Diperlukan
             </div>
             <p className="text-sm text-yellow-200 mb-2">
                Sistem mendeteksi ada tabel atau fungsi yang hilang. Copy & jalankan kode ini di Supabase SQL Editor:
             </p>
             <div className="bg-slate-950 p-3 rounded font-mono text-xs text-green-400 relative overflow-x-auto">
                 <pre>{activeSql}</pre>
                 <button 
                   onClick={() => {
                      navigator.clipboard.writeText(activeSql);
                      alert("Copied!");
                   }} 
                   className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded"
                 >Copy</button>
             </div>
         </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-4">ID / Tanggal</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Produk</th>
                <th className="p-4">Total / Profit</th>
                <th className="p-4">Status</th>
                <th className="p-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Tidak ada pesanan ditemukan.</td></tr>
              ) : (
                filteredOrders.map((order) => {
                   // Quick Profit Est for Display
                   let estCost = 0;
                   order.items?.forEach((i: any) => estCost += (Number(i.cost_price || 0) * (i.quantity || 1)));
                   const estProfit = order.total_amount - estCost;
                   const discount = order.discount_amount || 0;
                   const finalProfit = Math.max(0, estProfit - discount);

                   return (
                    <tr key={order.id} className="hover:bg-slate-750">
                        <td className="p-4 align-top">
                           <span className="font-mono text-xs bg-slate-900 px-2 py-1 rounded text-slate-300">#{order.id.slice(0,8)}</span>
                           <div className="text-xs text-slate-500 mt-1">{new Date(order.created_at).toLocaleDateString()}</div>
                           {order.commission_paid && <span className="text-[10px] text-green-500 flex items-center gap-0.5 mt-0.5"><DollarSign size={8}/> Komisi Paid</span>}
                        </td>
                        <td className="p-4 align-top">
                           <div className="font-medium text-white">{order.profiles?.full_name || 'Guest/Unknown'}</div>
                           <div className="text-xs text-slate-500">{order.profiles?.email}</div>
                        </td>
                        <td className="p-4 align-top">
                           <ul className="text-sm text-slate-300 space-y-1">
                               {order.items?.map((item, idx) => (
                                   <li key={idx} className="flex gap-1">
                                       <span className="text-slate-500">{item.quantity || 1}x</span>
                                       <span>{item.product_name}</span>
                                   </li>
                               ))}
                           </ul>
                        </td>
                        <td className="p-4 align-top">
                           <div className="font-bold text-slate-200">{formatRupiah(order.total_amount)}</div>
                           <div className="text-[10px] text-slate-500 mt-1">
                               Profit: <span className="text-green-400">{formatRupiah(finalProfit)}</span>
                           </div>
                        </td>
                        <td className="p-4 align-top">
                           <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                           </span>
                        </td>
                        <td className="p-4 align-top">
                        <div className="relative group min-w-[120px]">
                            {updatingId === order.id ? (
                                <div className="flex items-center text-xs text-slate-400 gap-1">
                                <Loader2 size={14} className="animate-spin" /> Updating...
                                </div>
                            ) : (
                                <>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-600 text-xs rounded p-2 outline-none hover:border-primary transition-colors cursor-pointer appearance-none pr-8"
                                    value={order.status}
                                    onChange={(e) => updateStatus(order.id, e.target.value)}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="processing">Proses</option>
                                    <option value="completed">Selesai</option>
                                    <option value="cancelled">Cancel</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                                </>
                            )}
                        </div>
                        </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminOrders;
