export default async function handler(req, res) {
  // Collect raw body
  const raw = await (async () => {
    if (req.body && Object.keys(req.body).length) return { parsed: req.body, raw: undefined };
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          resolve({ parsed: JSON.parse(body || '{}'), raw: body });
        } catch (e) {
          resolve({ parsed: {}, raw: body });
        }
      });
      req.on('error', () => resolve({ parsed: {}, raw: '' }));
    });
  })();

  res.status(200).json({
    method: req.method,
    headers: req.headers,
    parsedBody: raw.parsed,
    rawBodyLength: raw.raw ? raw.raw.length : (raw.parsed ? JSON.stringify(raw.parsed).length : 0),
    rawBodyPreview: raw.raw ? raw.raw.slice(0, 100) : undefined,
  });
}
