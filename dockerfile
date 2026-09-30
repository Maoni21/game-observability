FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts

RUN chmod -R a+rX /app
RUN mkdir -p /app/logs && chown node:node /app/logs
USER node

EXPOSE 8080
CMD ["node", "src/server.js"]