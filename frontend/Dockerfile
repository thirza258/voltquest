# VoltQuest web client. Build context is the REPO ROOT because the Vite build bundles ../content:
#   docker build -f frontend/Dockerfile -t voltquest-web .
FROM node:22-alpine AS build

WORKDIR /build

# Install with the lockfile first for a cacheable dependency layer.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Config, sources, and the shared quest content (imported through the @content alias).
COPY frontend/ ./
COPY content /content_src
# The @content alias resolves to ../content relative to the frontend dir.
RUN mkdir -p /content && cp -r /content_src/. /content/ && rm -rf /content_src

# Requests go to the nginx /api proxy in this image, so the client needs no absolute API host.
ENV VITE_API_URL=/api
RUN npm run build


FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=4s --start-period=5s --retries=5 \
    CMD ["wget", "--spider", "-q", "http://127.0.0.1/"]

CMD ["nginx", "-g", "daemon off;"]
