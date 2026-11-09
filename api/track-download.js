// Vercel Serverless Function: called by the browser only after the full
// APK response body has been received. This is not proof of Android installation.
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const downloadId = req.body && req.body.download_id;
  if (typeof downloadId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(downloadId)) {
    return res.status(400).json({ error: 'Invalid download id' });
  }

  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) {
    return res.status(503).json({ error: 'Meta CAPI is not configured' });
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor || '').split(',')[0].trim();
  const userData = {};
  if (clientIp) userData.client_ip_address = clientIp;
  if (req.headers['user-agent']) userData.client_user_agent = req.headers['user-agent'];
  const fbp = getCookie(req, '_fbp');
  const fbc = getCookie(req, '_fbc');
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const version = process.env.META_GRAPH_API_VERSION || 'v23.0';
  const endpoint = 'https://graph.facebook.com/' + version + '/' +
    encodeURIComponent(pixelId) + '/events?access_token=' + encodeURIComponent(token);
  const eventId = downloadId;
  const payload = {
    data: [{
      event_name: 'APKDownloadComplete',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: req.headers.referer || 'https://mahadev-sand-one.vercel.app/',
      user_data: userData,
      custom_data: { content_name: 'Mahadev APK', file_type: 'apk' }
    }]
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Meta CAPI completion event failed:', response.status, result);
      return res.status(502).json({ error: 'Meta did not accept the event' });
    }
    return res.status(200).json({ ok: true, event: 'APKDownloadComplete', event_id: eventId });
  } catch (error) {
    console.error('Meta CAPI completion request failed:', error);
    return res.status(502).json({ error: 'Meta CAPI request failed' });
  }
};
