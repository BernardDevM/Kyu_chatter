#-------BUILD ----------
ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=10.11.0

FROM node:${NODE_VERSION} AS builder
ARG PNPM_VERSION 

RUN npm install -g pnpm@${PNPM_VERSION}

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# prisma.config.ts requires DATABASE_URL to load; generate never connects, so a placeholder is enough.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm prisma generate
RUN pnpm run build

#--------PRODUCTION-------
FROM node:${NODE_VERSION} AS production
ARG PNPM_VERSION

ENV NODE_ENV=production

RUN npm install -g pnpm@${PNPM_VERSION}

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder --chown=node:node /app/dist/ ./dist

USER node

CMD ["node", "dist/main.js"]