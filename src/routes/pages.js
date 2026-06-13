const path = require('path');
const { validateAdminKey } = require('../middleware/auth');

function createPageRoutes(app) {
  // GET / - Rating page (public)
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  // GET /dashboard - Admin dashboard (protected)
  app.get('/dashboard', validateAdminKey, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
  });

  // GET /docs - API documentation (public)
  app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/docs.html'));
  });
}

module.exports = createPageRoutes;
