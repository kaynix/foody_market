import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      // Navigation & Headers
      home: "Home",
      products: "Products",
      category: "Category",
      
      // Categories
      categories: "Categories",
      allProducts: "All Products",
      freshProduce: "Fresh Produce",
      meatPoultry: "Meat & Poultry",
      seafood: "Seafood",
      dairyCheese: "Dairy & Cheese",
      bakery: "Bakery",
      pantryEssentials: "Pantry Essentials",
      beverages: "Beverages",
      sweetsDeserts: "Sweets & Desserts",
      spicesSeasonings: "Spices & Seasonings",
      deliCharcuterie: "Deli & Charcuterie",
      unknownCategory: "Unknown Category",
      
      // Product Page
      productNotFound: "Product Not Found",
      productNotFoundDesc: "The product you're looking for doesn't exist.",
      featuredProducts: "Featured Products",
      productsFound: "products found",
      for: "for",
      in: "in",
      
      // Product Details
      quantity: "Quantity",
      addToCart: "Add to Cart",
      addToWishlist: "Add to Wishlist",
      compare: "Compare",
      viewDetails: "View Details",
      
      // Shipping
      shippingInformation: "Shipping Information",
      freeShipping: "Free shipping",
      shippingCostsApply: "Shipping costs apply",
      estimatedDelivery: "Estimated delivery",
      expressShipping: "Express shipping",
      
      // Product Tabs
      description: "Description",
      specifications: "Specifications",
      supplier: "Supplier",
      reviews: "Reviews",
      
      // Product Description
      productDescription: "Product Description",
      
      // Supplier Information
      supplierInformation: "Supplier Information",
      yearsInBusiness: "Years in Business",
      totalProducts: "Total Products",
      responseTime: "Response Time",
      status: "Status",
      active: "Active",
      verifiedSupplier: "Verified Supplier",
      
      // Reviews
      customerReviews: "Customer Reviews",
      
      // Search
      searchProducts: "Search products...",
      
      // Cart
      cart: "Cart",
      emptyCart: "Your cart is empty",
      emptyCartDescription: "Add some delicious items to get started!",
      continueShopping: "Continue Shopping",
      clearCart: "Clear Cart",
      remove: "Remove",
      orderSummary: "Order Summary",
      subtotal: "Subtotal",
      shipping: "Shipping",
      tax: "Tax",
      total: "Total",
      proceedToCheckout: "Proceed to Checkout",
      
      // Theme
      switchTo: "Switch to",
      darkMode: "dark mode",
      lightMode: "light mode",
      
      // Alerts
      addedToCart: "Added {{quantity}} {{name}}(s) to cart!"
    }
  },
  ua: {
    translation: {
      // Navigation & Headers
      home: "Головна",
      products: "Товари",
      category: "Категорія",
      
      // Categories
      categories: "Категорії",
      allProducts: "Всі товари",
      freshProduce: "Свіжі продукти",
      meatPoultry: "М'ясо та птиця",
      seafood: "Морепродукти",
      dairyCheese: "Молочні продукти та сири",
      bakery: "Випічка",
      pantryEssentials: "Основні продукти",
      beverages: "Напої",
      sweetsDeserts: "Солодощі та десерти",
      spicesSeasonings: "Спеції та приправи",
      deliCharcuterie: "Делікатеси",
      unknownCategory: "Невідома категорія",
      
      // Product Page
      productNotFound: "Товар не знайдено",
      productNotFoundDesc: "Товар, який ви шукаєте, не існує.",
      featuredProducts: "Рекомендовані товари",
      productsFound: "товарів знайдено",
      for: "для",
      in: "в",
      
      // Product Details
      quantity: "Кількість",
      addToCart: "Додати в кошик",
      addToWishlist: "Додати в бажане",
      compare: "Порівняти",
      viewDetails: "Деталі",
      
      // Shipping
      shippingInformation: "Інформація про доставку",
      freeShipping: "Безкоштовна доставка",
      shippingCostsApply: "Застосовуються витрати на доставку",
      estimatedDelivery: "Орієнтовна доставка",
      expressShipping: "Експрес доставка",
      
      // Product Tabs
      description: "Опис",
      specifications: "Специфікації",
      supplier: "Постачальник",
      reviews: "Відгуки",
      
      // Product Description
      productDescription: "Опис товару",
      
      // Supplier Information
      supplierInformation: "Інформація про постачальника",
      yearsInBusiness: "Років у бізнесі",
      totalProducts: "Загальна кількість товарів",
      responseTime: "Час відповіді",
      status: "Статус",
      active: "Активний",
      verifiedSupplier: "Перевірений постачальник",
      
      // Reviews
      customerReviews: "Відгуки клієнтів",
      
      // Search
      searchProducts: "Пошук товарів...",
      
      // Cart
      cart: "Кошик",
      emptyCart: "Ваш кошик порожній",
      emptyCartDescription: "Додайте смачні товари, щоб почати!",
      continueShopping: "Продовжити покупки",
      clearCart: "Очистити кошик",
      remove: "Видалити",
      orderSummary: "Підсумок замовлення",
      subtotal: "Проміжний підсумок",
      shipping: "Доставка",
      tax: "Податок",
      total: "Загалом",
      proceedToCheckout: "Перейти до оформлення",
      
      // Theme
      switchTo: "Перемкнути на",
      darkMode: "темний режим",
      lightMode: "світлий режим",
      
      // Alerts
      addedToCart: "Додано {{quantity}} {{name}} до кошика!"
    }
  },
  de: {
    translation: {
      // Navigation & Headers
      home: "Startseite",
      products: "Produkte",
      category: "Kategorie",
      
      // Categories
      categories: "Kategorien",
      allProducts: "Alle Produkte",
      freshProduce: "Frische Produkte",
      meatPoultry: "Fleisch & Geflügel",
      seafood: "Meeresfrüchte",
      dairyCheese: "Milchprodukte & Käse",
      bakery: "Bäckerei",
      pantryEssentials: "Vorratskammer",
      beverages: "Getränke",
      sweetsDeserts: "Süßwaren & Desserts",
      spicesSeasonings: "Gewürze & Würzmittel",
      deliCharcuterie: "Feinkost",
      unknownCategory: "Unbekannte Kategorie",
      
      // Product Page
      productNotFound: "Produkt nicht gefunden",
      productNotFoundDesc: "Das gesuchte Produkt existiert nicht.",
      featuredProducts: "Empfohlene Produkte",
      productsFound: "Produkte gefunden",
      for: "für",
      in: "in",
      
      // Product Details
      quantity: "Menge",
      addToCart: "In den Warenkorb",
      addToWishlist: "Zur Wunschliste",
      compare: "Vergleichen",
      viewDetails: "Details",
      
      // Shipping
      shippingInformation: "Versandinformationen",
      freeShipping: "Kostenloser Versand",
      shippingCostsApply: "Versandkosten fallen an",
      estimatedDelivery: "Voraussichtliche Lieferung",
      expressShipping: "Express-Versand",
      
      // Product Tabs
      description: "Beschreibung",
      specifications: "Spezifikationen",
      supplier: "Lieferant",
      reviews: "Bewertungen",
      
      // Product Description
      productDescription: "Produktbeschreibung",
      
      // Supplier Information
      supplierInformation: "Lieferanteninformationen",
      yearsInBusiness: "Jahre im Geschäft",
      totalProducts: "Gesamtprodukte",
      responseTime: "Antwortzeit",
      status: "Status",
      active: "Aktiv",
      verifiedSupplier: "Verifizierter Lieferant",
      
      // Reviews
      customerReviews: "Kundenbewertungen",
      
      // Search
      searchProducts: "Produkte suchen...",
      
      // Cart
      cart: "Warenkorb",
      emptyCart: "Ihr Warenkorb ist leer",
      emptyCartDescription: "Fügen Sie leckere Artikel hinzu, um zu beginnen!",
      continueShopping: "Weiter einkaufen",
      clearCart: "Warenkorb leeren",
      remove: "Entfernen",
      orderSummary: "Bestellübersicht",
      subtotal: "Zwischensumme",
      shipping: "Versand",
      tax: "Steuer",
      total: "Gesamt",
      proceedToCheckout: "Zur Kasse gehen",
      
      // Theme
      switchTo: "Wechseln zu",
      darkMode: "Dunkler Modus",
      lightMode: "Heller Modus",
      
      // Alerts
      addedToCart: "{{quantity}} {{name}} zum Warenkorb hinzugefügt!"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

export default i18n;
