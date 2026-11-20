import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FiLogOut } from 'react-icons/fi';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { http } from '@/lib/api';
import { authClient, useSession } from '@/lib/auth';
import { PageShell } from '@/ui';
import { NAV, NAV_BOTTOM, activeHref, navFor } from './nav';

type Counts = { newApplicants: number | null; unreadMessages: number | null; pendingBookings: number | null };

/** Admin chrome: vantara-ui PageShell (sidebar + header + footer) around every screen. */
export function AdminLayout() {
  const { data } = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const role = (data?.user as { role?: string } | undefined)?.role;

  // Sidebar badges (unread inbox, new applicants, pending bookings)
  const { data: counts } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => http<Counts>('/admin/dashboard'),
    refetchInterval: 60_000,
  });
  const badges: Record<string, number | null | undefined> = {
    applicants: counts?.newApplicants,
    inbox: counts?.unreadMessages,
    bookings: counts?.pendingBookings,
  };
  const withBadges = (items: ReturnType<typeof navFor>) =>
    items.map((i) => (badges[i.id] ? { ...i, badge: badges[i.id] ?? undefined } : i));

  return (
    <PageShell
      logoText="ITTI Admin"
      sidebarItems={withBadges(navFor(role, NAV))}
      sidebarBottomItems={navFor(role, NAV_BOTTOM)}
      activeRoute={activeHref(pathname)}
      isSidebarCollapsed={collapsed}
      onToggleSidebarCollapse={() => setCollapsed((c) => !c)}
      onNavigate={(href, e) => {
        e.preventDefault();
        navigate(href);
      }}
      headerProps={{
        rightContent: (
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-text-secondary sm:inline">
              {data?.user.name} <span className="text-text-tertiary">· {role?.replace('_', ' ')}</span>
            </span>
            <button
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
              onClick={async () => {
                await authClient.signOut();
                navigate('/login');
              }}
            >
              <FiLogOut aria-hidden /> Sign out
            </button>
          </div>
        ),
      }}
      footerProps={{ copyright: `© ${new Date().getFullYear()} ITTI Ghana · Built by HostHaus` }}
      sidebarClassName="itti-sidebar"
      contentClassName="p-6"
    >
      <Outlet />
    </PageShell>
  );
}
