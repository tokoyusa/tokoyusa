
import React, { useState } from 'react';
import { getSupabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Lock, User as UserIcon, Ticket } from 'lucide-react';

interface AuthPageProps {
  onLoginSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Helper to ensure profile exists and has correct role
  const ensureProfile = async (userId: string, userEmail: string, metaName: string, refCode?: string) => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      // 1. Check if profile already exists
      const { data: existing, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // 2. Check total users count to determine if this should be Admin
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // LOGIC: If profile exists
      if (existing) {
        // SELF-HEALING: If this is the ONLY user in the DB but is 'user', promote to 'admin'
        if (count === 1 && existing.role !== 'admin') {
           await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);
        }
        return;
      }

      // LOGIC: If profile does NOT exist (create it)
      const isFirstUser = !count || count === 0;
      const role = isFirstUser ? 'admin' : 'user';

      const payload: any = {
        id: userId,
        email: userEmail,
        full_name: metaName || userEmail.split('@')[0],
        role: role
      };

      // Only add referred_by if it's provided and valid string
      if (refCode && refCode.trim() !== '') {
        payload.referred_by = refCode.trim().toUpperCase();
      }

      const { error: insertError } = await supabase.from('profiles').insert(payload);

      if (insertError) {
        console.error("Failed to create profile:", insertError);
      }
    } catch (err) {
      console.error("Profile check error:", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      if (isLogin) {
        // LOGIN FLOW
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Ensure profile exists
        if (data.user) {
          await ensureProfile(data.user.id, email, data.user.user_metadata.full_name);
        }
      } else {
        // SIGNUP FLOW
        const { data, error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: { data: { full_name: fullName } } 
        });
        if (error) throw error;

        // Create profile immediately
        if (data.user && data.session) {
             await ensureProfile(data.user.id, email, fullName, referralCode);
        } else if (data.user && !data.session) {
             // Email Confirmation Enabled
             alert("Pendaftaran berhasil! Silakan cek email Anda untuk konfirmasi sebelum login.");
             setIsLogin(true); 
             setLoading(false);
             return;
        }
      }
      
      await onLoginSuccess();
      
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl"></div>

        <div className="flex justify-center mb-6 relative z-10">
           <div className="bg-slate-900 p-4 rounded-full border border-slate-700 shadow-lg">
             <ShoppingBag className="text-primary w-10 h-10" />
           </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-2 text-white">
          {isLogin ? 'Selamat Datang Kembali' : 'Bergabung Sekarang'}
        </h2>
        <p className="text-center text-slate-400 mb-8 text-sm">
          {isLogin ? 'Masuk untuk mengelola pesanan Anda' : 'Buat akun untuk mulai berbelanja'}
        </p>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4 relative z-10">
          {!isLogin && (
            <div className="relative">
              <UserIcon className="absolute left-3 top-3.5 text-slate-500" size={18} />
              <input 
                type="text" 
                required 
                placeholder="Nama Lengkap"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>
          )}
          
          <div className="relative">
            <UserIcon className="absolute left-3 top-3.5 text-slate-500" size={18} />
            <input 
              type="email" 
              required 
              placeholder="Email Address"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-slate-500" size={18} />
            <input 
              type="password" 
              required 
              minLength={6}
              placeholder="Password"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {!isLogin && (
             <div className="relative">
                <Ticket className="absolute left-3 top-3.5 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Kode Referral (Opsional)"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all uppercase" 
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value)}
                />
             </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-blue-500/25 mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Memproses...
              </span>
            ) : (isLogin ? 'Masuk' : 'Daftar')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-700/50 text-center relative z-10">
          <p className="text-sm text-slate-400">
            {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              className="text-primary hover:text-blue-400 font-bold ml-1 transition-colors"
            >
              {isLogin ? 'Daftar Sekarang' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
