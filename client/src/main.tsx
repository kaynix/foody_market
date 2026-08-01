import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { CartProvider } from './contexts/CartContext.tsx'
import { SellerAuthProvider } from './contexts/SellerAuthContext.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <SellerAuthProvider>
          <App />
        </SellerAuthProvider>
      </CartProvider>
    </QueryClientProvider>
  </StrictMode>,
)
