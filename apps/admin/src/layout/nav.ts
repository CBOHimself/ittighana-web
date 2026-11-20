import { can, type Permission } from '@itti/schemas';
import type { IconType } from 'react-icons';
import {
  FiBookOpen,
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiFileText,
  FiHome,
  FiImage,
  FiInbox,
  FiLayers,
  FiMapPin,
  FiSettings,
  FiTag,
  FiUserCheck,
  FiUsers,
  FiBookmark,
  FiClock,
  FiFeather,
  FiGrid,
} from 'react-icons/fi';

export type NavEntry = { id: string; label: string; href: string; icon: IconType; permission: Permission };

/** Sidebar navigation (filtered by the signed-in user's role). */
export const NAV: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: FiHome, permission: 'content:read' },
  { id: 'pages', label: 'Pages', href: '/content/pages', icon: FiFileText, permission: 'content:read' },
  { id: 'course-categories', label: 'Course categories', href: '/content/course-categories', icon: FiTag, permission: 'content:read' },
  { id: 'courses', label: 'Courses', href: '/content/courses', icon: FiBookOpen, permission: 'content:read' },
  { id: 'news', label: 'News', href: '/content/news', icon: FiFeather, permission: 'content:read' },
  { id: 'careers', label: 'Careers', href: '/content/careers', icon: FiBriefcase, permission: 'content:read' },
  { id: 'events', label: 'Events', href: '/content/events', icon: FiCalendar, permission: 'content:read' },
  { id: 'gallery', label: 'Gallery', href: '/content/gallery', icon: FiImage, permission: 'content:read' },
  { id: 'articles', label: 'Student articles', href: '/content/articles', icon: FiBookmark, permission: 'content:read' },
  { id: 'spaces', label: 'Spaces', href: '/content/spaces', icon: FiMapPin, permission: 'content:read' },
  { id: 'bookings', label: 'Bookings', href: '/campus/bookings', icon: FiClock, permission: 'bookings:manage' },
  { id: 'forms', label: 'Forms', href: '/content/forms', icon: FiClipboard, permission: 'forms:manage' },
  { id: 'applicants', label: 'Applicants', href: '/applicants', icon: FiUserCheck, permission: 'submissions:read' },
  { id: 'inbox', label: 'Inbox', href: '/inbox', icon: FiInbox, permission: 'inbox:read' },
  { id: 'media', label: 'Media library', href: '/media', icon: FiLayers, permission: 'content:read' },
  { id: 'templates', label: 'Templates', href: '/templates', icon: FiGrid, permission: 'content:read' },
];

export const NAV_BOTTOM: NavEntry[] = [
  { id: 'users', label: 'Users & roles', href: '/users', icon: FiUsers, permission: 'users:manage' },
  { id: 'settings', label: 'Settings', href: '/settings', icon: FiSettings, permission: 'settings:manage' },
];

export const navFor = (role: string | undefined, items: NavEntry[]) =>
  items.filter((i) => can(role, i.permission)).map(({ id, label, href, icon }) => ({ id, label, href, icon }));

/** Longest nav href that prefixes the current path → active item. */
export function activeHref(pathname: string) {
  const all = [...NAV, ...NAV_BOTTOM].map((n) => n.href).sort((a, b) => b.length - a.length);
  return all.find((h) => (h === '/' ? pathname === '/' : pathname.startsWith(h))) ?? '/';
}

