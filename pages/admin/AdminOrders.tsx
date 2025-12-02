
import React, { useEffect, useState } from 'react';
import { getSupabase } from '../../services/supabase';
import { Order } from '../../types';
import { formatRupiah } from '../../services/helpers';
import { ClipboardList, Filter, ChevronDown, CheckCircle, XCircle, Clock } from 'lucide-react';

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

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

  const updateStatus = async (orderId: string, newStatus: string) => {
     if (!supabase) return;
     const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
     if (!error) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
     } else {
        alert("Gagal update status: " + error.message);
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

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-4">ID Pesanan</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Total</th>
                <th className="p-4">Metode</th>
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
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-750">
                    <td className="p-4">
                      <span className="font-mono text-xs bg-slate-900 px-2 py-1 rounded text-slate-300">#{order.id.slice(0,8)}</span>
                      <div className="text-xs text-slate-500 mt-1">{new Date(order.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-white">{order.profiles?.full_name || 'Unknown'}</div>
                      <div className="text-xs text-slate-500">{order.profiles?.email}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-200">
                       {formatRupiah(order.total_amount)}
                    </td>
                    <td className="p-4 text-sm text-slate-300">
                       {order.payment_method}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="p-4">
                       <div className="relative group">
                          <select 
                            className="bg-slate-900 border border-slate-600 text-xs rounded p-2 outline-none hover:border-primary transition-colors cursor-pointer appearance-none pr-8"
                            value={order.status}
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                          >
                             <option value="pending">Pending</option>
                             <option value="processing">Proses</option>
                             <option value="completed">Selesai</option>
                             <option value="cancelled">Cancel</option>
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminOrders;
