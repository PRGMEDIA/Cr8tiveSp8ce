# Aura Studio — static site served by nginx (no server-side code needed)
FROM nginx:1.27-alpine

# Site files (single copy layer — rebuilds are fast)
COPY index.html styles.css assets-s3-logo.js templates.js community-templates.js \
     zip.js app.js dataLayer.js admin.html /usr/share/nginx/html/
COPY template-packs /usr/share/nginx/html/template-packs/
COPY docs /usr/share/nginx/html/docs/

# Replace default nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/conf.d/default.conf.example

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
