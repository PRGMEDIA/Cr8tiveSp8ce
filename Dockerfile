FROM alpine:3.20
RUN apk add --no-cache nginx
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY assets-s3-logo.js /usr/share/nginx/html/
COPY templates.js /usr/share/nginx/html/
COPY community-templates.js /usr/share/nginx/html/
COPY zip.js /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY dataLayer.js /usr/share/nginx/html/
COPY admin.html /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/http.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
