# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
COPY infrastructure /app/infrastructure
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN apk add --no-cache python3 bash
RUN npm run build

FROM nginx:alpine AS production
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
