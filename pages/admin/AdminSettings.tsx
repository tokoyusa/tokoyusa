
import React, { useState } from 'react';
import { StoreSettings } from '../../types';
import { Save, RefreshCw, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../../services/supabase';

interface AdminSettingsProps {
  settings: StoreSettings;
  onUpdate: (s: StoreSettings) => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ settings, onUpdate }) => {
  const [localSettings, setLocalSettings] = useState<StoreSettings>(settings);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const supabase = getSupabase();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, key: keyof StoreSettings) => {
    setLocalSettings({ ...localSettings, [key]: e.target.value });
  };
  
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>, key: keyof StoreSettings) => {
     setLocalSettings({ ...localSettings, [key]: parseFloat(e.target.value) || 0 });
  };

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

  const saveAll = () => {
    onUpdate(localSettings);
    alert('Pengaturan disimpan!');
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
        }, 'image/jpeg', 0.5);
      };
      img.onerror = reject;
    });
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setUploading(true);
    try {
      const resizedBlob = await resizeImage(file, 400);
      const fileName = `qris_${Date.now()}.jpg`;

      const { data, error } = await supabase.storage.from('images').upload(fileName, resizedBlob);

      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
        setLocalSettings(prev => ({ ...prev, qris_url: publicUrl }));
      } else {
        console.warn("QRIS Storage upload failed, using Base64 fallback.");
        const base64 = await fileToBase64(resizedBlob);
        setLocalSettings(prev => ({ ...prev, qris_url: base64 }));
      }
    } catch (err) {
      console.error("Error uploading QRIS", err);
      alert("Gagal memproses gambar.");
    } finally {
      setUploading(false);
    }
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
            <label className="block text-sm mb-1">Komisi Affiliate (%)</label>
            <p className="text-xs text-slate-400 mb-2">Persentase yang diterima affiliate dari total harga pesanan user yang direferensikan.</p>
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
          </div>
        </div>

        {/* Payment Banks */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-700 pb-2">
             <h2 className="text-lg font-bold">Rekening Bank Manual</h2>
             <button onClick={addBank} className="text-xs bg-slate-700 px-2 py-1 rounded hover:bg-slate-600">Tambah</button>
          </div>
          
          {localSettings.bank_accounts.map((bank, i) => (
            <div key={i} className="bg-slate-900 p-3 rounded flex flex-col gap-2 relative group">
               <button onClick={() => removeBank(i)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100">Hapus</button>
               <input placeholder="Nama Bank (BCA/BRI)" className="bg-transparent border-b border-slate-700 p-1" value={bank.bank} onChange={(e) => handleBankChange(i, 'bank', e.target.value)} />
               <input placeholder="Nomor Rekening" className="bg-transparent border-b border-slate-700 p-1" value={bank.number} onChange={(e) => handleBankChange(i, 'number', e.target.value)} />
               <input placeholder="Atas Nama" className="bg-transparent border-b border-slate-700 p-1" value={bank.name} onChange={(e) => handleBankChange(i, 'name', e.target.value)} />
            </div>
          ))}
          
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
                  <input 
                    type="text" 
                    className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-400" 
                    value={localSettings.qris_url || ''} 
                    onChange={(e) => handleChange(e, 'qris_url')} 
                    placeholder="Link gambar..."
                    disabled={uploading}
                  />
                  <label className={`bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded cursor-pointer flex items-center gap-2 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    <span className="text-sm hidden sm:inline">Upload</span>
                    <input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={handleQrisUpload} />
                  </label>
               </div>
             </div>
          </div>
        </div>
        
        {/* Database */}
         <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-bold border-b border-slate-700 pb-2">Database Connection</h2>
          <p className="text-sm text-slate-400">Database saat ini terhubung.</p>
          <button onClick={resetDatabase} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
             <RefreshCw size={14} /> Reset Koneksi Database
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
