# Audio Rating Dashboard

A full-stack web application for rating call center audio recordings using AI. Upload or record audio files and receive detailed evaluations based on phone intelligibility, pronunciation clarity, business English delivery, confidence & sales tone, pace & smoothness, and recording quality.

## Features

- Upload audio files (MP3, WAV, OGG, MP4, WEBM, M4A) up to 15MB
- Record audio directly in browser using MediaRecorder API
- AI-powered evaluation using LiteLLM (Gemini models)
- Detailed scoring across 6 criteria
- Recommendation badges (Highly Recommended, Recommended, Neutral, Not Recommended)
- Admin dashboard with statistics and management
- Full REST API with documentation
- PostgreSQL database for persistent storage

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

The application uses PostgreSQL. Create the database and run migrations:

```bash
# Create database
psql -U postgres -c "CREATE DATABASE ratingdb;"

# Run migrations
psql -U postgres -d ratingdb -f src/db/migrations.sql
```

### 3. Configure Environment

Copy `.env` and update values as needed:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/ratingdb

LITELLM_BASE_URL=http://localhost:4000/v1
LITELLM_API_KEY=your_litellm_api_key_here
LITELLM_MODEL=gemini-2.5-pro-litellm
LITELLM_FALLBACK_MODEL=gemini-2.5-flash-litellm

API_KEY=your_api_key_here
ADMIN_KEY=your_admin_dashboard_key

UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=15
```

### 4. Start the Server

```bash
# Development
npm start

# Production with PM2
pm2 start server.js --name rate-dashboard
```

## Deployment

### PM2 Configuration

Start the application with PM2:

```bash
pm2 start server.js --name rate-dashboard
pm2 save
pm2 startup
```

### Nginx Configuration

Create a new site configuration at `/etc/nginx/sites-available/rate.scorpion.codes`:

```nginx
server {
    listen 80;
    server_name rate.scorpion.codes;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeout for AI processing
        proxy_read_timeout 120s;
    }

    # Increase max body size for audio uploads
    client_max_body_size 20M;
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/rate.scorpion.codes /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Certbot

```bash
sudo certbot --nginx -d rate.scorpion.codes
```

## API Usage

All API endpoints require the `x-api-key` header.

### Rate Audio

```bash
curl -X POST https://rate.example.com/api/v1/rate \
  -H "x-api-key: your_api_key_here" \
  -F "audio=@candidate.mp3"
```

### Get Ratings

```bash
curl -X GET "https://rate.example.com/api/v1/ratings?limit=10" \
  -H "x-api-key: your_api_key_here"
```

### Get Statistics

```bash
curl -X GET https://rate.example.com/api/v1/stats \
  -H "x-api-key: your_api_key_here"
```

### Delete Rating

```bash
curl -X DELETE https://rate.example.com/api/v1/ratings/{id} \
  -H "x-api-key: your_api_key_here"
```

For full API documentation, visit `/docs` in your browser.

## Pages

| Path | Description | Auth |
|------|-------------|------|
| `/` | Upload/record audio and view ratings | None |
| `/dashboard?key=ADMIN_KEY` | Admin dashboard to manage ratings | Admin Key |
| `/docs` | API documentation | None |

## Project Structure

```
/var/www/rate.scorpion.codes/
├── server.js                 # Express entry point
├── package.json
├── .env                      # Environment config
├── README.md
├── src/
│   ├── routes/
│   │   ├── api.js           # REST API routes
│   │   └── pages.js         # HTML page routes
│   ├── controllers/
│   │   └── ratingController.js
│   ├── services/
│   │   ├── aiService.js     # LiteLLM integration
│   │   └── audioService.js  # Multer + file handling
│   ├── db/
│   │   ├── pool.js          # PostgreSQL connection
│   │   └── migrations.sql   # Schema setup
│   ├── middleware/
│   │   └── auth.js          # API key validation
│   └── public/
│       ├── index.html       # Rating page
│       ├── dashboard.html   # Admin dashboard
│       ├── docs.html        # API documentation
│       ├── style.css        # Shared styles
│       └── app.js           # Frontend JS
└── uploads/                 # Audio files storage
```

## License

MIT
