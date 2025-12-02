
import React, { useState } from 'react';
import { saveConfig, SQL_SCHEMA } from '../services/supabase';
import { Database, Copy, Check, ArrowRight, AlertTriangle } from 'lucide-react';

interface SetupPageProps {
  onConfigured: () => void;
}

const SetupPage: React.FC<SetupPageProps> = ({ onConfigured }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && key) {
      saveConfig({ url, anonKey: key });
      onConfigured();
    }
  };

  const copySQL = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-slate-200">
      <div className="max-w-2xl w-full bg-slate-800 rounded-lg p-8 shadow-xl border border-slate-700 my-8">
        <div className="flex items-center gap-3 mb-6">
          <Database className="text-primary w-8 h-8" />
          <h1 className="text-2xl font-bold">Setup Database</h1>
        </div>
        
        <p className="mb-6 text-slate-400">
          Aplikasi ini membutuhkan koneksi ke Supabase. Silakan buat project di <a href="https://supabase.com" target="_blank" className="text-primary underline">supabase.com</a> dan masukkan kredensial di bawah ini.
        </p>
        
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg mb-6 flex gap-3">
          <AlertTriangle className="text-yellow-500 flex-shrink-0" />
          <div className="text-sm text-yellow-200">
            <strong>Penting:</strong> Di Dashboard Supabase, masuk ke menu <em>Authentication &gt; Providers &gt; Email</em> dan <strong>Nonaktifkan "Confirm email"</strong>. Ini penting agar user (termasuk Admin pertama) bisa langsung login dan tersimpan dengan benar di database.
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium mb-1">Project URL</label>
            <input 
              type="text" 
              value={url} 
              onChange={e => setUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
              placeholder="https://xyz.supabase.co"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Anon Public Key</label>
            <input 
              type="text" 
              value={key} 
              onChange={e => setKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:ring-2 focus:ring-primary outline-none"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
              required
            />
          </div>
          <button type="submit" className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded transition-colors flex items-center justify-center gap-2">
            Simpan & Lanjutkan <ArrowRight size={18} />
          </button>
        </form>

        <div className="border-t border-slate-700 pt-6">
          <h2 className="text-lg font-semibold mb-2">Langkah Selanjutnya (Wajib)</h2>
          <p className="text-sm text-slate-400 mb-4">
            Salin kode SQL berikut dan jalankan di <strong>SQL Editor</strong> pada dashboard Supabase Anda untuk membuat tabel yang diperlukan agar aplikasi tidak error.
          </p>
          <div className="relative bg-slate-950 p-4 rounded-md overflow-x-auto border border-slate-700 h-48 no-scrollbar">
            <button 
              onClick={copySQL}
              className="absolute top-2 right-2 p-2 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
            <pre className="text-xs text-green-400 font-mono">
              {SQL_SCHEMA}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
