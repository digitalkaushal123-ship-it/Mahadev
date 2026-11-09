// Vercel Serverless Function: starts an APK transfer and records that request.
// Set META_PIXEL_ID, META_CAPI_ACCESS_TOKEN and META_GRAPH_API_VERSION in Vercel.
const APK_URL = 'https://raw.githubusercontent.com/digitalkaushal123-ship-it/Mahadev/main/Mahadev.apk';

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

async function sendMetaEvent(req, eventName, eventId) {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) {
    console.warn('Meta CAPI is not configured; missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN.');
    return;
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor || '').split(',')[0].trim();
  const userAgent = req.headers['user-agent'];
  const referer = req.headers.referer || 'https://mahadev-sand-one.vercel.app/';

  const userData = {};
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;
  const fbp = getCookie(req, '_fbp');
  const fbc = getCookie(req, '_fbc');
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const version = process.env.META_GRAPH_API_VERSION || 'v23.0';
  const endpoint = 'https://graph.facebook.com/' + version + '/' +
    encodeURIComponent(pixelId) + '/events?access_token=' + encodeURIComponent(token);

  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: referer,
      user_data: userData,
      custom_data: { content_name: 'Mahadev APK', file_type: 'apk' }
    }]
  };

  const metaResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await metaResponse.json().catch(() => ({}));
  if (!metaResponse.ok) {
    console.error('Meta CAPI event failed:', metaResponse.status, result);
  } else {
    console.log('Meta CAPI accepted event:', eventName, result);
  }
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

  try {
    const apkResponse = await fetch(APK_URL);
    if (!apkResponse.ok) {
      console.error('APK origin returned:', apkResponse.status);
      return res.status(502).json({ error: 'APK source unavailable' });
    }

    const bytes = Buffer.from(await apkResponse.arrayBuffer());
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="Mahadev.apk"');
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(bytes);
  } catch (error) {
    console.error('APK download failed:', error);
    return res.status(500).json({ error: 'Download failed' });
  }
};
