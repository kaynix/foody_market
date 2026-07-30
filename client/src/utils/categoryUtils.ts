import type { Category } from '../types';

const categories: Category[] = [
  { id: 1, name: 'Fresh Produce', slug: 'fresh-produce' },
  { id: 2, name: 'Meat & Poultry', slug: 'meat-poultry' },
  { id: 3, name: 'Seafood', slug: 'seafood' },
  { id: 4, name: 'Dairy & Cheese', slug: 'dairy-cheese' },
  { id: 5, name: 'Bakery', slug: 'bakery' },
  { id: 6, name: 'Pantry Essentials', slug: 'pantry-essentials' },
  { id: 7, name: 'Beverages', slug: 'beverages' },
  { id: 8, name: 'Sweets & Desserts', slug: 'sweets-desserts' },
  { id: 9, name: 'Spices & Seasonings', slug: 'spices-seasonings' },
  { id: 10, name: 'Deli & Charcuterie', slug: 'deli-charcuterie' },
];

export function getCategoryById(id: number): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getCategoryNameById(id: number): string {
  return getCategoryById(id)?.name ?? 'Unknown Category';
}

export function getTranslatedCategoryName(id: number, t: (key: string) => string): string {
  const category = getCategoryById(id);
  if (!category) return t('unknownCategory');

  const categoryMap: Record<string, string> = {
    'Fresh Produce':     t('freshProduce'),
    'Meat & Poultry':    t('meatPoultry'),
    'Seafood':           t('seafood'),
    'Dairy & Cheese':    t('dairyCheese'),
    'Bakery':            t('bakery'),
    'Pantry Essentials': t('pantryEssentials'),
    'Beverages':         t('beverages'),
    'Sweets & Desserts': t('sweetsDeserts'),
    'Spices & Seasonings': t('spicesSeasonings'),
    'Deli & Charcuterie': t('deliCharcuterie'),
  };

  return categoryMap[category.name] ?? category.name;
}
