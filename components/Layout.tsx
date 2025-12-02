
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, User, List, Settings, LogOut, Menu, X, BarChart, LayoutDashboard, Users } from 'lucide-react';
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

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      navigate('/login');
    }
  };

  const isAdmin = user?.role === UserRole.ADMIN;

  const navLinks = [
    { name: 'Toko', path: '/', icon: <Home size={20} /> },
    { name: 'Kategori', path: '/categories', icon: <List size={20} /> },
    { name: 'Keranjang', path: '/cart', icon: <ShoppingBag size={20} />, badge: cartCount },
    { name: 'Akun', path: '/profile', icon: <User size={20} /> },
  ];

  const adminLinks = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Produk', path: '/admin/products', icon: <ShoppingBag size={20} /> },
    { name: 'Affiliate', path: '/admin/affiliates', icon: <Users size={20} /> },
    { name: 'Pengaturan', path: '/admin/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-16 md:pb-0">
      {/* Top Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/95 border-b border-slate-800 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
                <ShoppingBag className="text-primary" />
                <span className="hidden sm:inline">DigitalStorePro</span>
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Only show navigation links if user is logged in */}
              {user && navLinks.map((link) => (
                 link.name !== 'Kategori' && ( 
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

              {user ? (
                <button
                  onClick={handleLogout}
                  className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-2 rounded-md text-sm transition-colors ml-4"
                >
                  Logout
                </button>
              ) : (
                <Link to="/login" className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium">
                  Login / Daftar
                </Link>
              )}
            </div>

            {/* Mobile Admin Toggle (if admin) */}
            {isAdmin && (
              <div className="md:hidden flex items-center">
                 <Link to="/admin/dashboard" className="text-accent bg-slate-800 p-2 rounded-full mr-2">
                    <LayoutDashboard size={20} />
                 </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 px-4 max-w-7xl mx-auto min-h-[85vh]">
        {children}
      </main>

      {/* Mobile Bottom Navigation (Fixed) - Only Show if Logged In */}
      {user && (
        <div className="md:hidden fixed bottom-0 w-full bg-slate-900 border-t border-slate-800 z-50 pb-safe safe-area-bottom">
          <div className="grid grid-cols-4 h-16">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex flex-col items-center justify-center space-y-1 ${location.pathname === link.path ? 'text-primary' : 'text-slate-400'}`}
              >
                <div className="relative">
                  {link.icon}
                  {link.badge ? (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center justify-center">
                      {link.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px]">{link.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
