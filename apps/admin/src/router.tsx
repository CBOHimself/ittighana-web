import { createBrowserRouter, Navigate } from 'react-router';
import { AdminLayout } from './layout/AdminLayout';
import { RequireAuth } from './layout/RequireAuth';
import { ApplicantsPage } from './pages/ApplicantsPage';
import { BookingsPage } from './pages/BookingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { InboxPage } from './pages/InboxPage';
import { LoginPage } from './pages/LoginPage';
import { MediaPage } from './pages/MediaPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ResourceEditPage } from './pages/ResourceEditPage';
import { ResourceListPage } from './pages/ResourceListPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { UsersPage } from './pages/UsersPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'content/:resource', element: <ResourceListPage /> },
      { path: 'content/:resource/new', element: <ResourceEditPage /> },
      { path: 'content/:resource/:id', element: <ResourceEditPage /> },
      { path: 'applicants', element: <ApplicantsPage /> },
      { path: 'applicants/:id', element: <ApplicantsPage /> },
      { path: 'campus/bookings', element: <BookingsPage /> },
      { path: 'campus/bookings/:id', element: <BookingsPage /> },
      { path: 'inbox', element: <InboxPage /> },
      { path: 'inbox/:id', element: <InboxPage /> },
      { path: 'media', element: <MediaPage /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
], {
  // Served from /staff (vite base); keep in-app paths relative to it.
  basename: import.meta.env.BASE_URL.replace(/\/$/, ''),
});
