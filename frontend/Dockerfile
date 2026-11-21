# VoltQuest web client.
# The production bundle is built on host (or CI) via `npm run build` in frontend/.
# Build context is the REPO ROOT:
#   docker build -f frontend/Dockerfile -t voltquest-web .
FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=4s --start-period=5s --retries=5 \
    CMD ["wget", "--spider", "-q", "http://127.0.0.1/"]

CMD ["nginx", "-g", "daemon off;"]
