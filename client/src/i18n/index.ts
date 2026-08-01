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
      title: "Hutorynok Market",
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
      addedToCart: "Added {{quantity}} {{name}}(s) to cart!",
      reportProduct: "Report product",
      complaintComingSoon: "Reporting will be available later",
      marketplace: {
        cartKicker: "One cart · separate requests", separateRequest: "Separate seller request",
        photo: "Photo", decreaseQuantity: "Decrease quantity", increaseQuantity: "Increase quantity",
        summary: "Summary", requestsCount: "{{count}} requests", items: "Items",
        deliveryAgreement: "Delivery is arranged separately with each seller. There are no hidden fees.",
        submitRequests: "Submit requests", checkoutWithoutPayment: "Checkout without payment",
        checkoutTitle: "One action — several requests", checkoutIntro: "Each seller receives a separate request. Status updates arrive in your selected messenger.",
        cartCheckFailed: "We could not verify the cart. Refresh the page.", linkExpired: "The messenger link expired. Create a new one.",
        linkFailed: "We could not create a messenger link.", cartChanged: "The cart changed. Check the items and delivery again.",
        submitFailed: "We could not create the requests. Your cart is preserved.", emptyCartTitle: "The cart is empty", toProducts: "Browse products",
        needsAttention: "Some items need attention", requestForSeller: "Request to seller", deliveryMethod: "Delivery method",
        deliveryDetails: "Delivery details", deliveryPlaceholderPost: "City and branch number", deliveryPlaceholderOther: "When and how you want to receive it",
        buyerContact: "Buyer contact", statusDestination: "Where to send status updates", name: "Name", phone: "Phone",
        messengerRequired: "Messenger is required", noEmail: "No email needed. Confirm where status updates should be sent.",
        createNewLink: "Create a new link", connectMessenger: "Connect messenger", openMessenger: "Open messenger ↗",
        messengerConfirmed: "✓ Messenger confirmed", awaitingConfirmation: "Waiting for confirmation", messengerUnavailable: "No messenger is configured on the server yet.",
        createRequests: "Create {{count}} requests", privacy: "By continuing, you send sellers your name, phone number and delivery details. Passport data is not collected.",
        trackingKicker: "Request tracking", trackingTitle: "Sellers respond separately", trackingIntro: "Created {{date}}. A change to one request does not affect the others.",
        missingTrackingKey: "Tracking key is missing", sameBrowser: "Open this page in the browser where the requests were submitted.", homeLink: "Home",
        requestsNotFound: "Requests not found", loadingStatuses: "Loading statuses…", cancelConfirm: "Cancel this request? Other requests remain unchanged.",
        cancelUnavailable: "The seller has already changed the status, so cancellation is unavailable.", invalidTracking: "This tracking link is invalid or no longer available.",
        productsHeading: "Items", totalHeading: "Total", receiving: "Delivery", sellerContacts: "Seller contacts", cancelOne: "Cancel only this request",
        deliveryNovaPoshta: "Nova Poshta", deliveryPickup: "Pickup", deliveryArrangement: "By arrangement",
        status: { new: "Waiting for seller", accepted: "Accepted", rejected: "Rejected", cancelled: "Cancelled", completed: "Completed" }
      }
    }
  },
  ua: {
    translation: {
      // Navigation & Headers
      home: "Головна",
      products: "Товари",
      category: "Категорія",
      title: "Хуторинок",
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
      addedToCart: "Додано {{quantity}} {{name}} до кошика!",
      reportProduct: "Поскаржитися",
      complaintComingSoon: "Функція з’явиться пізніше",
      marketplace: {
        cartKicker: "Один кошик · окремі заявки", separateRequest: "Окрема заявка продавцю",
        photo: "Фото", decreaseQuantity: "Зменшити кількість", increaseQuantity: "Збільшити кількість",
        summary: "Підсумок", requestsCount: "Заявок: {{count}}", items: "Товари",
        deliveryAgreement: "Доставка узгоджується окремо з кожним продавцем. Податків та прихованих доплат немає.",
        submitRequests: "Оформити заявки", checkoutWithoutPayment: "Оформлення без оплати",
        checkoutTitle: "Одна дія — кілька заявок", checkoutIntro: "Кожен продавець отримає власну заявку. Статуси прийдуть у вибраний messenger.",
        cartCheckFailed: "Не вдалося перевірити кошик. Оновіть сторінку.", linkExpired: "Посилання messenger прострочене. Створіть нове.",
        linkFailed: "Не вдалося створити посилання messenger.", cartChanged: "Кошик змінився. Перевірте товари та доставку ще раз.",
        submitFailed: "Не вдалося створити заявки. Кошик збережено.", emptyCartTitle: "Кошик порожній", toProducts: "До товарів",
        needsAttention: "Деякі позиції потребують уваги", requestForSeller: "Заявка продавцю", deliveryMethod: "Спосіб отримання",
        deliveryDetails: "Деталі доставки", deliveryPlaceholderPost: "Місто та номер відділення", deliveryPlaceholderOther: "Коли і як зручно отримати",
        buyerContact: "Контакт покупця", statusDestination: "Куди повідомити статус", name: "Ім’я", phone: "Телефон",
        messengerRequired: "Messenger обов’язковий", noEmail: "Email не потрібен. Підтвердіть, куди надсилати статуси.",
        createNewLink: "Створити нове посилання", connectMessenger: "Підключити messenger", openMessenger: "Відкрити messenger ↗",
        messengerConfirmed: "✓ Messenger підтверджено", awaitingConfirmation: "Очікуємо підтвердження", messengerUnavailable: "Messenger на сервері ще не налаштований.",
        createRequests: "Створити {{count}} заявки", privacy: "Натискаючи кнопку, ви надсилаєте продавцям ім’я, телефон і деталі доставки. Паспортні дані не збираються.",
        trackingKicker: "Відстеження заявок", trackingTitle: "Продавці відповідають окремо", trackingIntro: "Оформлено {{date}}. Зміна однієї заявки не впливає на інші.",
        missingTrackingKey: "Немає ключа відстеження", sameBrowser: "Відкрийте сторінку в тому ж браузері, де оформлювали заявки.", homeLink: "На головну",
        requestsNotFound: "Заявки не знайдено", loadingStatuses: "Завантажуємо статуси…", cancelConfirm: "Скасувати цю заявку? Інші заявки залишаться без змін.",
        cancelUnavailable: "Продавець уже змінив статус — скасування недоступне.", invalidTracking: "Посилання відстеження недійсне або більше недоступне.",
        productsHeading: "Товари", totalHeading: "Разом", receiving: "Отримання", sellerContacts: "Контакти продавця", cancelOne: "Скасувати лише цю заявку",
        deliveryNovaPoshta: "Нова пошта", deliveryPickup: "Самовивіз", deliveryArrangement: "За домовленістю",
        status: { new: "Очікує продавця", accepted: "Прийнята", rejected: "Відхилена", cancelled: "Скасована", completed: "Виконана" }
      }
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
      addedToCart: "{{quantity}} {{name}} zum Warenkorb hinzugefügt!",
      reportProduct: "Produkt melden",
      complaintComingSoon: "Diese Funktion kommt später",
      marketplace: {
        cartKicker: "Ein Warenkorb · separate Anfragen", separateRequest: "Separate Verkäuferanfrage",
        photo: "Foto", decreaseQuantity: "Menge verringern", increaseQuantity: "Menge erhöhen",
        summary: "Zusammenfassung", requestsCount: "{{count}} Anfragen", items: "Artikel",
        deliveryAgreement: "Die Lieferung wird mit jedem Verkäufer separat vereinbart. Es gibt keine versteckten Gebühren.",
        submitRequests: "Anfragen absenden", checkoutWithoutPayment: "Bestellung ohne Zahlung",
        checkoutTitle: "Eine Aktion — mehrere Anfragen", checkoutIntro: "Jeder Verkäufer erhält eine eigene Anfrage. Statusmeldungen kommen im gewählten Messenger.",
        cartCheckFailed: "Der Warenkorb konnte nicht geprüft werden. Laden Sie die Seite neu.", linkExpired: "Der Messenger-Link ist abgelaufen. Erstellen Sie einen neuen.",
        linkFailed: "Der Messenger-Link konnte nicht erstellt werden.", cartChanged: "Der Warenkorb hat sich geändert. Prüfen Sie Artikel und Lieferung erneut.",
        submitFailed: "Die Anfragen konnten nicht erstellt werden. Der Warenkorb bleibt erhalten.", emptyCartTitle: "Der Warenkorb ist leer", toProducts: "Zu den Produkten",
        needsAttention: "Einige Positionen benötigen Aufmerksamkeit", requestForSeller: "Anfrage an Verkäufer", deliveryMethod: "Lieferart",
        deliveryDetails: "Lieferdetails", deliveryPlaceholderPost: "Stadt und Filialnummer", deliveryPlaceholderOther: "Wann und wie Sie die Ware erhalten möchten",
        buyerContact: "Kontakt des Käufers", statusDestination: "Wohin Statusmeldungen gesendet werden", name: "Name", phone: "Telefon",
        messengerRequired: "Messenger ist erforderlich", noEmail: "Keine E-Mail nötig. Bestätigen Sie den Messenger für Statusmeldungen.",
        createNewLink: "Neuen Link erstellen", connectMessenger: "Messenger verbinden", openMessenger: "Messenger öffnen ↗",
        messengerConfirmed: "✓ Messenger bestätigt", awaitingConfirmation: "Warten auf Bestätigung", messengerUnavailable: "Auf dem Server ist noch kein Messenger eingerichtet.",
        createRequests: "{{count}} Anfragen erstellen", privacy: "Mit dem Fortfahren senden Sie Name, Telefonnummer und Lieferdetails an die Verkäufer. Passdaten werden nicht erhoben.",
        trackingKicker: "Anfragen verfolgen", trackingTitle: "Verkäufer antworten separat", trackingIntro: "Erstellt am {{date}}. Änderungen an einer Anfrage beeinflussen die anderen nicht.",
        missingTrackingKey: "Tracking-Schlüssel fehlt", sameBrowser: "Öffnen Sie diese Seite in demselben Browser, in dem die Anfragen erstellt wurden.", homeLink: "Startseite",
        requestsNotFound: "Anfragen nicht gefunden", loadingStatuses: "Status wird geladen…", cancelConfirm: "Diese Anfrage stornieren? Andere Anfragen bleiben unverändert.",
        cancelUnavailable: "Der Verkäufer hat den Status bereits geändert; eine Stornierung ist nicht mehr möglich.", invalidTracking: "Dieser Tracking-Link ist ungültig oder nicht mehr verfügbar.",
        productsHeading: "Artikel", totalHeading: "Gesamt", receiving: "Lieferung", sellerContacts: "Verkäuferkontakte", cancelOne: "Nur diese Anfrage stornieren",
        deliveryNovaPoshta: "Nova Poshta", deliveryPickup: "Abholung", deliveryArrangement: "Nach Vereinbarung",
        status: { new: "Wartet auf Verkäufer", accepted: "Angenommen", rejected: "Abgelehnt", cancelled: "Storniert", completed: "Erledigt" }
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ua',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
    },
  });

export default i18n;
