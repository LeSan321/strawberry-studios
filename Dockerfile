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

# Install Node dependencies and build frontend + server
RUN npm install -g corepack@latest && corepack pnpm install && corepack pnpm run build

ENV NODE_ENV=production

# Server listens on process.env.PORT (set by Railway at runtime)
CMD ["node", "dist/index.js"]
