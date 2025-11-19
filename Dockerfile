FROM node:20-alpine

ARG GITHUB_PACKAGES_TOKEN

RUN apk --no-cache add curl

RUN set -euxo pipefail \
  && test -n "$GITHUB_PACKAGES_TOKEN" \
  && printf "@magicaltome:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n" "$GITHUB_PACKAGES_TOKEN" > ~/.npmrc \
  && yarn global add --ignore-optional @magicaltome/taskforce-connector pm2@5.2.0 \
  && yarn cache clean \
  && rm -f ~/.npmrc

CMD pm2-runtime taskforce -- -n "${TASKFORCE_CONNECTION}" --team "${TASKFORCE_TEAM}" `([ "$REDIS_USE_TLS" == "1" ] && echo --tls)`

HEALTHCHECK --interval=30s --timeout=30s \
  --start-period=5s --retries=3 CMD curl -f http://localhost || exit 1

LABEL org.opencontainers.image.source="https://github.com/taskforcesh/taskforce-connector"
