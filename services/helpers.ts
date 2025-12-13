
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
  // 1. Jika benar-benar kosong, baru return default
  if (!name || name.trim() === '') {
      return 'Produk';
  }

  let cleanName = name.trim();

  // 2. HANYA hapus indikator kuantitas di awal (contoh: "1x Nama")
  cleanName = cleanName.replace(/^\d+x\s+/, '');
  
  // 3. HANYA hapus indikator kuantitas di akhir (contoh: "Nama (1x)")
  cleanName = cleanName.replace(/\s*\(\d+x\)$/i, '');

  // 4. JANGAN PERNAH me-return "Produk Digital" atau "Nama Tidak Tersedia"
  // Biarkan user melihat nama aslinya meskipun itu cuma "(-)" agar mereka tau datanya memang begitu
  
  return cleanName;
};
