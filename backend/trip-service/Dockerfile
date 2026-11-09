FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies first so this layer is cached between code changes
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY app.js openapi.yaml ./
COPY routes ./routes
COPY controllers ./controllers
COPY data ./data
COPY helpers ./helpers
COPY middleware ./middleware

USER node
EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "app.js"]
