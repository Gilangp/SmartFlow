/**
 * API Error Handler Utilities
 * Centralized error handling for API routes
 */

import { NextResponse } from 'next/server';

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}

export class AppError extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500, details?: any) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const ApiErrors = {
  UNAUTHORIZED: () => new AppError('Unauthorized', 'UNAUTHORIZED', 401),
  FORBIDDEN: () => new AppError('Forbidden', 'FORBIDDEN', 403),
  NOT_FOUND: (resource: string) => new AppError(`${resource} not found`, 'NOT_FOUND', 404),
  BAD_REQUEST: (message: string) => new AppError(message, 'BAD_REQUEST', 400),
  CONFLICT: (message: string) => new AppError(message, 'CONFLICT', 409),
  INTERNAL_ERROR: (message: string = 'Internal server error') => 
    new AppError(message, 'INTERNAL_ERROR', 500),
  VALIDATION_ERROR: (details: any) => 
    new AppError('Validation failed', 'VALIDATION_ERROR', 400, details),
};

export function handleApiError(error: any) {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
      { status: error.statusCode }
    );
  }

  // Unknown error
  return NextResponse.json(
    {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
    { status: 500 }
  );
}

export function successResponse<T>(data: T, message: string = 'Success', statusCode: number = 200) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status: statusCode }
  );
}
