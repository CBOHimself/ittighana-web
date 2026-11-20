import { Article, AuditLog, Career, Course, CourseCategory, Event, Form, GalleryAlbum, News, Page, Space } from '@itti/db';
import {
  articleInput,
  careerInput,
  courseCategoryInput,
  courseInput,
  eventFields,
  eventInput,
  formInput,
  galleryAlbumInput,
  newsInput,
  pageInput,
  paginationQuery,
  spaceInput,
} from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { paginate } from '../../lib/paginate';
import { requireAuth, requirePermission } from '../../middleware/rbac';
import type { AppEnv } from '../../types';
import { bookingRoutes } from './bookings';
import { crudRoutes } from './crud';
import { dashboardRoutes } from './dashboard';
import { inboxRoutes } from './inbox';
import { mediaRoutes } from './media';
import { settingsRoutes } from './settings';
import { submissionAdminRoutes } from './submissions';
import { templateRoutes } from './templates';
import { userRoutes } from './users';

const lite = '-blocks -gallery -seo';

export const adminRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/me', (c) => c.json(c.get('user')))
  .route('/dashboard', dashboardRoutes)
  .route('/pages', crudRoutes({ entity: 'page', model: Page, input: pageInput, searchField: 'title', listProjection: lite }))
  .route(
    '/course-categories',
    crudRoutes({
      entity: 'course-category',
      model: CourseCategory,
      input: courseCategoryInput,
      searchField: 'name',
      defaultSort: { order: 1 },
      extraTags: ['course'],
    }),
  )
  .route('/courses', crudRoutes({ entity: 'course', model: Course, input: courseInput, searchField: 'title', listProjection: lite, templated: 'course' }))
  .route('/careers', crudRoutes({ entity: 'career', model: Career, input: careerInput, searchField: 'title', listProjection: lite, templated: 'career' }))
  .route(
    '/events',
    crudRoutes({
      entity: 'event',
      model: Event,
      input: eventInput,
      patchInput: eventFields.partial(),
      searchField: 'title',
      defaultSort: { start: -1 },
      listProjection: lite,
      extraTags: ['calendar'],
      templated: 'event',
    }),
  )
  .route('/gallery', crudRoutes({ entity: 'gallery', model: GalleryAlbum, input: galleryAlbumInput, searchField: 'title', defaultSort: { order: 1 } }))
  .route('/articles', crudRoutes({ entity: 'article', model: Article, input: articleInput, searchField: 'title', listProjection: lite, templated: 'article' }))
  .route('/news', crudRoutes({ entity: 'news', model: News, input: newsInput, searchField: 'title', defaultSort: { publishedAt: -1 }, listProjection: lite, templated: 'news' }))
  .route('/templates', templateRoutes)
  .route('/spaces', crudRoutes({ entity: 'space', model: Space, input: spaceInput, searchField: 'name', listProjection: lite }))
  .route(
    '/forms',
    crudRoutes({
      entity: 'form',
      model: Form,
      input: formInput,
      searchField: 'name',
      read: 'forms:manage',
      write: 'forms:manage',
      publish: 'forms:manage',
    }),
  )
  .route('/bookings', bookingRoutes)
  .route('/submissions', submissionAdminRoutes)
  .route('/inbox', inboxRoutes)
  .route('/media', mediaRoutes)
  .route('/settings', settingsRoutes)
  .route('/users', userRoutes)
  .get('/audit-log', requirePermission('audit:read'), zValidator('query', paginationQuery), async (c) =>
    c.json(await paginate(AuditLog, {}, c.req.valid('query'), { createdAt: -1 })),
  );
