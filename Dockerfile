FROM node:22-slim

# ─── System dependencies ───────────────────────────────────────────────────────
# python3 + pip: audio analysis (librosa subprocess)
# ffmpeg: clip concatenation in the assembler (ffprobe for duration detection)
# build-essential + libsndfile1: required by librosa/soundfile native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# ─── Python audio analysis dependencies ───────────────────────────────────────
# librosa: BPM, beat grid, section boundaries, energy envelope
# soundfile: audio file I/O (libsndfile backend)
# numpy/scipy: required by librosa (usually pulled transitively, pin for stability)
RUN pip3 install --no-cache-dir --break-system-packages \
    librosa==0.10.2 \
    soundfile==0.12.1 \
    numpy==1.26.4 \
    scipy==1.13.1

# ─── Node application ─────────────────────────────────────────────────────────
WORKDIR /app

# Copy all source (patches/ must be present before pnpm install)
COPY . .

# Install Node dependencies
RUN npm install -g corepack@latest && corepack pnpm install

# ─── VITE_ build-time variables ───────────────────────────────────────────────
# Vite bakes import.meta.env.VITE_* into the JS bundle at build time.
# These must be available as environment variables during `pnpm build`.
# In Railway: add each VITE_ var to the service Variables AND check
# "Available at build time" (or pass as --build-arg in the Railway config).
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_APP_TITLE
ARG VITE_APP_ID
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_FRONTEND_FORGE_API_KEY
ARG VITE_FRONTEND_FORGE_API_URL
ARG VITE_ANALYTICS_ENDPOINT
ARG VITE_ANALYTICS_WEBSITE_ID
ARG VITE_APP_LOGO

ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY \
    VITE_APP_TITLE=$VITE_APP_TITLE \
    VITE_APP_ID=$VITE_APP_ID \
    VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL \
    VITE_FRONTEND_FORGE_API_KEY=$VITE_FRONTEND_FORGE_API_KEY \
    VITE_FRONTEND_FORGE_API_URL=$VITE_FRONTEND_FORGE_API_URL \
    VITE_ANALYTICS_ENDPOINT=$VITE_ANALYTICS_ENDPOINT \
    VITE_ANALYTICS_WEBSITE_ID=$VITE_ANALYTICS_WEBSITE_ID \
    VITE_APP_LOGO=$VITE_APP_LOGO

# Build frontend + server (Vite now has access to VITE_ vars above)
RUN corepack pnpm run build

ENV NODE_ENV=production

# Server listens on process.env.PORT (set by Railway at runtime)
CMD ["node", "dist/index.js"]
