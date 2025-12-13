
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

export const formatProductName = (name: string | undefined | null): string => {
  // 1. Jika nama kosong/null, kembalikan string generik netral
  if (!name || name.trim() === '') {
      return 'Produk Digital';
  }

  // 2. Bersihkan nama
  let cleanName = name.trim();

  // Hapus awalan jumlah seperti "1x ", "2x "
  cleanName = cleanName.replace(/^\d+x\s+/i, '');
  
  // Hapus akhiran jumlah seperti " (1x)", "(1 item)"
  cleanName = cleanName.replace(/\s*\(\d+x\)$/i, '');
  cleanName = cleanName.replace(/\s*\(\d+\s*item\)$/i, '');

  // Hapus karakter aneh jika hanya itu isinya
  if (cleanName === '(-)' || cleanName === '()') return 'Produk Digital';
  
  // Jika setelah dibersihkan menjadi kosong atau hanya "Produk", biarkan apa adanya atau return 'Produk Digital'
  // Jangan return pesan error "Tidak Tersedia"
  if (cleanName.toLowerCase() === 'produk' || cleanName === '') {
      // Kita coba return nama asli dulu (walaupun cuma 'Produk')
      // karena mungkin self-healing di page belum selesai loading nama aslinya
      return 'Produk'; 
  }
  
  return cleanName;
};
