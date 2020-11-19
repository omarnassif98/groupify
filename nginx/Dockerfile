FROM nginx:1.18.0

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d
COPY server.crt /etc/nginx
COPY server.key /etc/nginx
