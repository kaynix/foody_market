import React from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { getTranslatedCategoryName } from '../../utils/categoryUtils';
import type { Category } from '../../types';

interface SidebarProps {
  categories: Category[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  categories
}) => {
  const { t } = useTranslation();
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-base-200 border-r border-base-300 shadow-sm overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4 text-base-content">{t('categories')}</h2>
        <ul className="menu menu-vertical w-full">
          <li>
            <Link 
              href="/"
              className={`hover:bg-base-300 ${
                location === '/' ? 'bg-primary text-primary-content' : 'text-base-content'
              }`}
            >
              {t('allProducts')}
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <Link 
                href={`/category/${category.slug}`}
                className={`hover:bg-base-300 ${
                  location === `/category/${category.slug}` ? 'bg-primary text-primary-content' : 'text-base-content'
                }`}
              >
                {getTranslatedCategoryName(category.id, t)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
