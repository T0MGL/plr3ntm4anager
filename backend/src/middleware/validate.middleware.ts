import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    });
    next();
  } catch (error: unknown) {
    const message =
      error && typeof error === 'object' && 'errors' in error
        ? (error as { errors?: { message?: string }[] }).errors?.[0]?.message ?? 'Validation error'
        : 'Validation error';
    res.status(400).json({ error: message });
  }
};
