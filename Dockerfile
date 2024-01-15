# build
FROM node:20.10-alpine AS build
RUN mkdir -p /build
WORKDIR /build

ADD package.json /build/package.json
ADD package-lock.json /build/package-lock.json
RUN npm ci
ADD . /build
RUN npm run build

# release
FROM nginx:1.23.2-alpine AS release
# Replace the default config
ADD mustachebash.conf /etc/nginx/conf.d/default.conf
COPY apple-developer-merchantid-domain-association /etc/nginx/apple-developer-merchantid-domain-association
COPY --from=build /build/dist /static
WORKDIR /static
