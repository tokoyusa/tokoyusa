
import React, { useEffect, useState } from 'react';
import { getSupabase } from '../services/supabase';
import { Product, StoreSettings } from '../types';
import { Search, ShoppingCart, ImageOff } from 'lucide-react';
import { formatRupiah } from '../services/helpers';
import { Link } from 'react-router-dom';

interface HomePageProps {
  addToCart: (product: Product) => void;
  settings: StoreSettings;
}

const HomePage: React.FC<HomePageProps> = ({ addToCart, settings }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const supabase = getSupabase();
      if (!supabase) return;

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const validProducts = data as Product[];
        setProducts(validProducts);
        // Fix for type inference on categories
        const categoryList = validProducts
          .map((p) => p.category)
          .filter((c): c is string => typeof c === 'string' && c.length > 0);
        const uniqueCats = Array.from(new Set(categoryList));
        setCategories(['All', ...uniqueCats]);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (categoryFilter === 'All' || p.category === categoryFilter)
  );

  return (
    <div className="pb-12">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 mb-8 text-center sm:text-left border border-slate-700 relative overflow-hidden hidden md:block">
        <div className="relative z-10">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">{settings.store_name}</h1>
          <p className="text-slate-300 text-lg mb-6 max-w-2xl">{settings.store_description}</p>
          <div className="inline-flex gap-2">
            <button 
              onClick={() => document.getElementById('products-grid')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-primary hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full transition-transform transform hover:scale-105"
            >
              Belanja Sekarang
            </button>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-primary/10 skew-x-12 transform translate-x-12"></div>
      </div>
      
      {/* Mobile Title (Since Hero is hidden on small screens to save space) */}
      <div className="md:hidden mb-6 mt-2">
         <h1 className="text-2xl font-bold text-white">{settings.store_name}</h1>
         <p className="text-sm text-slate-400">{settings.store_description}</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between sticky top-16 md:top-20 z-40 bg-slate-900/95 py-3 backdrop-blur border-b border-slate-800 md:border-none">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari produk..."
            className="w-full bg-slate-800 border border-slate-700 rounded-full py-2 pl-9 pr-4 focus:ring-2 focus:ring-primary outline-none text-slate-200 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs md:text-sm whitespace-nowrap transition-colors border ${
                categoryFilter === cat 
                  ? 'bg-primary border-primary text-white' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div id="products-grid">
        {loading ? (
           <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-2 border-primary rounded-full border-t-transparent"></div></div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>Produk tidak ditemukan.</p>
          </div>
        ) : (
          /* GRID UPDATED HERE: grid-cols-2 on mobile, smaller gap */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-primary transition-colors group flex flex-col h-full shadow-sm">
                {/* Image Aspect Ratio: Square on mobile for better fit, Video on desktop */}
                <div className="relative aspect-square md:aspect-video overflow-hidden bg-slate-700 flex items-center justify-center">
                  <img 
                    src={product.image_url || 'https://via.placeholder.com/400x300?text=No+Image'} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).onerror = null; 
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Error';
                    }}
                  />
                  {product.discount_price && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] md:text-xs font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded shadow-md">
                      Promo
                    </div>
                  )}
                </div>
                
                {/* Content Padding Reduced on Mobile */}
                <div className="p-3 md:p-4 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1 md:mb-2">
                    <span className="text-[10px] md:text-xs text-primary font-medium uppercase tracking-wider truncate w-full">{product.category}</span>
                  </div>
                  
                  <Link to={`/product/${product.id}`} className="block">
                    <h3 className="text-sm md:text-lg font-bold text-slate-100 mb-1 md:mb-2 line-clamp-2 hover:text-primary transition-colors leading-tight">{product.name}</h3>
                  </Link>
                  
                  {/* Description hidden/removed as requested */}
                  
                  <div className="mt-auto">
                    <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 mb-2 md:mb-3">
                      {product.discount_price ? (
                        <>
                          <span className="text-sm md:text-xl font-bold text-white">{formatRupiah(product.discount_price)}</span>
                          <span className="text-[10px] md:text-sm text-slate-500 line-through">{formatRupiah(product.price)}</span>
                        </>
                      ) : (
                        <span className="text-sm md:text-xl font-bold text-white">{formatRupiah(product.price)}</span>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => addToCart(product)}
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-1.5 md:py-2 rounded-lg flex items-center justify-center gap-1 md:gap-2 transition-colors font-medium text-xs md:text-sm"
                    >
                      <ShoppingCart size={14} className="md:w-5 md:h-5" />
                      Tambah
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
