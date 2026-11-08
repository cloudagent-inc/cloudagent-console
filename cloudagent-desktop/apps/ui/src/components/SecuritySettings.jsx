import React, { useEffect, useState } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { requestJson } from '@/api/clients/httpClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function SecuritySettings({ directoryPendingRestart }) {
  const [savedEnabled, setSavedEnabled] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [serverPendingRestart, setServerPendingRestart] = useState(false);
  const needsRestart = directoryPendingRestart ?? serverPendingRestart;

  useEffect(() => {
    let active = true;
    requestJson('/auth/security').then((result) => {
      if (active) { setSavedEnabled(result.enabled); setEnabled(result.enabled); setServerPendingRestart(result.pendingRestart); }
    }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, []);

  async function save(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (enabled && password !== confirmation) { setError('The new passwords do not match.'); return; }
    setPending(true);
    try {
      const result = await requestJson('/auth/security', { method: 'PUT', body: { enabled, currentPassword, password } });
      setSavedEnabled(result.enabled);
      setCurrentPassword(''); setPassword(''); setConfirmation('');
      setMessage(result.enabled ? 'Password protection saved. You will need your password on the next launch. Other browser sessions must unlock again.' : 'Password protection disabled.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  return <Card id="security-settings" className="scroll-mt-6">
    <CardHeader>
      <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-slate-600" /><CardTitle>Security</CardTitle></div>
      <CardDescription>Require an app password in the desktop app and browser. Protection is off by default.</CardDescription>
    </CardHeader>
    <CardContent>
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch id="require-launch-password" checked={enabled} disabled={pending || needsRestart || savedEnabled === null}
            className="data-[state=checked]:!bg-primary-600"
            onCheckedChange={(value) => { setEnabled(value); setMessage(''); }} />
          <Label htmlFor="require-launch-password">Require password at launch</Label>
        </div>
        {savedEnabled && <div className="max-w-sm space-y-2">
          <Label htmlFor="security-current-password">Current password</Label>
          <Input id="security-current-password" type="password" autoComplete="current-password" value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)} disabled={pending || needsRestart} required maxLength={1024} />
        </div>}
        {enabled && <>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="security-new-password">{savedEnabled ? 'New password' : 'Password'}</Label>
            <Input id="security-new-password" type="password" autoComplete="new-password" minLength={12} maxLength={1024}
              value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending || needsRestart} required />
            <p className="text-xs text-slate-500">Use at least 12 characters. Spaces are supported.</p>
          </div>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="security-confirm-password">Confirm password</Label>
            <Input id="security-confirm-password" type="password" autoComplete="new-password" maxLength={1024}
              value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={pending || needsRestart} required />
          </div>
        </>}
        <p className="text-sm text-slate-500">MCP and background workflows start after the first successful unlock. Access stays unlocked until the app fully quits. This does not encrypt workspace files.</p>
        {needsRestart && <p className="text-sm text-amber-700">Restart CloudAgent to use the selected data folder before changing security settings.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm text-green-700">{message}</p>}
        <Button type="submit" disabled={pending || needsRestart || savedEnabled === null || (!enabled && !savedEnabled)}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pending ? 'Saving…' : enabled ? savedEnabled ? 'Change Password' : 'Enable Password Protection' : 'Disable Password Protection'}
        </Button>
      </form>
    </CardContent>
  </Card>;
}
