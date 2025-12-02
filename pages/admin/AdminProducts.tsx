
import React, { useEffect, useState } from 'react';
import { getSupabase } from '../../services/supabase';
import { Product } from '../../types';
import { Plus, Edit, Trash2, X, Upload, Loader2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { formatRupiah } from '../../services/helpers';

const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    discount_price: 0,
    category: '',
    image_url: '',
    file_url: ''
  });

  const supabase = getSupabase();

  const fetchProducts = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const payload = {
       ...formData,
       discount_price: formData.discount_price || null,
       is_active: true
    };

    try {
      if (editingId) {
        await supabase.from('products').update(payload).eq('id', editingId);
      } else {
        await supabase.from('products').insert(payload);
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      alert("Gagal menyimpan produk: " + error.message);
    }
  };

  const handleEdit = (p: Product) => {
    setFormData({
      name: p.name,
      description: p.description || '',
      price: p.price,
      discount_price: p.discount_price || 0,
      category: p.category || '',
      image_url: p.image_url || '',
      file_url: p.file_url || ''
    });
    setEditingId(p.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Hapus produk ini?') && supabase) {
      await supabase.from('products').delete().eq('id', id);
      fetchProducts();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', price: 0, discount_price: 0, category: '', image_url: '', file_url: '' });
    setEditingId(null);
    setUploadStatus('');
  };

  // Helper to convert file/blob to Base64
  const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Helper to resize image client-side before upload
  const resizeImage = (file: File, maxWidth: number = 800): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg', 0.7); // Compress to JPEG 70% quality
      };
      img.onerror = reject;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'image_url' | 'file_url') => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      
      try {
          let fileToUpload: File | Blob = file;
          let fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;

          // Only resize if it is the product image (not the downloadable file)
          if (field === 'image_url' && file.type.startsWith('image/')) {
             setUploadStatus('Mengompres gambar...');
             try {
                fileToUpload = await resizeImage(file);
                // Change extension to jpg as we compressed to jpeg
                fileName = fileName.replace(/\.[^/.]+$/, "") + ".jpg";
             } catch (resizeErr) {
                console.warn("Resize failed, using original", resizeErr);
             }
          }

          setUploadStatus('Mengupload ke server...');

          // 1. Try Supabase Storage first
          const bucket = field === 'image_url' ? 'images' : 'files';
          
          const { data, error } = await supabase!.storage.from(bucket).upload(fileName, fileToUpload);
          
          if (!error && data) {
              // Success uploading to storage
              const { data: { publicUrl } } = supabase!.storage.from(bucket).getPublicUrl(fileName);
              setFormData(prev => ({ ...prev, [field]: publicUrl }));
          } else {
              // 2. Storage failed (Bucket missing or permissions), Fallback to Base64
              console.warn(`Storage upload failed (${error?.message}), falling back to Base64.`);
              
              if (field === 'file_url' && file.size > 2 * 1024 * 1024) {
                 alert("File terlalu besar untuk disimpan langsung di database (>2MB). Mohon setup Storage Bucket di Supabase atau gunakan link Google Drive.");
                 throw new Error("File too big for Base64 fallback");
              }

              setUploadStatus('Menyimpan ke database...');
              const base64 = await fileToBase64(fileToUpload);
              setFormData(prev => ({ ...prev, [field]: base64 }));
          }
      } catch (err: any) {
          console.error("Upload critical error", err);
          if (!err.message.includes("File too big")) {
             try {
                // Last resort fallback
                const base64 = await fileToBase64(file);
                setFormData(prev => ({ ...prev, [field]: base64 }));
             } catch(e) {
                alert("Gagal memproses file. Silakan gunakan link manual.");
             }
          }
      } finally {
          setUploading(false);
          setUploadStatus('');
      }
  };

  return (
    <div className="py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manajemen Produk</h1>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} /> Tambah Produk
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
            <tr>
              <th className="p-4">Nama</th>
              <th className="p-4">Kategori</th>
              <th className="p-4">Harga</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-750">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src={p.image_url || 'https://via.placeholder.com/150'} 
                      className="w-10 h-10 rounded object-cover bg-slate-700" 
                      alt="" 
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Img'; }}
                    />
                    <span className="font-medium">{p.name}</span>
                    {!p.is_active && <span className="text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded">Nonaktif</span>}
                  </div>
                </td>
                <td className="p-4 text-slate-300">{p.category}</td>
                <td className="p-4 text-slate-300">{formatRupiah(p.price)}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(p)} className="p-2 text-blue-400 hover:bg-slate-700 rounded"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 text-red-400 hover:bg-slate-700 rounded"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
            <div className="p-8 text-center text-slate-500">
                Belum ada produk.
            </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-800 z-10">
              <h2 className="text-xl font-bold">{editingId ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                   <label className="block text-sm font-medium mb-1">Nama Produk</label>
                   <input required type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                
                <div className="col-span-2 md:col-span-1">
                   <label className="block text-sm font-medium mb-1">Harga (Rp)</label>
                   <input required type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" value={formData.price} onChange={e => setFormData({...formData, price: parseInt(e.target.value)})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                   <label className="block text-sm font-medium mb-1">Harga Diskon (Opsional)</label>
                   <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" value={formData.discount_price} onChange={e => setFormData({...formData, discount_price: parseInt(e.target.value)})} />
                </div>

                <div className="col-span-2 md:col-span-1">
                   <label className="block text-sm font-medium mb-1">Kategori</label>
                   <input list="categories" className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                   <datalist id="categories">
                     <option value="Software" />
                     <option value="Course" />
                     <option value="E-Book" />
                     <option value="Template" />
                     <option value="Premium Account" />
                   </datalist>
                </div>

                <div className="col-span-2">
                   <label className="block text-sm font-medium mb-1">Deskripsi</label>
                   <textarea rows={4} className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>

                {/* IMAGE UPLOAD SECTION */}
                <div className="col-span-2">
                   <label className="block text-sm font-medium mb-1">Gambar Produk</label>
                   
                   <div className="flex flex-col gap-3">
                     <div className="flex gap-2 items-start">
                       <input 
                          type="text" 
                          className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-sm focus:ring-1 focus:ring-primary outline-none" 
                          placeholder="https://... (atau upload file)" 
                          value={formData.image_url} 
                          onChange={e => setFormData({...formData, image_url: e.target.value})} 
                       />
                       <label className={`bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded cursor-pointer flex items-center gap-2 transition-colors flex-shrink-0 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                          {uploading && formData.image_url === '' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          <span className="text-sm">Upload</span>
                          <input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={(e) => handleFileUpload(e, 'image_url')} />
                       </label>
                     </div>
                     
                     {uploading && uploadStatus && (
                        <div className="text-xs text-primary animate-pulse flex items-center gap-1">
                           <Loader2 size={12} className="animate-spin" /> {uploadStatus}
                        </div>
                     )}
                     
                     {/* Preview Image */}
                     {formData.image_url && !formData.image_url.startsWith('data:application') && (
                       <div className="relative w-full h-32 bg-slate-900 rounded border border-slate-700 overflow-hidden flex items-center justify-center">
                          <img 
                            src={formData.image_url} 
                            alt="Preview" 
                            className="h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
                          />
                          <div className="absolute bottom-1 right-1 bg-black/60 px-2 py-1 rounded text-xs text-white">Preview</div>
                       </div>
                     )}
                   </div>
                </div>

                {/* FILE UPLOAD SECTION */}
                <div className="col-span-2">
                   <label className="block text-sm font-medium mb-1">Link File Produk / Download</label>
                   <div className="flex gap-2">
                     <input 
                        type="text" 
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" 
                        placeholder="https://drive.google.com/..." 
                        value={formData.file_url} 
                        onChange={e => setFormData({...formData, file_url: e.target.value})} 
                      />
                      <label className={`bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded cursor-pointer flex items-center ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploading && !formData.image_url ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        <input type="file" className="hidden" disabled={uploading} onChange={(e) => handleFileUpload(e, 'file_url')} />
                     </label>
                   </div>
                   <p className="text-[10px] text-slate-500 mt-1">
                      <AlertCircle size={10} className="inline mr-1" />
                      Untuk file besar {">"} 2MB, disarankan menggunakan link Google Drive/Dropbox.
                   </p>
                </div>
              </div>
              
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-700 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Batal</button>
                <button 
                  type="submit" 
                  disabled={uploading}
                  className="px-6 py-2 bg-primary hover:bg-blue-600 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {uploading ? 'Memproses...' : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
