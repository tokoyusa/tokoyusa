
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSupabase } from '../services/supabase';
import { Product } from '../types';
import { formatRupiah } from '../services/helpers';
import { ShoppingCart, ArrowLeft, Share2 } from 'lucide-react';

interface ProductDetailProps {
  addToCart: (product: Product) => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ addToCart }) => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProduct = async () => {
      const supabase = getSupabase();
      if (!supabase || !id) return;
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
        
      if (!error) setProduct(data);
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!product) return <div className="p-8 text-center text-slate-400">Produk tidak ditemukan</div>;

  const finalPrice = product.discount_price || product.price;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <button onClick={() => navigate(-1)} className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={20} className="mr-2" /> Kembali
      </button>

      <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-xl flex flex-col md:flex-row">
        <div className="md:w-1/2 bg-slate-700 min-h-[300px] relative flex items-center justify-center">
          <img 
            src={product.image_url || 'https://via.placeholder.com/600x600?text=No+Image'} 
            alt={product.name} 
            className="w-full h-full object-cover"
            onError={(e) => {
               (e.target as HTMLImageElement).onerror = null;
               (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x600?text=Error+Loading';
            }}
          />
        </div>
        
        <div className="p-6 md:w-1/2 flex flex-col">
          <div className="mb-4">
             <span className="inline-block px-2 py-1 bg-slate-900 text-primary text-xs rounded mb-2 font-semibold uppercase tracking-wider">{product.category}</span>
             <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">{product.name}</h1>
          </div>

          <div className="prose prose-invert text-slate-300 mb-6 text-sm flex-1 overflow-y-auto max-h-[300px] pr-2">
            <p className="whitespace-pre-line">{product.description}</p>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mt-auto">
            <div className="flex items-end gap-3 mb-4">
              <span className="text-3xl font-bold text-white">{formatRupiah(finalPrice)}</span>
              {product.discount_price && (
                <span className="text-lg text-slate-500 line-through mb-1">{formatRupiah(product.price)}</span>
              )}
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => addToCart(product)}
                className="flex-1 bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <ShoppingCart size={20} />
                Beli Sekarang
              </button>
              <button 
                 onClick={() => {
                   navigator.share({ title: product.name, url: window.location.href }).catch(()=> alert('Link disalin: ' + window.location.href));
                 }}
                 className="px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center justify-center transition-colors"
                 title="Bagikan"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
