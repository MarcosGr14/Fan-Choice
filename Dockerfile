FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev && npm cache clean --force
COPY src ./src
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
# Build the UI without database credentials; API calls use the same origin.
RUN npm run build
ENV NODE_ENV=production
ENV USE_MOCK_LISTENING_DATA=false
ENV PORT=3001
USER node
EXPOSE 3001
CMD ["npm", "start"]
