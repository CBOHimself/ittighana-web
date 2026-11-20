import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Course, Media, News, Template } from '../models';
import type { Migration } from './types';

/**
 * Content from the 16 Nov 2026 WordPress exports, keeping nothing from before 2024:
 * - Hotel Hospitality Management: the course write-up (stored as post text in WordPress)
 *   moves into its template fields.
 * - Hospitality and Customer Service Excellence: overview, learning outcomes and
 *   training methodology from draft post 4012 move into the course fields.
 * - Removes news posts from before 2024 (2016, 2019, 2020, 2021) and the two drafts
 *   (4012 is now course content; 5330 was an unfinished design with placeholder text).
 * - 2025 news posts that used 2019/2020 photos as covers get November 2025 photos.
 * - Removes pre-2024 WordPress images from the media library unless a page still uses them
 *   (the files stay on the media server).
 * - Course templates 2 and 3 get a "Course Content" section (course_content field), shown
 *   only when a course fills it in.
 * Course fields, templates and covers are read from content/itti, so the files there are the source.
 */
const COURSES = ['hotel-hospitality-management', 'hospitality-and-customer-service-excellence'];
const COURSE_FIELDS = ['course_overview', 'who_needs_this_course', 'learning_outcomes', 'training_methodology', 'course_content', 'course_material', 'certification'];
const TEMPLATES = ['itti-course-template-2-4265', 'itti-course-template-3-4271'];
const REMOVED_NEWS_WP_IDS = [1, 1426, 2627, 2701, 4012, 5330];
const NEW_COVERS = ['admissions-are-currently-ongoing-for-the-2025-2026-academic-year', 'new-registrations', 'orientation-for-new-classes'];
const PRE_2024 = /^wp-content\/uploads\/(19\d\d|20[01]\d|202[0-3])\//;
/** Still shown on the Courses and Careers pages (live-site layout), so kept. */
const STILL_USED = ['wp-content/uploads/2019/09/slider1d.jpg', 'wp-content/uploads/2019/09/hotel.jpg', 'wp-content/uploads/2019/09/airport.jpg'];

export const m006: Migration = {
  id: '20261116-06-wordpress-2024-cleanup',
  description: 'Fill two course write-ups, drop pre-2024 news and media, refresh 2025 news covers',
  async up({ contentDir, log, dryRun }) {
    const read = (rel: string) => {
      const f = path.join(contentDir, rel);
      return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
    };

    for (const slug of TEMPLATES) {
      const t = read(`templates/${slug}.json`);
      if (!t) { log(`skipped template ${slug}: file not found`); continue; }
      log(`template ${slug}: layout + fields updated`);
      if (!dryRun) await Template.updateOne({ slug }, { $set: { layout: t.layout, fields: t.fields } });
    }

    for (const slug of COURSES) {
      const c = read(`courses/${slug}.json`);
      if (!c) { log(`skipped course ${slug}: file not found`); continue; }
      const set: Record<string, unknown> = {};
      for (const k of COURSE_FIELDS) if (c.fields?.[k]) set[`fields.${k}`] = c.fields[k];
      log(`course ${slug}: ${Object.keys(set).length} fields`);
      if (!dryRun) await Course.updateOne({ slug }, { $set: set });
    }

    const news = await News.countDocuments({ wpId: { $in: REMOVED_NEWS_WP_IDS } });
    log(`news posts removed: ${news}`);
    if (!dryRun) await News.deleteMany({ wpId: { $in: REMOVED_NEWS_WP_IDS } });

    for (const slug of NEW_COVERS) {
      const n = read(`news/${slug}.json`);
      if (!n?.cover) continue;
      log(`news ${slug}: cover → ${n.cover.url}`);
      if (!dryRun) await News.updateOne({ slug }, { $set: { cover: n.cover } });
    }

    const media = await Media.countDocuments({ source: 'wordpress', path: { $regex: PRE_2024, $nin: STILL_USED } });
    log(`pre-2024 media records removed: ${media}`);
    if (!dryRun) await Media.deleteMany({ source: 'wordpress', path: { $regex: PRE_2024, $nin: STILL_USED } });
  },
};
