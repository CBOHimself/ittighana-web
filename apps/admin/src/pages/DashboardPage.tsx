import { useQuery } from '@tanstack/react-query';
import { FiCalendar, FiClock, FiInbox, FiUserCheck } from 'react-icons/fi';
import { Link } from 'react-router';
import { http } from '@/lib/api';
import { Card, EmptyState, MetricTile, PageTitle, Spinner } from '@/ui';

type Dashboard = {
  newApplicants: number | null;
  unreadMessages: number | null;
  pendingBookings: number | null;
  upcomingEvents: Array<{ _id: string; title: string; start: string; status: string }>;
  recentActivity: Array<{ _id: string; action: string; entity: string; userEmail?: string; createdAt: string }>;
};

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => http<Dashboard>('/admin/dashboard') });
  if (isLoading || !data) return <Spinner />;

  return (
    <>
      <PageTitle title="Dashboard" subtitle="What needs your attention today" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.newApplicants !== null && (
          <Link to="/applicants"><MetricTile label="New applicants" value={data.newApplicants} icon={<FiUserCheck />} tone="primary" /></Link>
        )}
        {data.unreadMessages !== null && (
          <Link to="/inbox"><MetricTile label="Unread messages" value={data.unreadMessages} icon={<FiInbox />} tone="warning" /></Link>
        )}
        {data.pendingBookings !== null && (
          <Link to="/campus/bookings"><MetricTile label="Pending bookings" value={data.pendingBookings} icon={<FiClock />} tone="danger" /></Link>
        )}
        <Link to="/content/events"><MetricTile label="Upcoming events" value={data.upcomingEvents.length} icon={<FiCalendar />} tone="success" /></Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming events">
          {data.upcomingEvents.length === 0 ? (
            <EmptyState title="No upcoming events" description="Events you publish will appear here." icon={<FiCalendar />} />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {data.upcomingEvents.map((e) => (
                <li key={e._id} className="flex justify-between py-2">
                  <Link to={`/content/events/${e._id}`} className="font-medium hover:text-primary-600">{e.title}</Link>
                  <span className="text-text-secondary">{new Date(e.start).toLocaleDateString('en-GB')}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {data.recentActivity.length > 0 && (
          <Card title="Recent activity">
            <ul className="space-y-2 text-sm">
              {data.recentActivity.map((a) => (
                <li key={a._id} className="text-text-secondary">
                  <span className="font-medium text-text-primary">{a.userEmail ?? 'System'}</span> {a.action} {a.entity}
                  <span className="text-text-tertiary"> · {new Date(a.createdAt).toLocaleString('en-GB')}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
