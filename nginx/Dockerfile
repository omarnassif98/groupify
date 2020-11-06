FROM nginx:1.18.0
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d
COPY cert.crt /etc/nginx
COPY generated.key /etc/nginx
