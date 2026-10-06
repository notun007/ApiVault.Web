FROM node:24.15-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:production

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ApiVault.Web/browser /usr/share/nginx/html
COPY docker/runtime-config.template.json /etc/apivault/runtime-config.template.json
COPY --chmod=755 docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
