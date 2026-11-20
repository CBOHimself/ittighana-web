import { HTTPException } from 'hono/http-exception';
import mongoose from 'mongoose';

export const notFound = (what = 'Resource') => new HTTPException(404, { message: `${what} not found` });
export const badRequest = (message: string) => new HTTPException(400, { message });
export const forbidden = (message = 'Forbidden') => new HTTPException(403, { message });
export const conflict = (message: string) => new HTTPException(409, { message });

export function assertId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid id');
  return id;
}

export function clientIp(headers: Headers) {
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  );
}
