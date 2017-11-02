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

    -V, --version         output the version number
    -n, --name [name]     connection name [My Connection]
    -t, --token [token]   api token (get yours at https://taskforce.sh)
    -p, --port [port]     redis port [6379]
    -h, --host [host]     redis host [localhost]
    --passwd [passwd]     redis password
    -b, --backend [host]  backend domain [api.taskforce.sh]
    -h, --help            output usage information
```

Example:

```bash
✗ taskforce -n "transcoder-queue" -t 2cfe6a1b-5f0e-466f-99ad-12f51bea79a7

```

The token "2cfe6a1b-5f0e-466f-99ad-12f51bea79a7" is a private token that can be retrieved at your [Taskforce account](https://taskforce.sh/account).

After running the command, you should be able to see the connection appear automatically on the dashboard:
