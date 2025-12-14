import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to handle authentication from gateway proxy headers.
 *
 * When accessed through the gateway (localhost:7000/dev-studio or 134.199.209.140:7000/dev-studio),
 * the gateway adds X-User-* headers. This middleware reads them and sets a cookie
 * so the client-side UserContext can access the user data.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Check for gateway auth headers
  const userId = request.headers.get('x-user-id');
  const userEmail = request.headers.get('x-user-email');
  const userName = request.headers.get('x-user-name');
  const userRole = request.headers.get('x-user-role');
  const gatewayAuth = request.headers.get('x-gateway-auth');

  // If we have gateway headers, set the user cookie
  if (gatewayAuth === 'true' && userId && userEmail) {
    const userData = {
      id: userId,
      email: userEmail,
      name: userName || userEmail.split('@')[0],
      role: userRole || 'developer',
    };

    // Set cookie for client-side UserContext to read
    response.cookies.set('dev_user', JSON.stringify(userData), {
      path: '/',
      maxAge: 86400, // 24 hours
      sameSite: 'lax',
    });
  }

  return response;
}

// Run middleware on all pages (not API routes or static files)
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
