import { z } from 'zod';

export const emailSchema = z.string().email();
export const phoneSchema = z
  .string()
  .min(6)
  .max(20)
  .regex(/^[+()\d\s-]+$/, 'Invalid phone number');

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format');
