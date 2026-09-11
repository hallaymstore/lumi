function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  next();
}

function requireAdmin(req, res, next) {
  if (!req.currentUser || req.currentUser.role !== 'admin') return res.status(403).render('error', { title: 'Ruxsat yo‘q', message: 'Bu sahifa faqat admin uchun.' });
  next();
}

module.exports = { requireAuth, requireAdmin };
