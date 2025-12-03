
import React, { useEffect, useState } from 'react';
import { getSupabase, VOUCHER_MIGRATION_SQL } from '../../services/supabase';
import { Voucher } from '../../types';
import { formatRupiah } from '../../services/helpers';
import { Ticket, Plus, Trash2, X, Terminal, AlertTriangle, Save } from 'lucide-react';

const AdminVouchers: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [tableError, setTableError] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'nominal',
    discount_value: 0
  });

  const supabase = getSupabase();

  const fetchVouchers = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
    
    if (error) {
       // Detect both missing table AND schema cache errors
       if (
         error.message.includes('relation "public.vouchers" does not exist') || 
         error.message.includes('Could not find the table') ||
         error.message.includes('schema cache')
       ) {
          setTableError(true);
       }
    } else if (data) {
       setVouchers(data as Voucher[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    try {
      const payload = {
         code: formData.code.toUpperCase().replace(/\s/g, ''),
         discount_type: formData.discount_type,
         discount_value: formData.discount_value,
         is_active: true
      };

      const { error } = await supabase.from('vouchers').insert(payload);
      
      if (error) throw error;
      
      setIsModalOpen(false);
      setFormData({ code: '', discount_type: 'percentage', discount_value: 0 });
      fetchVouchers();
      
    } catch (error: any) {
      if (
         error.message.includes('relation "public.vouchers" does not exist') || 
         error.message.includes('Could not find the table') ||
         error.message.includes('schema cache')
      ) {
          setTableError(true);
          setIsModalOpen(false);
          alert("Gagal menyimpan: Tabel database belum siap. Silakan lihat instruksi di halaman.");
      } else {
          alert("Gagal menyimpan voucher: " + error.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Hapus voucher ini?') && supabase) {
      await supabase.from('vouchers').delete().eq('id', id);
      fetchVouchers();
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    if (!supabase) return;
    await supabase.from('vouchers').update({ is_active: !currentStatus }).eq('id', id);
    fetchVouchers();
  };

  return (
    <div className="py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
           <Ticket className="text-primary"/> Manajemen Voucher
        </h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} /> Buat Voucher
        </button>
      </div>

      {tableError && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg mb-6 animate-pulse">
           <div className="flex items-center gap-2 text-yellow-500 font-bold mb-2">
              <AlertTriangle size={20} /> Tabel Voucher Belum Dibuat
           </div>
           <p className="text-sm text-yellow-200 mb-2">
              Database belum memiliki tabel voucher. Silakan copy & jalankan kode di bawah ini di Supabase SQL Editor.
           </p>
           <div className="flex gap-2">
             <button 
               onClick={() => setShowSql(!showSql)} 
               className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded"
             >
               {showSql ? 'Sembunyikan SQL' : 'Lihat SQL'}
             </button>
             <button 
               onClick={() => window.location.reload()} 
               className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded"
             >
               Sudah Dijalankan? Refresh App
             </button>
           </div>
           
           {showSql && (
             <div className="bg-slate-950 p-3 mt-2 rounded font-mono text-xs text-green-400 relative overflow-x-auto">
               <pre>{VOUCHER_MIGRATION_SQL}</pre>
               <button 
                  onClick={() => { navigator.clipboard.writeText(VOUCHER_MIGRATION_SQL); alert("Copied!"); }}
                  className="absolute top-2 right-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px]"
               >Copy</button>
             </div>
           )}
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
            <tr>
              <th className="p-4">Kode Voucher</th>
              <th className="p-4">Diskon</th>
              <th className="p-4">Status</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading...</td></tr>
            ) : vouchers.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Belum ada voucher.</td></tr>
            ) : (
                vouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-750">
                    <td className="p-4">
                      <span className="font-mono bg-slate-900 border border-slate-700 px-2 py-1 rounded text-primary font-bold">
                        {v.code}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-white">
                      {v.discount_type === 'percentage' ? `${v.discount_value}%` : formatRupiah(v.discount_value)}
                    </td>
                    <td className="p-4">
                      <button 
                         onClick={() => toggleStatus(v.id, v.is_active)}
                         className={`px-2 py-1 rounded text-xs font-bold uppercase ${v.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}
                      >
                         {v.is_active ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="p-4">
                      <button onClick={() => handleDelete(v.id)} className="p-2 text-red-400 hover:bg-slate-700 rounded"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700">
             <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h2 className="text-xl font-bold">Buat Voucher Baru</h2>
                <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400" /></button>
             </div>
             
             <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                   <label className="block text-sm font-medium mb-1">Kode Voucher</label>
                   <input 
                      type="text" 
                      required 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 font-mono uppercase focus:border-primary outline-none" 
                      placeholder="CONTOH: MERDEKA45"
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value})}
                   />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-medium mb-1">Tipe Diskon</label>
                      <select 
                         className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                         value={formData.discount_type}
                         onChange={e => setFormData({...formData, discount_type: e.target.value as any})}
                      >
                         <option value="percentage">Persentase (%)</option>
                         <option value="nominal">Nominal (Rp)</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-medium mb-1">Nilai</label>
                      <input 
                         type="number" 
                         required 
                         min="1"
                         className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                         value={formData.discount_value}
                         onChange={e => setFormData({...formData, discount_value: parseInt(e.target.value)})}
                      />
                   </div>
                </div>

                <div className="bg-blue-500/10 p-3 rounded text-xs text-blue-200">
                   {formData.discount_type === 'percentage' 
                      ? `User akan mendapat diskon ${formData.discount_value}% dari total belanja.`
                      : `User akan mendapat potongan harga ${formatRupiah(formData.discount_value)}.`
                   }
                </div>
                
                <button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-2 rounded mt-2 flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Simpan Voucher
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVouchers;
