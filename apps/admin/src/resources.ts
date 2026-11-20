import type { ContentType, Permission } from '@itti/schemas';

/**
 * Content resources managed through the generic list/edit screens.
 * Each maps to /v1/admin/<path> on the API.
 */
export type Resource = {
  key: string;
  path: string;
  label: string;
  singular: string;
  titleField: string;
  group: 'Content' | 'Campus' | 'Admissions';
  permission: Permission;
  /** Template options shown in the editor (dynamic pages). */
  templates?: string[];
  hasStatus?: boolean;
  /** Templated content: pick a template, then fill in its fields (TemplatedEditor). */
  contentType?: ContentType;
};

export const RESOURCES: Resource[] = [
  { key: 'pages', path: 'pages', label: 'Pages', singular: 'Page', titleField: 'title', group: 'Content', permission: 'content:read', templates: ['default', 'home', 'about', 'landing'], hasStatus: true },
  { key: 'course-categories', path: 'course-categories', label: 'Course categories', singular: 'Category', titleField: 'name', group: 'Content', permission: 'content:read' },
  { key: 'courses', path: 'courses', label: 'Courses', singular: 'Course', titleField: 'title', group: 'Content', permission: 'content:read', hasStatus: true, contentType: 'course' },
  { key: 'news', path: 'news', label: 'News', singular: 'News post', titleField: 'title', group: 'Content', permission: 'content:read', hasStatus: true, contentType: 'news' },
  { key: 'careers', path: 'careers', label: 'Careers', singular: 'Career opening', titleField: 'title', group: 'Content', permission: 'content:read', hasStatus: true, contentType: 'career' },
  { key: 'events', path: 'events', label: 'Events', singular: 'Event', titleField: 'title', group: 'Content', permission: 'content:read', hasStatus: true, contentType: 'event' },
  { key: 'gallery', path: 'gallery', label: 'Gallery', singular: 'Album', titleField: 'title', group: 'Campus', permission: 'content:read', hasStatus: true },
  { key: 'articles', path: 'articles', label: 'Student articles', singular: 'Student article', titleField: 'title', group: 'Campus', permission: 'content:read', hasStatus: true, contentType: 'article' },
  { key: 'spaces', path: 'spaces', label: 'Spaces', singular: 'Space', titleField: 'name', group: 'Campus', permission: 'content:read', hasStatus: true },
  { key: 'forms', path: 'forms', label: 'Forms', singular: 'Form', titleField: 'name', group: 'Admissions', permission: 'forms:manage', hasStatus: true },
];

export const resourceByKey = (key: string) => RESOURCES.find((r) => r.key === key);
