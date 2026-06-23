import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

// Paths that don't require authentication
const publicPaths = [
  '/',
  '/login',
  '/daftar',
  '/auth/login',
  '/auth/register',
  '/auth/lupa-password',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/send-otp',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/maintenance',
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public paths
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Protect API routes
  if (pathname.startsWith('/api/')) {
    // API routes will handle auth internally
    return NextResponse.next();
  }

  // Protect dashboard and other private pages
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/transactions')) {
    // Check if token exists in cookie or localStorage (this won't work for client-side storage)
    // Client will handle this check
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
