# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then \
      export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; \
    fi; \
    npm ci --omit=dev --ignore-scripts --strict-ssl=true && npm cache clean --force

COPY --chown=node:node apps/api ./apps/api

USER node

EXPOSE 8080

CMD ["node", "apps/api/src/server.mjs"]
