FROM node:24-slim

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json eslint.config.js .prettierrc.json .prettierignore ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages ./packages

RUN corepack pnpm config set store-dir /pnpm/store \
  && corepack pnpm install --frozen-lockfile

COPY apps/web ./apps/web

EXPOSE 5173

CMD ["corepack", "pnpm", "--filter", "@fabrica/web", "exec", "vite", "--host", "0.0.0.0", "--port", "5173", "--configLoader", "runner"]
