
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { getSupabase, getStoredConfig, initSupabase } from './services/supabase';
import { UserRole, UserProfile, CartItem, Product, StoreSettings } from './types';

// Pages
import HomePage from './pages/HomePage';
import ProductDetail from './pages/ProductDetail';
import CartPage from './pages/CartPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAffiliates from './pages/admin/AdminAffiliates';
import SetupPage from './pages/SetupPage';

const DEFAULT_SETTINGS: StoreSettings = {
  store_name: 'Digital Store',
  store_description: 'Pusat Produk Digital Terbaik',
  whatsapp_number: '',
  email_contact: '',
  address: '',
  bank_accounts: [],
  qris_url: ''
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [dbConfigured, setDbConfigured] = useState(false);

  // Separate session check logic
  const checkSession = async () => {
    try {
      const supabase = getSupabase();
      if (!supabase) {
        // If config exists but client fails, likely invalid config
        // Verify if config exists in storage
        if (!getStoredConfig()) {
           setDbConfigured(false);
        }
        return;
      }

      // Check Session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (session) {
        // Fetch Profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          setUser({ ...profile, email: session.user.email! });
          
          // AUTO-PROMOTE LOGIC: If this is the only user, make them admin
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
          if (count === 1 && profile.role !== 'admin') {
             const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', session.user.id);
             if (!error) setUser({ ...profile, role: UserRole.ADMIN, email: session.user.email! });
          }
        }
      }
      
      // Fetch Settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'store_settings')
        .single();
        
      if (settingsData) {
        setSettings(settingsData.value);
      }

    } catch (error) {
      console.error("Session check error:", error);
    } finally {
      // CRITICAL: Always stop loading, regardless of success or failure
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if Supabase is configured
    const config = getStoredConfig();
    if (!config) {
      setDbConfigured(false);
      setLoading(false);
      return;
    }
    
    // Attempt init
    const client = initSupabase();
    if (!client) {
      setDbConfigured(false);
      setLoading(false);
      return;
    }

    setDbConfigured(true);
    checkSession();

    // Listen for auth changes
    const { data: authListener } = client.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
          // Slight delay to ensure profile is created if this is a signup event
          setTimeout(async () => {
             const { data: profile } = await client
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
             if(profile) setUser({ ...profile, email: session.user.email! });
          }, 500);
      } else {
        setUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };

  }, [dbConfigured]); 

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) return prev; // Digital products usually single qty
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const clearCart = () => setCart([]);

  const updateSettings = (newSettings: StoreSettings) => {
    setSettings(newSettings);
    // Persist to DB if possible
    const supabase = getSupabase();
    if (supabase && user?.role === UserRole.ADMIN) {
      supabase.from('settings').upsert({
        key: 'store_settings',
        value: newSettings
      }).then(({ error }) => {
        if (error) console.error("Error saving settings", error);
      });
    }
  };

  const handleConfigured = () => {
    // Re-initialize Supabase client immediately
    initSupabase();
    setLoading(true); // Show loading while we verify connection/session
    setDbConfigured(true);
    // Effect will trigger checkSession
  };

  if (!dbConfigured) {
    return <SetupPage onConfigured={handleConfigured} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Router>
      <Layout user={user} setUser={setUser} cartCount={cart.length}>
        <Routes>
          {/* Main Route Logic: If logged in, show Home. If not, Redirect to Login */}
          <Route 
            path="/" 
            element={user ? <HomePage addToCart={addToCart} settings={settings} /> : <Navigate to="/login" replace />} 
          />
          
          <Route 
            path="/product/:id" 
            element={user ? <ProductDetail addToCart={addToCart} /> : <Navigate to="/login" replace />} 
          />
          
          <Route 
            path="/cart" 
            element={user ? <CartPage cart={cart} removeFromCart={removeFromCart} clearCart={clearCart} user={user} settings={settings} /> : <Navigate to="/login" replace />} 
          />
          
          {/* Auth Route: If logged in, Redirect to Home. If not, show AuthPage */}
          <Route 
            path="/login" 
            element={!user ? <AuthPage onLoginSuccess={checkSession} /> : <Navigate to="/" replace />} 
          />
          
          <Route 
            path="/profile" 
            element={user ? <ProfilePage user={user} /> : <Navigate to="/login" replace />} 
          />
          
          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={user?.role === UserRole.ADMIN ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="/admin/products" element={user?.role === UserRole.ADMIN ? <AdminProducts /> : <Navigate to="/" />} />
          <Route path="/admin/settings" element={user?.role === UserRole.ADMIN ? <AdminSettings settings={settings} onUpdate={updateSettings} /> : <Navigate to="/" />} />
          <Route path="/admin/affiliates" element={user?.role === UserRole.ADMIN ? <AdminAffiliates /> : <Navigate to="/" />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
