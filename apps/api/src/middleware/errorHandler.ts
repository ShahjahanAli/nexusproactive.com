import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.errors.map((e) => e.message).join(', '),
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  console.error(err);
  const status = (err as Error & { status?: number }).status ?? 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    code: (err as Error & { code?: string }).code ?? 'INTERNAL_ERROR',
  });
}
