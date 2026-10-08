FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

COPY --chown=node:node apps/api ./apps/api

USER node

EXPOSE 8080

CMD ["node", "apps/api/src/server.mjs"]
