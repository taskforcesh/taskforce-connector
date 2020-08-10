# Taskforce Connector

This small service allows you to connect queues to [Taskforce](https://taskforce.sh) acting as a proxy between your queues and the UI. It is useful for connecting local development queues as well as production grade queues without the need of sharing passwords or establishing SSH tunnels.

Currently the connector supports [Bull](https://github.com/optimalbits/bull) queues, with more to come in later
releases.

The connector is designed to be lightweight and using a minimal set of resources from the local queues.

## Install

Using [yarn](https://yarnpkg.com)

```bash
yarn global add taskforce-connector

```

Using npm:

```bash
npm install -g taskforce-connector
```

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
    --passwd [passwd]           redis password
    -u, --uri [uri]             redis uri
    --team [team]               specify team where to put the connection
    -b, --backend [host]        backend domain [api.taskforce.sh] (default: "wss://api.taskforce.sh")
    -s, --sentinels [host:port] comma-separated list of sentinel host/port pairs
    -m, --master [name]         name of master node used in sentinel configuration
    -h, --help                  output usage information
```

Example:

```bash
✗ taskforce -n "transcoder connection" -t 2cfe6a1b-5f0e-466f-99ad-12f51bea79a7
```

The token `2cfe6a1b-5f0e-466f-99ad-12f51bea79a7` is a private token that can be retrieved at your [Taskforce account](https://taskforce.sh/account).

After running the command, you should be able to see the connection appear automatically on the dashboard.

Note: You can also specify the taskforce token with the environment variable TASKFORCE_TOKEN

Sentinel Example:

```bash
✗ taskforce -n "transcoder connection" -t 2cfe6a1b-5f0e-466f-99ad-12f51bea79a7 -s sentinel1.mydomain:6379,sentinel2.mydomain:6379 -m mymaster
```

## Secured TLS Connections

Services that support TLS can also be used using the connector, use the `--tls` flag. Note that some services such as Heroku expects the port number to be "one more" than the normal unencrypted port [read more](https://devcenter.heroku.com/articles/securing-heroku-redis).

## Teams

You can use the connector to spawn queue connections to any team that you created on your organization, just pass the team name
as an option:

```bash
✗ taskforce -n "transcoder connection" -t 2cfe6a1b-5f0e-466f-99ad-12f51bea79a7 --team "my awesome team"

```
