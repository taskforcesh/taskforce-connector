FROM node:12-alpine

RUN apk --no-cache add curl

RUN yarn global add --ignore-optional taskforce-connector pm2@3.5.2 && yarn cache clean

CMD pm2-runtime taskforce --web 80 -- -n "${TASKFORCE_CONNECTION}" --team "${TASKFORCE_TEAM}"

HEALTHCHECK --interval=30s --timeout=30s \
  --start-period=5s --retries=3 CMD curl -f http://localhost || exit 1

LABEL org.opencontainers.image.source="https://github.com/taskforcesh/taskforce-connector"
