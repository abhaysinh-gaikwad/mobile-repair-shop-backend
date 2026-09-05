FROM node:20-bookworm-slim

# Chrome's own runtime libraries — Puppeteer's bundled Chromium needs these
# present on the OS even though the browser binary itself is downloaded by
# npm below. Without these, Chrome launches and immediately crashes.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Chrome downloads into the IMAGE itself here (not a runtime-only cache dir),
# so it becomes part of the built container and is guaranteed present on
# every start — no ephemeral-disk risk, unlike Render's buildpack model
# where build-time and runtime are separate filesystem layers.
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Whether to pull Chromium into the image.
#
# Defaults to SKIPPING it: both things that use Chrome (WhatsApp Web, and the
# receipt-PDF renderer that exists to attach a PDF to a WhatsApp message) are
# inactive while WHATSAPP_PROVIDER=disabled, and the download is ~180MB
# unpacking to ~450MB — the heaviest step of a rebuild on a ~950MB host that
# has already hung twice from memory exhaustion.
#
# Build with --build-arg PUPPETEER_SKIP_DOWNLOAD=false before switching
# WHATSAPP_PROVIDER back to `web`, or Puppeteer fails with "Could not find
# Chrome" at runtime. See scripts/install-chrome.js.
ARG PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=$PUPPETEER_SKIP_DOWNLOAD

COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

COPY . .
RUN npm run build

# The WhatsApp Web session (.wwebjs_auth) is bind-mounted from a host
# directory at `docker run` time (see the deploy command) so it survives
# container restarts/redeploys instead of forcing a fresh QR scan every time.
VOLUME ["/app/.wwebjs_auth"]

EXPOSE 5056

CMD ["node", "./dist/index.js"]
