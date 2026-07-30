import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Initialize theme from localStorage or default to light
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as Theme;
      return savedTheme || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    // Apply theme to document
    if (typeof window !== 'undefined') {
      // console.log('Applying theme:', theme);
      document.documentElement.setAttribute('data-theme', theme);
      
      // Store in localStorage
      localStorage.setItem('theme', theme);
      
      // console.log('Theme applied:', theme);
      // console.log('data-theme attribute:', document.documentElement.getAttribute('data-theme'));
    }
  }, [theme]);

  const toggleTheme = () => {
    // console.log('Theme toggle clicked, current theme:', theme);
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      // console.log('Switching to theme:', newTheme);
      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
