import { isSameOriginUrl } from './navigation-security.mjs';

export async function authorizeDesktopRequest({ event, webContents, baseUrl, auth }) {
  if (!webContents || event.sender !== webContents ||
      !isSameOriginUrl(event.senderFrame?.url, baseUrl)) {
    throw new Error('Untrusted desktop request.');
  }
  const cookies = await event.sender.session.cookies.get({ url: baseUrl });
  const req = { headers: { cookie: cookies.map(({ name, value }) => `${name}=${value}`).join('; ') } };
  if (!auth?.authenticated(req)) throw new Error('Unlock CloudAgent Console first.');
}
