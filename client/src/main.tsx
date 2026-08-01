import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { CartProvider } from './contexts/CartContext.tsx'
import { SellerAuthProvider } from './contexts/SellerAuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartProvider>
      <SellerAuthProvider>
        <App />
      </SellerAuthProvider>
    </CartProvider>
  </StrictMode>,
)
