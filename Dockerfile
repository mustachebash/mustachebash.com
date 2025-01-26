# build
# FROM node:23.6-alpine3.20 AS build
# RUN mkdir -p /build
# WORKDIR /build

# ADD package.json /build/package.json
# ADD package-lock.json /build/package-lock.json
# RUN npm ci
# ADD . /build
# RUN npm run build

# # release
# FROM nginx:1.27.3-alpine AS release
# # Replace the default config
# ADD mustachebash.conf /etc/nginx/conf.d/default.conf
# COPY apple-developer-merchantid-domain-association /etc/nginx/apple-developer-merchantid-domain-association
# COPY --from=build /build/dist /static
# WORKDIR /static

# Base
FROM node:23.6-alpine3.20 AS base
RUN mkdir -p /build
WORKDIR /build
COPY package.json package-lock.json ./

# Build dependencies
FROM base AS build-deps
# https://docs.docker.com/build/guide/mounts/
RUN --mount=type=cache,target=/root/.npm \
	npm ci

# Build
FROM build-deps AS build
# https://docs.docker.com/build/guide/mounts/
RUN --mount=type=cache,target=/root/.npm \
	--mount=type=bind,source=astro.config.mjs,target=astro.config.mjs \
	--mount=type=bind,source=tsconfig.json,target=tsconfig.json \
	--mount=type=bind,source=types.d.ts,target=types.d.ts \
	--mount=type=bind,source=src,target=src \
	--mount=type=bind,source=public,target=public \
	--mount=type=bind,source=.env.production,target=.env.production \
	npm run build

# release
FROM nginx:1.27.3-alpine AS release
# Replace the default config
ADD mustachebash.conf /etc/nginx/conf.d/default.conf
COPY apple-developer-merchantid-domain-association /etc/nginx/apple-developer-merchantid-domain-association
COPY --from=build /build/dist /static
WORKDIR /static
