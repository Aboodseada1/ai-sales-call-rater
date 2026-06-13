/**
 * Authentication middleware for API routes
 */
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing API key. Include x-api-key header.'
    });
  }

  next();
}

/**
 * Authentication for admin dashboard
 * Accepts API key via query param or header
 */
function validateAdminKey(req, res, next) {
  const adminKey = req.query.key || req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_KEY;

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(401).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Unauthorized</title></head>
      <body style="font-family: sans-serif; padding: 50px; text-align: center;">
        <h1>Unauthorized</h1>
        <p>Valid admin key required. Add <code>?key=YOUR_KEY</code> to URL.</p>
      </body>
      </html>
    `);
  }

  next();
}

/**
 * Optional API key validation (for public pages that may use API)
 */
function optionalApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;
  
  req.isAuthenticated = (apiKey && apiKey === expectedKey);
  next();
}

module.exports = {
  validateApiKey,
  validateAdminKey,
  optionalApiKey
};
