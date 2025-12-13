
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types';

const CONFIG_KEY = 'digitalstore_supabase_config';

export const getStoredConfig = (): SupabaseConfig | null => {
  // 1. Check Environment Variables first (For Vercel Production)
  const env = (import.meta as any).env;
  const envUrl = env?.VITE_SUPABASE_URL;
  const envKey = env?.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
     return { url: envUrl, anonKey: envKey };
  }

  // 2. Check Local Storage (For Manual Setup)
  const stored = localStorage.getItem(CONFIG_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const saveConfig = (config: SupabaseConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const resetConfig = () => {
  localStorage.removeItem(CONFIG_KEY);
};

let supabase: SupabaseClient | null = null;

// Function to initialize or re-initialize the client
export const initSupabase = () => {
  const config = getStoredConfig();
  if (config && config.url && config.anonKey) {
    try {
      supabase = createClient(config.url, config.anonKey);
    } catch (e) {
      console.error("Failed to initialize Supabase", e);
      supabase = null;
    }
  } else {
    supabase = null;
  }
  return supabase;
};

initSupabase();

export const getSupabase = () => {
  if (!supabase) {
    return initSupabase();
  }
  return supabase;
};

export const SQL_SCHEMA = `
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  role text default 'user',
  full_name text,
  affiliate_code text,
  referred_by text,
  phone text,
  balance numeric default 0,
  bank_name text,
  bank_number text,
  bank_holder text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PRODUCTS
create table if not exists public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price numeric not null,
  discount_price numeric,
  cost_price numeric default 0, -- NEW: Harga Modal
  category text,
  image_url text,
  file_url text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- VOUCHERS
create table if not exists public.vouchers (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique,
  discount_type text not null, 
  discount_value numeric not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ORDERS
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  total_amount numeric not null,
  subtotal numeric,
  discount_amount numeric,
  voucher_code text,
  status text default 'pending', 
  commission_paid boolean default false,
  payment_method text,
  payment_proof text,
  items jsonb,
  guest_info jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- SETTINGS
create table if not exists public.settings (
  key text primary key,
  value jsonb
);

-- RLS POLICIES (Simplified)
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

alter table public.products enable row level security;
create policy "Products are viewable by everyone." on public.products for select using (true);
create policy "Admins can insert products." on public.products for insert with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Admins can update products." on public.products for update using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

alter table public.vouchers enable row level security;
create policy "Admins can manage vouchers" on public.vouchers using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Public can read active vouchers" on public.vouchers for select using (is_active = true);

alter table public.orders enable row level security;
create policy "Users can view own orders." on public.orders for select using (auth.uid() = user_id);
create policy "Admins can view all orders." on public.orders for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Public can insert orders" on public.orders for insert with check (true);
create policy "Admins can update orders" on public.orders for update using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

alter table public.settings enable row level security;
create policy "Settings viewable by everyone" on public.settings for select using (true);
create policy "Admins can update settings" on public.settings for update using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Admins can insert settings" on public.settings for insert with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- FUNCTIONS
create or replace function increment_balance(user_id uuid, amount numeric)
returns void as $$
begin
  update public.profiles
  set balance = coalesce(balance, 0) + amount
  where id = user_id;
end;
$$ language plpgsql security definer;
`;

export const BANK_MIGRATION_SQL = `
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_holder text;
NOTIFY pgrst, 'reload config';
`;

export const COMMISSION_MIGRATION_SQL = `
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commission_paid boolean DEFAULT false;
NOTIFY pgrst, 'reload config';
`;

export const VOUCHER_MIGRATION_SQL = `
create extension if not exists "uuid-ossp";
create table if not exists public.vouchers (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique,
  discount_type text not null, 
  discount_value numeric not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.vouchers enable row level security;
create policy "Admins can manage vouchers" on public.vouchers using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Public can read active vouchers" on public.vouchers for select using (is_active = true);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voucher_code text;
NOTIFY pgrst, 'reload config';
`;

export const GUEST_ORDER_MIGRATION_SQL = `
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_info jsonb;
DROP POLICY IF EXISTS "Users can insert orders." ON public.orders;
CREATE POLICY "Public can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
NOTIFY pgrst, 'reload config';
`;

export const FIX_AFFILIATE_AND_QRIS_SQL = `
create or replace function increment_balance(user_id uuid, amount numeric)
returns void as $$
begin
  update public.profiles
  set balance = coalesce(balance, 0) + amount
  where id = user_id;
end;
$$ language plpgsql security definer;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commission_paid boolean DEFAULT false;
NOTIFY pgrst, 'reload config';
`;

export const COST_PRICE_MIGRATION_SQL = `
-- JALANKAN INI UNTUK MENAMBAHKAN KOLOM HARGA MODAL --
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;
NOTIFY pgrst, 'reload config';
`;
