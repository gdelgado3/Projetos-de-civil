# Imagem para pôr o Documentos de Civil online (Railway, Render, Fly.io…)
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV NODE_ENV=production \
    PORT=3000 \
    DB_FICHEIRO=/data/documentos-civil.db
# A base de dados fica em /data: liga aqui um volume (disco) para não se perder nos redeploys
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
