
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

// Fungsi baru untuk memotong nama produk sesuai request user
export const formatProductName = (name: string | undefined | null): string => {
  if (!name || name.trim() === '') return 'Produk';
  
  // Jika nama lebih dari 20 karakter (sebelumnya 25), ambil 2 kata pertama saja
  if (name.length > 20) {
      const words = name.split(' ');
      if (words.length >= 2) {
          return `${words[0]} ${words[1]}...`;
      }
  }
  return name;
};
