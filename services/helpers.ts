
export const formatRupiah = (number: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(number);
};

export const generateWhatsAppLink = (phone: string, message: string) => {
  // Remove non-digit chars, ensure starts with 62
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

export const generateAffiliateCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Fungsi diperbarui: Membersihkan nama rusak dan ambil 2 kata depan
export const formatProductName = (name: string | undefined | null): string => {
  // 1. Cek jika nama kosong atau pola rusak
  if (!name || name.trim() === '' || name === '(-)' || name.trim().startsWith('(')) {
      return 'Produk';
  }
  
  // 2. Bersihkan suffix jumlah seperti " (1x)" jika ada
  let cleanName = name.replace(/\(\d+x\)/g, '').trim();
  
  // Jika setelah dibersihkan jadi kosong (misal awalnya cuma "(1x)")
  if (cleanName === '') return 'Produk';

  // 3. Ambil 2 kata pertama jika lebih dari 2 kata
  const words = cleanName.split(' ');
  if (words.length > 2) {
      return `${words[0]} ${words[1]}`;
  }
  
  return cleanName;
};
