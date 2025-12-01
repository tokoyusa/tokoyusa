
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Props {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  activeTab: string;
  setActiveTab: (val: string) => void;
  onLogout: () => void;
}

const AdminSidebar: React.FC<Props> = ({ isOpen, setIsOpen, activeTab, setActiveTab, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { id: 'products', label: 'Produk', icon: 'fa-box-open' },
    { id: 'customers', label: 'Pelanggan', icon: 'fa-users-cog' },
    { id: 'vouchers', label: 'Voucher', icon: 'fa-ticket-alt' },
    { id: 'affiliates', label: 'Afiliasi', icon: 'fa-handshake' },
    { id: 'settings', label: 'Pengaturan', icon: 'fa-cog' },
    { id: 'database', label: 'Database & API', icon: 'fa-database' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-dark-800 border-r border-dark-700 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-center border-b border-dark-700">
            <h1 className="text-xl font-bold text-primary">Admin Panel</h1>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            <nav className="px-2 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === item.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : 'text-gray-400 hover:bg-dark-700 hover:text-white'
                  }`}
                >
                  <i className={`fas ${item.icon} w-6`}></i>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 border-t border-dark-700">
            <button
              onClick={onLogout}
              className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              <i className="fas fa-sign-out-alt w-6"></i>
              Keluar
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSidebar;
