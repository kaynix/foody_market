import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const statusCode = err.statusCode ?? 500;
  const isExpected = statusCode < 500;
  const message = isExpected ? err.message : 'Internal Server Error';

  console.error(
    `[Error] ${statusCode} - ${isExpected ? (err.code ?? err.name) : 'UNEXPECTED_ERROR'}`,
  );

  res.status(statusCode).json({
    success: false,
    message,
    statusCode,
    ...(err.code ? { code: err.code } : {}),
  });
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    statusCode: 404,
  });
};
