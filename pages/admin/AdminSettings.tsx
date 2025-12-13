
import React, { useState } from 'react';
import { StoreSettings } from '../../types';
import { Save, RefreshCw, Upload, Loader2, Image as ImageIcon, Wallet, Database, Terminal, AlertCircle, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabase, BANK_MIGRATION_SQL, COST_PRICE_MIGRATION_SQL, HISTORY_MIGRATION_SQL } from '../../services/supabase';

interface AdminSettingsProps {
  settings: StoreSettings;
  onUpdate: (s: StoreSettings) => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ settings, onUpdate }) => {
  const [localSettings, setLocalSettings] = useState<StoreSettings>({
      ...settings,
      e_wallets: settings.e_wallets || [] // Ensure it exists
  });
  const [uploading, setUploading] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [activeSql, setActiveSql] = useState('');
  const navigate = useNavigate();
  const supabase = getSupabase();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, key: keyof StoreSettings) => {
    setLocalSettings({ ...localSettings, [key]: e.target.value });
  };
  
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>, key: keyof StoreSettings) => {
     setLocalSettings({ ...localSettings, [key]: parseFloat(e.target.value) || 0 });
  };

  // --- Bank Helpers ---
  const handleBankChange = (index: number, field: string, value: string) => {
    const newBanks = [...localSettings.bank_accounts];
    newBanks[index] = { ...newBanks[index], [field]: value };
    setLocalSettings({ ...localSettings, bank_accounts: newBanks });
  };

  const addBank = () => {
    setLocalSettings({
      ...localSettings,
      bank_accounts: [...localSettings.bank_accounts, { bank: '', number: '', name: '' }]
    });
  };

  const removeBank = (index: number) => {
    const newBanks = localSettings.bank_accounts.filter((_, i) => i !== index);
    setLocalSettings({ ...localSettings, bank_accounts: newBanks });
  };

  // --- E-Wallet Helpers ---
  const handleWalletChange = (index: number, field: string, value: string) => {
    const newWallets = [...localSettings.e_wallets];
    newWallets[index] = { ...newWallets[index], [field]: value };
    setLocalSettings({ ...localSettings, e_wallets: newWallets });
  };

  const addWallet = () => {
    setLocalSettings({
      ...localSettings,
      e_wallets: [...localSettings.e_wallets, { provider: 'DANA', number: '', name: '' }]
    });
  };

  const removeWallet = (index: number) => {
    const newWallets = localSettings.e_wallets.filter((_, i) => i !== index);
    setLocalSettings({ ...localSettings, e_wallets: newWallets });
  };

  const saveAll = () => {
    onUpdate(localSettings);
    alert('Pengaturan disimpan! Jika Anda baru saja mengganti QRIS, mohon refresh halaman checkout untuk melihat perubahan.');
  };

  const resetDatabase = () => {
    if(confirm("Ini akan menghapus koneksi database dari browser ini. Lanjutkan?")) {
      localStorage.removeItem('digitalstore_supabase_config');
      window.location.reload();
    }
  }

  // --- Image Upload Helpers ---

  const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const resizeImage = (file: File, maxWidth: number = 400): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
             width = Math.round((width * maxWidth) / height);
             height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
           ctx.drawImage(img, 0, 0, width, height);
        }

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg', 0.6); // Kompresi JPEG 60%
      };
      img.onerror = reject;
    });
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Resize gambar agar ringan (max lebar 400px)
      const resizedBlob = await resizeImage(file, 400);
      
      // 2. Convert langsung ke Base64 (tanpa upload ke Storage bucket)
      const base64 = await fileToBase64(resizedBlob);
      
      setLocalSettings(prev => ({ ...prev, qris_url: base64 }));
    } catch (err) {
      console.error("Error processing QRIS", err);
      alert("Gagal memproses gambar. Pastikan format gambar valid (JPG/PNG).");
    } finally {
      setUploading(false);
    }
  };

  const showSqlModal = (sql: string) => {
      setActiveSql(sql);
      setShowSql(true);
  };

  return (
    <div className="py-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Pengaturan Toko</h1>
        <button onClick={saveAll} className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2">
          <Save size={20} /> Simpan Perubahan
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* General Info */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-bold border-b border-slate-700 pb-2">Informasi Umum</h2>
          <div>
            <label className="block text-sm mb-1">Nama Toko</label>
            <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2" value={localSettings.store_name} onChange={(e) => handleChange(e, 'store_name')} />
          </div>
          <div>
            <label className="block text-sm mb-1">Deskripsi</label>
            <textarea rows={3} className="w-full bg-slate-900 border border-slate-600 rounded p-2" value={localSettings.store_description} onChange={(e) => handleChange(e, 'store_description')} />
          </div>
          <div>
            <label className="block text-sm mb-1">Nomor WhatsApp Admin (628...)</label>
            <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2" value={localSettings.whatsapp_number} onChange={(e) => handleChange(e, 'whatsapp_number')} />
          </div>
        </div>

         {/* Affiliate Settings */}
         <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-bold border-b border-slate-700 pb-2">Pengaturan Affiliate</h2>
          <div>
            <label className="block text-sm mb-1">Komisi Affiliate (% dari PROFIT/Keuntungan)</label>
            <p className="text-xs text-slate-400 mb-2">Persentase yang diterima affiliate dari <strong>(Harga Jual - Harga Modal)</strong> per transaksi.</p>
            <div className="relative">
              <input 
                type="number" 
                min="0" 
                max="100"
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 pr-8" 
                value={localSettings.affiliate_commission_rate || 0} 
                onChange={(e) => handleNumberChange(e, 'affiliate_commission_rate')} 
              />
              <span className="absolute right-3 top-2 text-slate-400">%</span>
            </div>
            
            <div className="mt-4 bg-blue-500/10 p-3 rounded text-xs text-blue-300 border border-blue-500/20">
                <p className="font-bold flex items-center gap-1"><AlertCircle size={12}/> Info Penting:</p>
                <p>
                    Pastikan Anda mengisi <strong>Harga Modal</strong> di setiap produk. Jika Harga Modal = 0, maka Profit dianggap 100% dari harga jual.
                </p>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-6">
          {/* BANK ACCOUNTS */}
          <div>
            <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-4">
               <h2 className="text-lg font-bold">Rekening Bank Manual</h2>
               <button onClick={addBank} className="text-xs bg-slate-700 px-2 py-1 rounded hover:bg-slate-600">Tambah</button>
            </div>
            
            <div className="space-y-3">
              {localSettings.bank_accounts.map((bank, i) => (
                <div key={i} className="bg-slate-900 p-3 rounded flex flex-col gap-2 relative group border border-slate-800">
                   <button onClick={() => removeBank(i)} className="absolute top-2 right-2 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-slate-800 p-1 rounded">Hapus</button>
                   <input placeholder="Nama Bank (BCA/BRI)" className="bg-transparent border-b border-slate-700 p-1 focus:border-primary outline-none" value={bank.bank} onChange={(e) => handleBankChange(i, 'bank', e.target.value)} />
                   <input placeholder="Nomor Rekening" className="bg-transparent border-b border-slate-700 p-1 focus:border-primary outline-none" value={bank.number} onChange={(e) => handleBankChange(i, 'number', e.target.value)} />
                   <input placeholder="Atas Nama" className="bg-transparent border-b border-slate-700 p-1 focus:border-primary outline-none" value={bank.name} onChange={(e) => handleBankChange(i, 'name', e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* E-WALLETS */}
          <div>
            <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-4">
               <h2 className="text-lg font-bold flex items-center gap-2"><Wallet size={18}/> Pengaturan E-Wallet</h2>
               <button onClick={addWallet} className="text-xs bg-slate-700 px-2 py-1 rounded hover:bg-slate-600">Tambah</button>
            </div>
            
            <div className="space-y-3">
              {localSettings.e_wallets.map((wallet, i) => (
                <div key={i} className="bg-slate-900 p-3 rounded flex flex-col gap-2 relative group border border-slate-800">
                   <button onClick={() => removeWallet(i)} className="absolute top-2 right-2 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-slate-800 p-1 rounded">Hapus</button>
                   
                   <label className="text-xs text-slate-500">Provider</label>
                   <select 
                      className="bg-slate-800 border border-slate-700 rounded p-1 text-sm outline-none focus:border-primary"
                      value={wallet.provider}
                      onChange={(e) => handleWalletChange(i, 'provider', e.target.value)}
                   >
                     <option value="DANA">DANA</option>
                     <option value="OVO">OVO</option>
                     <option value="GOPAY">GOPAY</option>
                     <option value="SHOPEEPAY">SHOPEEPAY</option>
                     <option value="LINKAJA">LINKAJA</option>
                   </select>

                   <input placeholder="Nomor HP / E-Wallet" className="bg-transparent border-b border-slate-700 p-1 focus:border-primary outline-none" value={wallet.number} onChange={(e) => handleWalletChange(i, 'number', e.target.value)} />
                   <input placeholder="Atas Nama" className="bg-transparent border-b border-slate-700 p-1 focus:border-primary outline-none" value={wallet.name} onChange={(e) => handleWalletChange(i, 'name', e.target.value)} />
                </div>
              ))}
              {localSettings.e_wallets.length === 0 && <p className="text-slate-500 text-sm italic">Belum ada E-Wallet diatur.</p>}
            </div>
          </div>
          
          {/* QRIS */}
          <div className="pt-4 border-t border-slate-700">
             <label className="block text-sm mb-2 font-medium">Gambar QRIS</label>
             <div className="flex flex-col gap-3">
               {localSettings.qris_url && (
                  <div className="w-full h-48 bg-slate-900 rounded border border-slate-600 flex items-center justify-center overflow-hidden relative">
                    <img 
                      src={localSettings.qris_url} 
                      alt="QRIS Preview" 
                      className="h-full object-contain"
                      onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                    />
                  </div>
               )}
               <div className="flex gap-2 items-center">
                  <div className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-400 truncate">
                      {localSettings.qris_url ? (localSettings.qris_url.length > 50 ? 'Base64 Image (Tersimpan)' : localSettings.qris_url) : 'Belum ada gambar'}
                  </div>
                  <label className={`bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded cursor-pointer flex items-center gap-2 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    <span className="text-sm hidden sm:inline">Upload</span>
                    <input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={handleQrisUpload} />
                  </label>
               </div>
               <p className="text-[10px] text-slate-500">
                  *Tips: Upload ulang QRIS di sini jika di halaman checkout gambar tidak muncul. Gambar akan otomatis dikompres agar ringan.
               </p>
             </div>
          </div>
        </div>
        
        {/* Database & Tools */}
         <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4 h-fit">
          <h2 className="text-lg font-bold border-b border-slate-700 pb-2 flex items-center gap-2"><Database size={18}/> Tools & Database</h2>
          
          <div className="space-y-2">
             <button 
                onClick={() => showSqlModal(BANK_MIGRATION_SQL)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded flex items-center justify-start gap-2 text-sm"
             >
                <Terminal size={14} /> SQL: Profil & Bank
             </button>

             <button 
                onClick={() => showSqlModal(COST_PRICE_MIGRATION_SQL)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded flex items-center justify-start gap-2 text-sm font-bold"
             >
                <Terminal size={14} /> SQL: Update Harga Modal
             </button>

             <button 
                onClick={() => showSqlModal(HISTORY_MIGRATION_SQL)}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-2 rounded flex items-center justify-start gap-2 text-sm font-bold animate-pulse"
             >
                <History size={14} /> SQL: Fitur Riwayat Komisi (BARU)
             </button>
          </div>
          
          {showSql && (
             <div className="bg-slate-950 p-3 rounded text-xs font-mono text-green-400 relative">
                <div className="max-h-32 overflow-y-auto overflow-x-auto">
                    <pre>{activeSql}</pre>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                   <button 
                     onClick={() => {
                        navigator.clipboard.writeText(activeSql);
                        alert("Copied!");
                     }}
                     className="bg-slate-800 text-white px-2 py-1 rounded text-[10px]"
                   >
                      Copy
                   </button>
                   <button 
                     onClick={() => setShowSql(false)}
                     className="bg-red-500/50 text-white px-2 py-1 rounded text-[10px]"
                   >
                      Tutup
                   </button>
                </div>
             </div>
          )}

          <div className="border-t border-slate-700 pt-4 mt-4">
             <button onClick={resetDatabase} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
                <RefreshCw size={14} /> Reset Koneksi Database
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
