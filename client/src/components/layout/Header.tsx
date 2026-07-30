import { useTheme } from '../../hooks/useTheme';
import { useCart } from '../../contexts/CartContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import { useEffect } from 'react';
import { Link } from 'wouter';

interface HeaderProps {
  onSearchChange?: (value: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onSearchChange }) => {
  const { theme, toggleTheme } = useTheme();
  const { getTotalItems } = useCart();
  const { t } = useTranslation();
  
  console.log('Header rendered with theme:', theme);
  
  useEffect(() => {
    console.log('Header mounted, current HTML classes:', document.documentElement.className);
    console.log('Current data-theme:', document.documentElement.getAttribute('data-theme'));
  }, []);

  return (
    <header className="w-full bg-base-100 border-b border-base-300 shadow-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-2 max-w-full">
        {/* Left: Logo */}
        <div className="flex-shrink-0">
          <h1 className="text-xl font-semibold text-base-content px-4 py-2 hover:bg-base-200 rounded-lg cursor-pointer">
            Hutoryna market
          </h1>
        </div>
        
        {/* Center: Search */}
        <div className="flex-grow flex justify-center px-4">
          <div className="w-full max-w-md">
            <input 
              type="text" 
              placeholder={t('searchProducts')}
              className="input input-bordered w-full bg-base-200"
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>
        </div>
        
        {/* Right: Actions */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* Language Switcher */}
          <LanguageSwitcher />
          
          {/* Theme Switcher */}
          <button 
            onClick={toggleTheme}
            className="btn btn-ghost btn-circle"
            title={`${t('switchTo')} ${theme === 'light' ? t('darkMode') : t('lightMode')}`}
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
          
          {/* Cart Button */}
          <Link href="/cart">
            <button className="btn btn-ghost btn-circle relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 7H19" />
              </svg>
              {getTotalItems() > 0 && (
                <div className="badge badge-primary badge-sm absolute -top-2 -right-2">
                  {getTotalItems()}
                </div>
              )}
            </button>
          </Link>
          
          {/* User Button */}
          <button className="btn btn-ghost btn-circle">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
