import React, { useEffect, useState } from 'react';
import { getSupabase } from '../../services/supabase';
import { formatRupiah } from '../../services/helpers';
import { Users, ShoppingBag, DollarSign, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalProducts: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = getSupabase();
      if (!supabase) return;

      const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
      
      const { data: orders } = await supabase.from('orders').select('total_amount, created_at').eq('status', 'completed'); // Assume 'completed' is paid
      
      const revenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const orderCount = orders?.length || 0;

      setStats({
        totalUsers: userCount || 0,
        totalProducts: prodCount || 0,
        totalOrders: orderCount,
        totalRevenue: revenue
      });

      // Simple chart data (last 7 days mock or real aggregation if complex query allowed)
      // For this demo, just mapping orders to simple view
      const mockChart = [
         { name: 'Mon', sales: 0 }, { name: 'Tue', sales: 0 }, { name: 'Wed', sales: 0 },
         { name: 'Thu', sales: 0 }, { name: 'Fri', sales: 0 }, { name: 'Sat', sales: 0 }, { name: 'Sun', sales: 0 }
      ];
      // In real app, aggregate orders by date
      if (orders) {
          orders.forEach(o => {
              const d = new Date(o.created_at);
              const day = d.getDay(); // 0 is Sunday
              const idx = day === 0 ? 6 : day - 1;
              if (mockChart[idx]) mockChart[idx].sales += o.total_amount;
          });
      }
      setChartData(mockChart);
    };

    fetchStats();
  }, []);

  const statCards = [
    { title: 'Pendapatan', value: formatRupiah(stats.totalRevenue), icon: <DollarSign className="text-green-500" />, color: 'bg-green-500/10' },
    { title: 'Pesanan Selesai', value: stats.totalOrders, icon: <ShoppingBag className="text-blue-500" />, color: 'bg-blue-500/10' },
    { title: 'Pengguna', value: stats.totalUsers, icon: <Users className="text-purple-500" />, color: 'bg-purple-500/10' },
    { title: 'Produk', value: stats.totalProducts, icon: <Package className="text-orange-500" />, color: 'bg-orange-500/10' },
  ];

  return (
    <div className="py-6 space-y-8">
      <h1 className="text-2xl font-bold">Dashboard Admin</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">{stat.title}</p>
              <p className="text-2xl font-bold mt-1 text-white">{stat.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${stat.color}`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-lg font-bold mb-6">Penjualan Mingguan</h3>
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                        formatter={(value: number) => formatRupiah(value)}
                    />
                    <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
