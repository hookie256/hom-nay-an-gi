import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';
import { AccountLayout } from './AccountLayout';
import { AdminLayout } from './AdminLayout';
import { RequireAuth } from './guards';
import { HomePage } from '@/features/home/HomePage';
import { IngredientSearchPage } from '@/features/ingredients/IngredientSearchPage';
import { ExplorePage } from '@/features/explore/ExplorePage';
import { DishDetailPage } from '@/features/dish/DishDetailPage';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '@/features/auth/AuthPages';
import { ProfilePage } from '@/features/account/ProfilePage';
import { FavoritesPage } from '@/features/account/FavoritesPage';
import { HistoryPage } from '@/features/account/HistoryPage';
import { CartPage } from '@/features/cart/CartPage';
import { CheckoutPage } from '@/features/cart/CheckoutPage';
import { MyOrderDetailPage, MyOrdersPage, OrderSuccessPage } from '@/features/orders/OrderPages';
import { DashboardPage } from '@/features/admin/DashboardPage';
import { DishesPage } from '@/features/admin/DishesPage';
import { DishEditPage } from '@/features/admin/DishEditPage';
import { CategoriesAdminPage, IngredientsAdminPage, UnitsAdminPage } from '@/features/admin/CatalogAdminPages';
import { AuditAdminPage, DataAdminPage, OrdersAdminPage, ReviewsAdminPage, SellingAdminPage, UsersAdminPage } from '@/features/admin/OpsAdminPages';
import { NotFoundPage } from './NotFoundPage';

const userOnly = (el: JSX.Element) => <RequireAuth roles={['user']}>{el}</RequireAuth>;

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/nguyen-lieu', element: <IngredientSearchPage /> },
      { path: '/kham-pha', element: <ExplorePage /> },
      { path: '/mon/:slug', element: <DishDetailPage /> },
      { path: '/dang-nhap', element: <LoginPage /> },
      { path: '/dang-ky', element: <RegisterPage /> },
      { path: '/quen-mat-khau', element: <ForgotPasswordPage /> },
      { path: '/dat-lai-mat-khau', element: <ResetPasswordPage /> },
      { path: '/gio-hang', element: userOnly(<CartPage />) },
      { path: '/dat-hang', element: userOnly(<CheckoutPage />) },
      { path: '/dat-hang/thanh-cong/:id', element: userOnly(<OrderSuccessPage />) },
      {
        path: '/tai-khoan',
        element: userOnly(<AccountLayout />),
        children: [
          { index: true, element: <Navigate to="ho-so" replace /> },
          { path: 'ho-so', element: <ProfilePage /> },
          { path: 'so-thich', element: <ProfilePage /> },
          { path: 'yeu-thich', element: <FavoritesPage /> },
          { path: 'lich-su', element: <HistoryPage /> },
          { path: 'don-hang', element: <MyOrdersPage /> },
          { path: 'don-hang/:id', element: <MyOrderDetailPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <RequireAuth roles={['admin', 'super_admin']}><AdminLayout /></RequireAuth>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'mon-an', element: <DishesPage /> },
      { path: 'mon-an/:id', element: <DishEditPage /> },
      { path: 'nguyen-lieu', element: <IngredientsAdminPage /> },
      { path: 'don-vi', element: <UnitsAdminPage /> },
      { path: 'danh-muc', element: <CategoriesAdminPage /> },
      { path: 'danh-gia', element: <ReviewsAdminPage /> },
      { path: 'thuc-don-ban', element: <SellingAdminPage /> },
      { path: 'don-hang', element: <OrdersAdminPage /> },
      { path: 'tai-khoan', element: <UsersAdminPage /> },
      { path: 'nhat-ky', element: <RequireAuth roles={['super_admin']}><AuditAdminPage /></RequireAuth> },
      { path: 'du-lieu', element: <RequireAuth roles={['super_admin']}><DataAdminPage /></RequireAuth> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
