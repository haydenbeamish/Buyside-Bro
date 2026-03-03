import type { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(res: Response, status: number, message: string, code?: string) {
  return res.status(status).json({ error: message, code, status });
}

/**
 * Express error-handling middleware.
 * Register AFTER all routes: app.use(errorHandler);
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      status: err.statusCode,
    });
  }

  console.error("[Unhandled Error]", err);
  return res.status(500).json({
    error: "Internal server error",
    status: 500,
  });
}
