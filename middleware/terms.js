const TERMS_VERSION = '2026-09-13';

function wantsJson(req) {
  return req.xhr || String(req.get('accept') || '').includes('application/json');
}

function termsGate(req, res, next) {
  if (!req.currentUser || req.currentUser.termsVersion === TERMS_VERSION) return next();

  const path = req.path || '';
  const allowed = path === '/terms' || path === '/terms/accept' || path === '/privacy' ||
    path === '/account-deletion' || path === '/account-deleted' || path === '/logout' ||
    path === '/healthz';
  if (allowed) return next();

  if (req.method === 'GET' || req.method === 'HEAD') {
    const nextUrl = encodeURIComponent(req.originalUrl || '/feed');
    return res.redirect(`/terms/accept?next=${nextUrl}`);
  }

  if (wantsJson(req)) {
    return res.status(428).json({
      ok: false,
      termsRequired: true,
      redirect: '/terms/accept',
      error: 'Lumi foydalanish shartlarini qabul qilish kerak.'
    });
  }

  return res.redirect('/terms/accept');
}

module.exports = { TERMS_VERSION, termsGate };
