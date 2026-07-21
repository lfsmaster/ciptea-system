import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button, Card, Field, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={(location.state as {from?: {pathname?: string}})?.from?.pathname || '/'} replace />;
  async function submit(e: FormEvent) { e.preventDefault(); if (!supabase) return; setBusy(true); setError(''); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setError(error.message); setBusy(false); }
  return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-900 to-brand-700 p-4"><Card className="w-full max-w-md p-8"><div className="mb-7 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-900 text-xl font-black text-white">C</div><h1 className="text-2xl font-bold">Sistema CIPTEA</h1><p className="mt-1 text-sm text-slate-600">Acesso administrativo seguro</p></div><form onSubmit={submit} className="space-y-4"><Field label="E-mail" required><Input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></Field><Field label="Senha" required><Input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></Field>{error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}<Button className="w-full" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</Button><a className="block text-center text-sm font-semibold text-brand-700 hover:underline" href="#/recuperar-senha">Esqueci minha senha</a></form></Card></main>;
}
