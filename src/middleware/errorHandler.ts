import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found.`));
};

/** Strips the `body.` / `query.` / `params.` prefix so the client can map errors to form fields. */
function zodDetails(err: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.slice(1).join('.') || String(issue.path[0] ?? '_');
    if (!details[path]) details[path] = issue.message;
  }
  return details;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof ZodError) {
    apiError = ApiError.badRequest('Some fields are invalid.', zodDetails(err));
  } else if (err instanceof mongoose.Error.CastError) {
    apiError = ApiError.badRequest(`Invalid value for ${err.path}.`, {
      [err.path]: 'Invalid value',
    });
  } else if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(
      Object.entries(err.errors).map(([key, e]) => [key, e.message]),
    );
    apiError = ApiError.badRequest('Some fields are invalid.', details);
  } else if (isDuplicateKeyError(err)) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    apiError = ApiError.conflict(`A record with this ${field} already exists.`, {
      [field]: `This ${field} is already in use.`,
    });
  } else if (err instanceof SyntaxError && 'body' in err) {
    apiError = ApiError.badRequest('Malformed JSON body.');
  } else {
    logger.error({ err, path: req.path }, 'Unhandled error');
    apiError = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }

  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  });
};

function isDuplicateKeyError(
  err: unknown,
): err is { code: 11000; keyValue?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}
