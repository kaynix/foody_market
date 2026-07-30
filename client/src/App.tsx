import './App.css'
import './i18n'
import { Route, Switch } from 'wouter'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import ProductDetailPage from './pages/ProductDetailPage'
import CategoryPage from './pages/CategoryPage'
import CartPage from './pages/CartPage'
import { ThemeProvider } from './hooks/useTheme'

function App() {

  return (
    <ThemeProvider>
      <Layout>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/category/:slug" component={CategoryPage} />
          <Route path="/product/:id" component={ProductDetailPage} />
          <Route path="/cart" component={CartPage} />
          <Route>
            <div className="container mx-auto px-4 py-8">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-base-content mb-4">404: Page Not Found</h1>
                <p className="text-base-content/70">The page you're looking for doesn't exist.</p>
              </div>
            </div>
          </Route>
        </Switch>
      </Layout>
    </ThemeProvider>
  )
}

export default App
