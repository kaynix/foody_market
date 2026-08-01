import './App.css'
import './i18n'
import { Route, Switch } from 'wouter'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import ProductDetailPage from './pages/ProductDetailPage'
import CategoryPage from './pages/CategoryPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import TrackingPage from './pages/TrackingPage'
import SellerDashboardPage from './pages/seller/SellerDashboardPage'
import SellerOnboardingPage from './pages/seller/SellerOnboardingPage'
import SellerSignInPage from './pages/seller/SellerSignInPage'
import SellerSettingsPage from './pages/seller/SellerSettingsPage'
import SellerProductsPage from './pages/seller/SellerProductsPage'
import SellerProductEditorPage from './pages/seller/SellerProductEditorPage'
import SellerChannelsPage from './pages/seller/SellerChannelsPage'
import SellerApplicationsPage from './pages/seller/SellerApplicationsPage'
import SellerApplicationDetailPage from './pages/seller/SellerApplicationDetailPage'
import StorefrontPage from './pages/StorefrontPage'
import { ThemeProvider } from './hooks/useTheme'

function App() {

  return (
    <ThemeProvider>
      <Switch>
        <Route path="/seller/sign-in" component={SellerSignInPage} />
        <Route path="/seller/onboarding" component={SellerOnboardingPage} />
        <Route path="/seller/settings" component={SellerSettingsPage} />
        <Route path="/seller/channels" component={SellerChannelsPage} />
        <Route path="/seller/applications/:applicationId" component={SellerApplicationDetailPage} />
        <Route path="/seller/applications" component={SellerApplicationsPage} />
        <Route path="/seller/products/new" component={SellerProductEditorPage} />
        <Route path="/seller/products/:id/edit" component={SellerProductEditorPage} />
        <Route path="/seller/products" component={SellerProductsPage} />
        <Route path="/seller" component={SellerDashboardPage} />
        <Route>
          <Layout>
            <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/category/:slug" component={CategoryPage} />
          <Route path="/product/:id" component={ProductDetailPage} />
          <Route path="/cart" component={CartPage} />
          <Route path="/checkout" component={CheckoutPage} />
          <Route path="/tracking/:groupId" component={TrackingPage} />
          <Route path="/store/:slug" component={StorefrontPage} />
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
        </Route>
      </Switch>
    </ThemeProvider>
  )
}

export default App
