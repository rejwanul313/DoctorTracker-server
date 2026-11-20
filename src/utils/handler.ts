import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, type ZodType } from 'zod';

type Schemas = { body?: ZodType; query?: ZodType; params?: ZodType };
type Out<T> = T extends ZodType ? z.output<T> : undefined;

export interface HandlerContext<S extends Schemas> {
  body: Out<S['body']>;
  query: Out<S['query']>;
  params: Out<S['params']>;
  req: Request;
  res: Response;
}

/**
 * Builds a typed Express handler:
 *  1. validates params, query and body with zod (all issues reported together),
 *  2. calls `fn` with the parsed, typed values,
 *  3. sends the returned value as JSON (or 204 when nothing is returned).
 * Errors are forwarded to the central error handler.
 */
export function handler<S extends Schemas>(
  schemas: S,
  fn: (ctx: HandlerContext<S>) => Promise<unknown> | unknown,
): RequestHandler {
  const shape: Record<string, ZodType> = {};
  if (schemas.params) shape.params = schemas.params;
  if (schemas.query) shape.query = schemas.query;
  if (schemas.body) shape.body = schemas.body;
  const schema = z.object(shape);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        params: req.params,
        query: req.query,
        body: req.body ?? {},
      })) as Record<string, unknown>;

      const result = await fn({
        params: parsed.params,
        query: parsed.query,
        body: parsed.body,
        req,
        res,
      } as HandlerContext<S>);

      if (res.headersSent) return;
      if (result === undefined) res.status(204).end();
      else res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
