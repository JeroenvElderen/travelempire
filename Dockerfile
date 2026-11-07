FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["sh", "-c", "./node_modules/.bin/vite preview --host 0.0.0.0 --port ${PORT:-8080} --strictPort"]
