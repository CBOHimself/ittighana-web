import { Article, Course, News } from '../models';
import type { Migration } from './types';

/**
 * Point records at their templates and move data into template fields:
 * - courses: `layoutTemplate` (old name) → `template`
 * - news: imported HTML is copied into fields.body (templates read the body field)
 * - student articles: author name/programme → fields.author / fields.programme
 */
export const m005: Migration = {
  id: '20261116-05-template-refs',
  description: 'Link courses to their templates and move news/article data into template fields',
  async up({ db, log, dryRun }) {
    const courses = await db.collection('courses').countDocuments({ layoutTemplate: { $exists: true } });
    log(`courses with layoutTemplate: ${courses}`);
    if (!dryRun && courses) {
      await db.collection('courses').updateMany({ layoutTemplate: { $exists: true }, $or: [{ template: null }, { template: { $exists: false } }, { template: 'classic' }] }, [{ $set: { template: '$layoutTemplate' } }]);
      await db.collection('courses').updateMany({ layoutTemplate: { $exists: true } }, { $unset: { layoutTemplate: '' } });
    }
    if (!dryRun) await Course.updateMany({ template: { $in: ['classic', 'split-hero', 'gallery-led'] } }, { template: null });

    const news = await News.find({ html: { $nin: [null, ''] }, 'fields.body': { $exists: false } }).select('_id html').lean();
    log(`news posts getting fields.body: ${news.length}`);
    if (!dryRun) for (const n of news) await News.updateOne({ _id: n._id }, { $set: { 'fields.body': n.html } });

    const articles = await Article.find({ 'author.name': { $exists: true }, 'fields.author': { $exists: false } }).select('_id author').lean();
    log(`student articles getting fields.author: ${articles.length}`);
    if (!dryRun) {
      for (const a of articles) {
        const author = a.author as { name?: string; programme?: string } | undefined;
        await Article.updateOne({ _id: a._id }, { $set: { 'fields.author': author?.name, ...(author?.programme ? { 'fields.programme': author.programme } : {}) } });
      }
    }
  },
};
