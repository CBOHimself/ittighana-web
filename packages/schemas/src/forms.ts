import { z } from 'zod';
import { slug } from './common';

/** Field types supported by the Enroll Now / application form builder. */
export const fieldType = z.enum([
  'text',
  'textarea',
  'email',
  'phone',
  'number',
  'date',
  'select',
  'radio',
  'checkbox',
  'checkboxGroup',
  'file',
  'heading',
  'paragraph',
]);
export type FieldType = z.infer<typeof fieldType>;

export const formField = z.object({
  id: z.string().min(1),
  /** Key used in submission data. */
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  type: fieldType,
  label: z.string(),
  placeholder: z.string().optional(),
  help: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      /** file fields: accepted MIME types + max size in MB */
      accept: z.array(z.string()).optional(),
      maxSizeMb: z.number().positive().optional(),
    })
    .optional(),
  /** Show this field only when another field has a given value. */
  showIf: z.object({ field: z.string(), equals: z.string() }).optional(),
  width: z.enum(['full', 'half']).default('full'),
});
export type FormField = z.infer<typeof formField>;

export const formInput = z.object({
  name: z.string().min(1),
  slug,
  description: z.string().optional(),
  kind: z.enum(['enrolment', 'career', 'event-registration', 'general']).default('enrolment'),
  fields: z.array(formField).min(1),
  settings: z
    .object({
      notifyEmails: z.array(z.string().email()).default([]),
      confirmationMessage: z.string().default('Thank you. We have received your application.'),
      sendConfirmationEmail: z.boolean().default(true),
      opensAt: z.coerce.date().optional(),
      closesAt: z.coerce.date().optional(),
      submitLabel: z.string().default('Submit'),
    })
    .default({ notifyEmails: [], confirmationMessage: 'Thank you. We have received your application.', sendConfirmationEmail: true, submitLabel: 'Submit' }),
  status: z.enum(['draft', 'published', 'closed']).default('draft'),
});
export type FormInput = z.infer<typeof formInput>;

export const submissionStatus = z.enum(['new', 'reviewing', 'shortlisted', 'accepted', 'rejected', 'withdrawn']);
export type SubmissionStatus = z.infer<typeof submissionStatus>;

/**
 * Build a Zod validator for a form's submission data from its field definitions.
 * Used by the API (authoritative) and the web form (instant feedback).
 * File fields are validated separately (multipart) and arrive as stored file refs.
 */
export function buildSubmissionValidator(fields: FormField[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    if (f.type === 'heading' || f.type === 'paragraph' || f.type === 'file') continue;
    let s: z.ZodType;
    switch (f.type) {
      case 'email':
        s = z.string().email();
        break;
      case 'number':
        s = z.coerce.number();
        break;
      case 'checkbox':
        s = z.coerce.boolean();
        break;
      case 'checkboxGroup':
        s = z.array(z.string());
        break;
      case 'select':
      case 'radio': {
        const values = (f.options ?? []).map((o) => o.value);
        s = values.length ? z.enum(values as [string, ...string[]]) : z.string();
        break;
      }
      default: {
        let str = z.string().trim();
        if (f.validation?.min !== undefined) str = str.min(f.validation.min);
        if (f.validation?.max !== undefined) str = str.max(f.validation.max);
        if (f.validation?.pattern) str = str.regex(new RegExp(f.validation.pattern));
        s = str;
      }
    }
    if (!f.required) s = s.optional().or(z.literal('')) as z.ZodType;
    else if (f.type === 'checkbox') s = z.literal(true);
    shape[f.name] = s;
  }
  return z.object(shape);
}
