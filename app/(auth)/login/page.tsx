import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function Page() {
  async function devLoginAction(formData: FormData) {
    'use server';
    const maxAge = 60 * 60 * 24;
    cookies().set('lifebook_session', 'dev', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge });
    redirect('/dashboard');
  }
  return (
    <main className='card'>
      <h1 style={{marginTop:0}}>Login (Dev Stub)</h1>
      <p>Temporary development login. Real auth replaces this in Step 17.</p>
      <form action={devLoginAction}>
        <button type='submit'>Sign in (set cookie)</button>
      </form>
    </main>
  );
}