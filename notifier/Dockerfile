FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY index.js auth.js server.js ./

# A chave de conta de servico deve ser montada como volume em runtime:
#   -v /opt/casoiko/service-account.json:/app/service-account.json:ro
# Uploads persistentes:
#   -v /var/casoiko/uploads:/data/uploads

ENV PORT=3000
ENV UPLOAD_DIR=/data/uploads

EXPOSE 3000

CMD ["node", "index.js"]
