FROM node:24-slim

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json eslint.config.js .prettierrc.json .prettierignore ./
COPY apps/web ./apps/web

RUN corepack enable && corepack pnpm install --frozen-lockfile --filter @fabrica/web...

EXPOSE 5173

CMD ["corepack", "pnpm", "--filter", "@fabrica/web", "dev", "--", "--host", "0.0.0.0"]
