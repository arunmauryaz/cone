/* ============================================================
   CONE — App Root
   src/App.jsx
   Context providers + Routes
   ============================================================ */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Contexts
import { SettingsProvider }  from './context/SettingsContext.jsx';
import { AuthProvider }      from './context/AuthContext.jsx';
import { MarketProvider }    from './context/MarketContext.jsx';
import { PortfolioProvider } from './context/PortfolioContext.jsx';

// Layout
import Layout from './components/layout/Layout.jsx';

// Protected route
import { useAuth } from './context/AuthContext.jsx';

// Auth pages (not lazy — load immediately)
import Login    from './pages/Auth/Login.jsx';
import Register from './pages/Auth/Register.jsx';

// Main pages (lazy loaded for performance)
const Dashboard    = lazy(() => import('./pages/Dashboard.jsx'));
const Market       = lazy(() => import('./pages/Market.jsx'));
const StockDetail  = lazy(() => import('./pages/StockDetail.jsx'));
const Orders       = lazy(() => import('./pages/Orders.jsx'));
const Positions    = lazy(() => import('./pages/Positions.jsx'));
const Holdings     = lazy(() => import('./pages/Holdings.jsx'));
const Funds        = lazy(() => import('./pages/Funds.jsx'));
const Analytics    = lazy(() => import('./pages/Analytics.jsx'));
const Settings     = lazy(() => import('./pages/Settings.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));

function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="skeleton" style={{ width: 200, height: 20 }} />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isLoggedIn, authLoading } = useAuth();
  if (authLoading) return <PageFallback />;
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes with shared layout */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"  element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="/market"     element={<Suspense fallback={<PageFallback />}><Market /></Suspense>} />
          <Route path="/stock/:instrumentKey" element={<Suspense fallback={<PageFallback />}><StockDetail /></Suspense>} />
          <Route path="/orders"     element={<Suspense fallback={<PageFallback />}><Orders /></Suspense>} />
          <Route path="/positions"  element={<Suspense fallback={<PageFallback />}><Positions /></Suspense>} />
          <Route path="/holdings"   element={<Suspense fallback={<PageFallback />}><Holdings /></Suspense>} />
          <Route path="/funds"      element={<Suspense fallback={<PageFallback />}><Funds /></Suspense>} />
          <Route path="/analytics"  element={<Suspense fallback={<PageFallback />}><Analytics /></Suspense>} />
          <Route path="/settings"   element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
          <Route path="/notifications" element={<Suspense fallback={<PageFallback />}><Notifications /></Suspense>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <MarketProvider>
          <PortfolioProvider>
            <AppRoutes />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'rgba(15,15,26,0.95)',
                  color: '#f0f0f8',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(20px)',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '13px',
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </PortfolioProvider>
        </MarketProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
