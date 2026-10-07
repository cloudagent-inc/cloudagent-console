import React, { useEffect, useState } from 'react';
import { LockKeyhole, Loader2 } from 'lucide-react';
import { requestJson } from '@/api/clients/httpClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LocalAuthGate({ children }) {
  const [status, setStatus] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    requestJson('/auth/status').then((result) => {
      if (active) setStatus(result);
    }).catch((failure) => {
      if (active) setError(failure.message);
    });
    const requireLogin = () => {
      setPassword('');
      setError('Your session has ended. Unlock the console to continue.');
      setStatus({ enabled: true, authenticated: false });
    };
    window.addEventListener('cloudagent:authentication-required', requireLogin);
    return () => {
      active = false;
      window.removeEventListener('cloudagent:authentication-required', requireLogin);
    };
  }, []);

  async function unlock(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const result = await requestJson('/auth/login', { method: 'POST', body: { password } });
      setPassword('');
      setStatus(result);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  if (status?.authenticated) return children;
  if (!status && !error) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" aria-label="Checking access" /></div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form onSubmit={unlock} className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <LockKeyhole className="h-8 w-8 text-slate-700" />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Unlock CloudAgent Console</h1>
          <p className="mt-2 text-sm text-slate-500">Enter your app password to access your workspace.</p>
        </div>
        {status && <div className="space-y-2">
          <Label htmlFor="unlock-password">Password</Label>
          <Input id="unlock-password" type="password" autoComplete="current-password" autoFocus required
            maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} />
        </div>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          {status ? <Button type="submit" disabled={pending || !password} className="flex-1">
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{pending ? 'Unlocking…' : 'Unlock'}
          </Button> : <Button type="button" onClick={() => window.location.reload()}>Retry</Button>}
          {window.cloudAgentRuntime?.quitApp && <Button type="button" variant="outline" onClick={() => window.cloudAgentRuntime.quitApp()}>Quit</Button>}
        </div>
        <p className="text-xs text-slate-500">MCP access and background workflows remain unavailable until the console is unlocked.</p>
      </form>
    </div>
  );
}
