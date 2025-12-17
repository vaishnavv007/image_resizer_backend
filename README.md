# Image Resizer Backend

This is the Node.js/Express backend for the Image Resizer application. It exposes APIs for user authentication and image processing (resize, convert, compress, etc.).

## Tech Stack

- Node.js
- Express
- Multer or similar middleware for file uploads
- Image processing library (e.g. Sharp)
- JSON Web Tokens (JWT) for auth (if configured)

## Getting Started

### 1. Install dependencies

From the `backend` directory, run:

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and update the values for your environment:

```bash
cp .env.example .env
```

Typical variables (exact names may vary based on your implementation):

- `PORT` – Port for the API server (e.g. `5000`).
- `MONGO_URI` or other DB connection string, if persistence is used.
- `JWT_SECRET` – Secret key used for signing auth tokens.
- `CLIENT_ORIGIN` – Allowed origin for CORS (e.g. `http://localhost:5173`).

Check `.env.example` for the authoritative list.

### 3. Run the development server

```bash
npm run dev
```

or, if you don’t have a dev script:

```bash
node src/index.js
```

(adjust the entry file name if different).

### 4. Production run

Build steps may not be necessary if this is a plain Node/Express API. In production you typically:

```bash
NODE_ENV=production node src/index.js
```

Use a process manager like PM2 or a hosting provider (Render, Railway, etc.) for deployment.

## API Overview

Base URL pattern (example):

- `http://localhost:5000/api`

Common endpoints (names may differ slightly in your code):

- `POST /auth/signup` – Create a new user.
- `POST /auth/login` – Authenticate and return a token.
- `POST /images/process` – Accept uploaded images and processing options, return processed image(s) or ZIP.

Inspect the `src/controllers` and `src/routes` directories in this backend for exact routes and payloads.

## Integration with Frontend

- The frontend uses `VITE_API_BASE_URL` to call this backend.
- Ensure CORS is configured to allow the frontend origin.
- Authentication tokens (if used) should be validated on protected API routes.

## Troubleshooting

- **Cannot connect from frontend** – Confirm `PORT` and `VITE_API_BASE_URL` match and there are no CORS errors.
- **File upload errors** – Check upload size limits and storage configuration (Multer or equivalent).
- **Image processing errors** – Verify the image library (e.g. Sharp) is installed correctly, and that the host OS has required native dependencies.

deploy on render
