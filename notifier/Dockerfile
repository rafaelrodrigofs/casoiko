FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY index.js ./

# A chave de conta de servico deve ser montada como volume em runtime:
#   -v /caminho/service-account.json:/app/service-account.json:ro
# ou apontada por GOOGLE_APPLICATION_CREDENTIALS.

CMD ["node", "index.js"]
