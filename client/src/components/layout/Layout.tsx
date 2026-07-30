import React, { useEffect, useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { fetchCategories } from '../../api/client';
import type { Category } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  onSearchChange?: (value: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onSearchChange }) => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  const handleSearchChange = (value: string) => {
    onSearchChange?.(value);
  };

  return (
    <div className="min-h-screen bg-base-100">
      <Header onSearchChange={handleSearchChange} />

      <div className="flex h-screen">
        <Sidebar 
          categories={categories}
        />

        <main className="flex-1 overflow-y-auto bg-base-100">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
