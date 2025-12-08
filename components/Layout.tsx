
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, User, List, Settings, LogOut, Menu, X, BarChart, LayoutDashboard, Users, ClipboardList, Ticket, LogIn, ChevronRight } from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { getSupabase } from '../services/supabase';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;
  cartCount: number;
}

const Layout: React.FC<LayoutProps> = ({ children, user, setUser, cartCount }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const supabase = getSupabase();

  // TRACK AFFILIATE REFERRAL CODE
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refCode = params.get('ref');
    if (refCode) {
      localStorage.setItem('digitalstore_referral', refCode.toUpperCase());
    }
  }, [location]);

  // Close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  const handleLogout = async () => {
    if (supabase) {
      await (supabase.auth as any).signOut();
      setUser(null);
      navigate('/login');
    }
  };

  const isAdmin = user?.role === UserRole.ADMIN;

  const navLinks = [
    { name: 'Toko', path: '/', icon: <Home size={20} /> },
    { name: 'Kategori', path: '/categories', icon: <List size={20} /> },
    { name: 'Keranjang', path: '/cart', icon: <ShoppingBag size={20} />, badge: cartCount },
    { name: 'Akun', path: user ? '/profile' : '/login', icon: user ? <User size={20} /> : <LogIn size={20} /> },
  ];

  const adminLinks = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Pesanan', path: '/admin/orders', icon: <ClipboardList size={20} /> },
    { name: 'Produk', path: '/admin/products', icon: <ShoppingBag size={20} /> },
    { name: 'Voucher', path: '/admin/vouchers', icon: <Ticket size={20} /> },
    { name: 'Affiliate', path: '/admin/affiliates', icon: <Users size={20} /> },
    { name: 'Pengaturan', path: '/admin/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-16 md:pb-0">
      {/* Top Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/95 border-b border-slate-800 backdrop-blur shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Toggle - Force Visible */}
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden flex items-center justify-center text-white bg-slate-800 p-2 rounded-lg hover:bg-slate-700 active:bg-slate-600 transition-colors border border-slate-700"
                aria-label="Buka Menu"
              >
                <Menu size={24} />
              </button>

              <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
                <ShoppingBag className="text-primary" />
                <span className="hidden sm:inline">DigitalStorePro</span>
                <span className="sm:hidden">Store</span>
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-4">
                {navLinks.map((link) => (
                   link.name !== 'Kategori' && link.name !== 'Akun' && ( 
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`px-3 py-2 rounded-md text-sm font-medium hover:text-primary transition-colors ${location.pathname === link.path ? 'text-primary' : 'text-slate-400'}`}
                    >
                      <div className="flex items-center gap-2">
                         {link.name}
                         {link.badge ? <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{link.badge}</span> : null}
                      </div>
                    </Link>
                   )
                ))}
                
                {user ? (
                   <Link
                      to="/profile"
                      className={`px-3 py-2 rounded-md text-sm font-medium hover:text-primary transition-colors ${location.pathname === '/profile' ? 'text-primary' : 'text-slate-400'}`}
                    >
                      Akun
                    </Link>
                ) : (
                   <Link
                      to="/login"
                      className="px-4 py-1.5 rounded-full bg-slate-800 hover:bg-primary text-white text-sm font-medium transition-colors"
                    >
                      Login
                    </Link>
                )}

                {/* Desktop Admin Links */}
                {isAdmin && (
                  <div className="flex items-center border-l border-slate-700 pl-4 space-x-2">
                    <span className="text-xs text-slate-500 font-bold px-2">ADMIN</span>
                    {adminLinks.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`px-3 py-2 rounded-md text-sm font-medium hover:text-accent transition-colors ${location.pathname === link.path ? 'bg-slate-800 text-accent' : 'text-slate-400 hover:bg-slate-800'}`}
                      >
                        {link.name}
                      </Link>
                    ))}
                  </div>
                )}

                {user && (
                  <button
                    onClick={handleLogout}
                    className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-2 rounded-md text-sm transition-colors ml-4"
                  >
                    Logout
                  </button>
                )}
            </div>
            
            {/* Mobile Cart Icon (Right Side) */}
             <div className="md:hidden flex items-center">
                 <Link to="/cart" className="relative p-2 text-slate-300 hover:text-white transition-colors">
                    <ShoppingBag size={24} />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-slate-900">
                        {cartCount}
                      </span>
                    )}
                 </Link>
             </div>
          </div>
        </div>
      </nav>

      {/* MOBILE SIDEBAR (DRAWER) */}
      {/* Increased Z-Index to ensure it's on top of everything */}
      <div 
        className={`fixed inset-0 z-[100] flex md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
           {/* Overlay */}
           <div 
             className="absolute inset-0 bg-black/80 backdrop-blur-sm"
             onClick={() => setIsSidebarOpen(false)}
           ></div>
           
           {/* Sidebar Content */}
           <div className={`relative bg-slate-900 w-4/5 max-w-xs h-full shadow-2xl flex flex-col border-r border-slate-800 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                 <span className="font-bold text-xl text-white flex items-center gap-2">
                    <ShoppingBag className="text-primary" size={20} /> Menu
                 </span>
                 <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full">
                    <X size={20} />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                 {/* Main Navigation */}
                 <div className="mb-6">
                    <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Menu Utama</p>
                    {navLinks.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${location.pathname === link.path ? 'bg-primary/10 text-primary' : 'text-slate-300 hover:bg-slate-800'}`}
                      >
                        <div className="flex items-center gap-3">
                           {link.icon}
                           {link.name}
                        </div>
                        <ChevronRight size={16} className="text-slate-600" />
                      </Link>
                    ))}
                 </div>

                 {/* Admin Navigation (Mobile) */}
                 {isAdmin && (
                   <div className="mb-6">
                      <p className="px-4 text-xs font-bold text-accent uppercase tracking-wider mb-2">Administrator</p>
                      {adminLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${location.pathname === link.path ? 'bg-slate-800 text-accent' : 'text-slate-300 hover:bg-slate-800'}`}
                        >
                           <div className="flex items-center gap-3">
                              {link.icon}
                              {link.name}
                           </div>
                           <ChevronRight size={16} className="text-slate-600" />
                        </Link>
                      ))}
                   </div>
                 )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950">
                 {user ? (
                   <button 
                     onClick={handleLogout}
                     className="w-full flex items-center justify-center gap-2 bg-red-600/10 text-red-500 py-3 rounded-lg hover:bg-red-600 hover:text-white transition-colors font-semibold"
                   >
                      <LogOut size={18} /> Logout
                   </button>
                 ) : (
                   <Link 
                     to="/login"
                     onClick={() => setIsSidebarOpen(false)}
                     className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-bold"
                   >
                     <LogIn size={18} /> Login / Daftar
                   </Link>
                 )}
              </div>
           </div>
      </div>

      {/* Main Content */}
      <main className="pt-20 px-4 max-w-7xl mx-auto min-h-[85vh]">
        {children}
      </main>

      {/* Mobile Bottom Navigation (Fixed) */}
      <div className="md:hidden fixed bottom-0 w-full bg-slate-900 border-t border-slate-800 z-40 pb-safe safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.5)]">
        <div className="grid grid-cols-4 h-16">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex flex-col items-center justify-center space-y-1 ${location.pathname === link.path ? 'text-primary' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <div className="relative">
                {link.icon}
                {link.badge ? (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[1.2rem] h-[1.2rem] font-bold shadow-sm border border-slate-900">
                    {link.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] font-medium">{link.name === 'Akun' && !user ? 'Login' : link.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Layout;
