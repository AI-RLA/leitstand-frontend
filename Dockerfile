FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.30-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Runs before the image's own template step; renders the upstream bearer from the mounted secret.
COPY --chmod=755 docker-entrypoint.d/15-auth-include.sh /docker-entrypoint.d/15-auth-include.sh
EXPOSE 80
