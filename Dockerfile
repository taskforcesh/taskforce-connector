FROM mhart/alpine-node:12.14.0

RUN apk update
RUN apk add curl

RUN yarn global add --ignore-optional taskforce-connector pm2@3.5.1

CMD pm2-runtime taskforce --web 80 -- -n "${TASKFORCE_CONNECTION}" --team "${TASKFORCE_TEAM}"

HEALTHCHECK --interval=30s --timeout=30s \
  --start-period=5s --retries=3 CMD curl -f http://localhost || exit 1
