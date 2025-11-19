# Taskforce Connector

This small service allows you to connect queues to [Taskforce](https://taskforce.sh) acting as a proxy between your queues and the UI. It is useful for connecting local development queues as well as production grade queues without the need of sharing passwords or establishing SSH tunnels.

Currently the connector supports [Bull](https://github.com/optimalbits/bull) and [BullMQ](https://github.com/taskforcesh/bullmq) queues.

The connector is designed to be lightweight and using a minimal set of resources from the local queues.

## Install

Make sure you've authenticated with our GitHub Packages registry first (see [Authenticating](#authenticating)).

Using [yarn](https://yarnpkg.com)

```bash
yarn global add @magicaltome/taskforce-connector

```

Using npm:

```bash
npm install -g @magicaltome/taskforce-connector
```

## Authenticating

If you are not already configured to consume packages under the `@magicaltome` scope, follow these steps once on your machine.

### Create a token

1. In GitHub, open **Settings → Developer settings → Personal access tokens (classic)**.
2. Generate a new token named `@magicaltome private npm registry key` with **No expiration**.
3. Select the scopes `repo` and `read:packages`. Maintainers who will publish should also add `write:packages`.
4. Store the token in your password manager.

### Login for scoped package `@magicaltome`

```bash
npm login --scope=@magicaltome --auth-type=legacy --registry=https://npm.pkg.github.com
> Username: YOUR_GITHUB_USERNAME
> Password: TOKEN_CREATED_ABOVE
```

This stores the registry details and token in your `~/.npmrc`, which Yarn will also reuse.

## Usage

Call the tool and get a help on the options:

```bash
✗ taskforce --help

  Usage: taskforce [options]


  Options:

    -V, --version               output the version number
    -n, --name [name]           connection name [My Connection] (default: "My Connection")
    -t, --token [token]         api token (get yours at https://taskforce.sh)
    -p, --port [port]           redis port [6379] (default: "6379")
    --tls [tls]                 (default: "Activate secured TLS connection to Redis")
    -h, --host [host]           redis host [localhost] (default: "localhost")
    -d, --database [db]         redis database [0] (default: "0")
    --username [username]       redis username
    --passwd [passwd]           redis password
    --spasswd [spasswd]         redis sentinel password
    -u, --uri [uri]             redis uri
    --team [team]               specify team where to put the connection
    -b, --backend [host]        backend domain [api.taskforce.sh] (default: "wss://api.taskforce.sh")
    -s, --sentinels [host:port] comma-separated list of sentinel host/port pairs
    -m, --master [name]         name of master node used in sentinel configuration
    -h, --help                  output usage information
    --nodes [nodes]             comma-separated list of cluster nodes uris to connect to (Redis Cluster)
    --queues <queues>           optional comma-separated list of queues to monitor
    --queuesFile <queuesFile>   optional file with queues to monitor
```

Example:

```bash
✗ taskforce -n "transcoder connection" -t 2cfe6a1b-5f0e-466f-99ad-12f51bea79a7
```

The token `2cfe6a1b-5f0e-466f-99ad-12f51bea79a7` is a private token that can be retrieved at your [Taskforce account](https://taskforce.sh/account).

After running the command, you should be able to see the connection appear automatically on the dashboard.

Sentinel Example:

```bash
✗ taskforce -n "transcoder connection" -t 2cfe6a1b-5f0e-466f-99ad-12f51bea79a7 -s sentinel1.mydomain:6379,sentinel2.mydomain:6379 -m mymaster
```

Note: You can also specify the following with environment variables.

```bash
token                 TASKFORCE_TOKEN
port                  REDIS_PORT
host                  REDIS_HOST
password              REDIS_PASSWD
sentinel-password     REDIS_SENTINEL_PASSWD
uri                   REDIS_URI
sentinels             REDIS_SENTINELS (comma separated list of sentinels)
master                REDIS_MASTER
nodes                 REDIS_NODES (comma separated list of nodes for Redis Cluster)
```

To enable use if TLS when using the container set this environment variable:
```bash
REDIS_USE_TLS=1
```

Note for Redis Cluster: You may also need to specify following with environment variables.
```bash
Cluster TLS Certificate      REDIS_CLUSTER_TLS
```

If your redis cluster still cannot connect due to failing certificate validation, you may need to pass this env to skip cert validation.
```bash
NODE_TLS_REJECT_UNAUTHORIZED="0"
```

## Secured TLS Connections

Services that support TLS can also be used using the connector, use the `--tls` flag. Note that some services such as Heroku expects the port number to be "one more" than the normal unencrypted port [read more](https://devcenter.heroku.com/articles/securing-heroku-redis).

## Teams

You can use the connector to spawn queue connections to any team that you created on your organization, just pass the team name
as an option:

```bash
✗ taskforce -n "transcoder connection" -t 2cfe6a1b-5f0e-466f-99ad-12f51bea79a7 --team "my awesome team"

```

## Publishing

Publishing is automated via [semantic-release](https://github.com/semantic-release/semantic-release) in [`.github/workflows/release.yml`](.github/workflows/release.yml). When changes land on `master`, the workflow:

1. Builds the project (`yarn build`).
2. Runs `npx semantic-release`, which bumps the version, updates `CHANGELOG.md`, and `npm publish`es to `https://npm.pkg.github.com`.
3. Opens a PR with the generated changes.

To make the publish step succeed:

- Store a GitHub personal access token (classic) with `repo`, `read:packages`, and `write:packages` scopes in the `NPM_TOKEN` repository secret. The workflow exports the same token to `semantic-release`.
- Locally, run the [Authenticating](#authenticating) steps and ensure `NPM_TOKEN` is present in your environment before invoking `npx semantic-release` (useful for dry runs or debugging).

## Docker image

Because the CLI is private, building the `Dockerfile` requires a GitHub Packages token:

```bash
docker build . \
  --build-arg GITHUB_PACKAGES_TOKEN=TOKEN_WITH_READ_PACKAGES
```

The build writes the token to a temporary `.npmrc`, installs `@magicaltome/taskforce-connector`, and removes the file in the same layer so the final image does not contain the credential.

## Use as a library

It is also possible to add the connector as a library:

As a commonjs dependency:

```js
const { Connect } = require("@magicaltome/taskforce-connector");

const taskforceConnection = Connect("my connection", "my token", {
  host: "my redis host",
  port: "my redis port",
  password: "my redis password",
});
```

or as a es6 module:

```ts
import { Connect } from "@magicaltome/taskforce-connector";

const taskforceConnection = Connect("my connection", "my token", {
  host: "my redis host",
  port: "my redis port",
  password: "my redis password",
});
```

If you are using the On Premises version of Taskforce, you can also specify the backend domain:

```ts
const taskforceConnection = Connect(
  "my connection",
  "my token",
  {
    host: "my redis host",
    port: "my redis port",
    password: "my redis password",
  },
  "My Prod Team", // optional team name
  "wss://mybackend.domain"
);
```
