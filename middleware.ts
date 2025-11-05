import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith('/dashboard')) {
    const has = req.cookies.get('lifebook_session')?.value;
    if (!has) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ['/dashboard/:path*'] };
