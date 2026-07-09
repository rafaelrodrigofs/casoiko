'use strict';

/**
 * Middleware que valida o Firebase ID token no header Authorization.
 */
function createAuthMiddleware(admin) {
  return async function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer (.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Token ausente' });
    }

    try {
      req.user = await admin.auth().verifyIdToken(match[1]);
      next();
    } catch (err) {
      console.error('Auth falhou:', err.message);
      return res.status(401).json({ error: 'Token invalido' });
    }
  };
}

module.exports = { createAuthMiddleware };
