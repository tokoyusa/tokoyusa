
import React, { useEffect, useState } from 'react';
import { getSupabase } from '../../services/supabase';
import { UserProfile } from '../../types';
import { formatRupiah } from '../../services/helpers';
import { Users, DollarSign, CheckCircle, CreditCard, AlertCircle } from 'lucide-react';

const AdminAffiliates: React.FC = () => {
  const [affiliates, setAffiliates] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = getSupabase();

  const fetchAffiliates = async () => {
    if (!supabase) return;
    setLoading(true);
    
    // Fetch users who have an affiliate code
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .not('affiliate_code', 'is', null);

    if (data) {
       setAffiliates(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAffiliates();
  }, []);

  const handlePayout = async (userId: string, currentBalance: number) => {
    if (currentBalance <= 0) {
        alert("Saldo kosong.");
        return;
    }
    const confirmMsg = `Pastikan Anda sudah mentransfer uang Rp ${currentBalance} ke user ini secara manual (Bank/E-Wallet). \n\nKlik OK untuk mereset saldo user menjadi 0.`;
    
    if (confirm(confirmMsg)) {
        if (!supabase) return;
        
        const { error } = await supabase
           .from('profiles')
           .update({ balance: 0 })
           .eq('id', userId);

        if (error) {
            alert("Gagal update saldo: " + error.message);
        } else {
            alert("Saldo berhasil direset.");
            fetchAffiliates();
        }
    }
  };

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users className="text-primary" /> Manajemen Affiliate
      </h1>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
            <tr>
              <th className="p-4">Nama User</th>
              <th className="p-4">Kode Referral</th>
              <th className="p-4">Info Rekening</th>
              <th className="p-4">Saldo Komisi</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
               <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading...</td></tr>
            ) : affiliates.length === 0 ? (
               <tr><td colSpan={5} className="p-8 text-center text-slate-500">Belum ada affiliate terdaftar.</td></tr>
            ) : (
               affiliates.map((aff) => (
                <tr key={aff.id} className="hover:bg-slate-750">
                  <td className="p-4">
                    <div className="font-medium text-white">{aff.full_name || 'No Name'}</div>
                    <div className="text-xs text-slate-500">{aff.email}</div>
                    <div className="text-xs text-slate-500">{aff.phone}</div>
                  </td>
                  <td className="p-4">
                    <span className="font-mono bg-slate-900 px-2 py-1 rounded text-accent">{aff.affiliate_code}</span>
                  </td>
                  <td className="p-4">
                     {aff.bank_name ? (
                        <div className="text-sm">
                           <div className="font-bold text-slate-300">{aff.bank_name}</div>
                           <div className="font-mono text-slate-400">{aff.bank_number}</div>
                           <div className="text-xs text-slate-500">a.n {aff.bank_holder}</div>
                        </div>
                     ) : (
                        <span className="text-xs text-yellow-600 bg-yellow-900/20 px-2 py-1 rounded flex items-center gap-1 w-fit">
                           <AlertCircle size={10} /> Belum diatur
                        </span>
                     )}
                  </td>
                  <td className="p-4">
                    <span className={`font-bold ${aff.balance && aff.balance > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                        {formatRupiah(aff.balance || 0)}
                    </span>
                  </td>
                  <td className="p-4">
                    <button 
                       onClick={() => handlePayout(aff.id, aff.balance || 0)}
                       className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                       disabled={!aff.balance || aff.balance <= 0}
                    >
                       <DollarSign size={14} /> Bayar & Reset
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg text-sm text-blue-200">
        <h4 className="font-bold flex items-center gap-2 mb-2"><CheckCircle size={16} /> Info Pembayaran</h4>
        <p>
            Sistem ini hanya mencatat saldo. Pembayaran komisi harus dilakukan secara manual (Transfer Bank/E-Wallet) ke rekening user yang tertera. 
            Setelah transfer berhasil, tekan tombol <strong>Bayar & Reset</strong> untuk mengembalikan saldo user menjadi 0 di aplikasi.
        </p>
      </div>
    </div>
  );
};

export default AdminAffiliates;
