# Aura Studio — static site served by nginx (no server-side code needed)
FROM nginx:1.27-alpine

# Site files (single copy layer — rebuilds are fast)
COPY index.html styles.css assets-s3-logo.js templates.js community-templates.js \
     zip.js app.js dataLayer.js admin.html /usr/share/nginx/html/
COPY template-packs /usr/share/nginx/html/template-packs/
COPY docs /usr/share/nginx/html/docs/

# Hardened default config: gzip + sensible caching for static assets
RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  gzip on;\n\
  gzip_types text/css application/javascript application/json image/svg+xml;\n\
  location / { try_files $uri $uri/ =404; }\n\
  location ~* \\.(js|css|svg|png|jpg|jpeg|json)$ { expires 7d; add_header Cache-Control "public"; }\n\
}\n' > /etc/nginx/conf.d/default.conf \
 && rm -f /etc/nginx/conf.d/default.conf.default

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
