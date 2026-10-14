import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { CatalogProvider } from './contexts/CatalogContext';
import { ToastProvider } from './contexts/ToastContext';
import './design/tokens.css';
import './design/base.css';
import './design/components.css';
import './design/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <CatalogProvider>
          <CartProvider>
            <RouterProvider router={router} />
          </CartProvider>
        </CatalogProvider>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
);
