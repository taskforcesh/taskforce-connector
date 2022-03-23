# [1.18.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.17.0...v1.18.0) (2022-03-23)


### Features

* add real-time metrics support. Fix [#46](https://github.com/taskforcesh/taskforce-connector/issues/46). ([7b65ee5](https://github.com/taskforcesh/taskforce-connector/commit/7b65ee5773eaddc222829ffbdef119751eb4f009))

# [1.17.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.16.0...v1.17.0) (2022-02-04)


### Features

* add support for retry all failed jobs ([f61db93](https://github.com/taskforcesh/taskforce-connector/commit/f61db935dbf2910c73cb0ac8f3ee35def0ba9596))

# [1.16.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.15.0...v1.16.0) (2022-01-29)


### Bug Fixes

* correct new version check ([f3b6437](https://github.com/taskforcesh/taskforce-connector/commit/f3b6437265c62ea9b3f65790d675704c8aa4e800))


### Features

* **commands:** add support for clean ([a56eadb](https://github.com/taskforcesh/taskforce-connector/commit/a56eadb93ed1ceffb8ea63214a5c4cbc2d0f2e3d))

# [1.15.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.14.2...v1.15.0) (2021-07-10)


### Features

* add job#update and queue#add methods ([e1d7e15](https://github.com/taskforcesh/taskforce-connector/commit/e1d7e15f5c905ae28dae058f825665284e42eb12))

## [1.14.2](https://github.com/taskforcesh/taskforce-connector/compare/v1.14.1...v1.14.2) (2021-06-29)


### Bug Fixes

* **package:** add prepare script ([bc7f7c0](https://github.com/taskforcesh/taskforce-connector/commit/bc7f7c0eeddbe4d3b0850d9cf0a5c0329865fb8f))

## [1.14.1](https://github.com/taskforcesh/taskforce-connector/compare/v1.14.0...v1.14.1) (2021-06-29)


### Bug Fixes

* remove socket.d.ts from dist ([a7dfceb](https://github.com/taskforcesh/taskforce-connector/commit/a7dfcebd5ba9686f241cc958a3dd34d3956422ae))

# [1.14.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.13.0...v1.14.0) (2021-06-29)


### Features

* support using connector as a library ([fe07e2b](https://github.com/taskforcesh/taskforce-connector/commit/fe07e2bf63f1591f46664147e56c495131125bae))

# v1.13.0 and previous versions (2021-05-03)

### Bug Fixes

* add client heartbeat for more robust connections ([517129f](https://github.com/taskforcesh/taskforce-connector/commit/517129f9b6479759b1bf42490fb1e023dc5c41af))
* allow old versions to run but generate warning fix [#8](https://github.com/taskforcesh/taskforce-connector/issues/8) ([3a0ccb9](https://github.com/taskforcesh/taskforce-connector/commit/3a0ccb990d5f6391f5ea3d156082e17d5a89cdd3))
* better handling of queue cache fixes [#12](https://github.com/taskforcesh/taskforce-connector/issues/12) ([75c9ede](https://github.com/taskforcesh/taskforce-connector/commit/75c9edea64160163f3c0b6ea99e7cae5ceda4741))
* better handling of queue cache fixes [#12](https://github.com/taskforcesh/taskforce-connector/issues/12) ([d94ff5b](https://github.com/taskforcesh/taskforce-connector/commit/d94ff5bc279704f17af31e4bab16c13d3fe44fd4))
* close redis connection after getting queues. ([88159d3](https://github.com/taskforcesh/taskforce-connector/commit/88159d3a20729c4415b5d63cd0e4bbcf5d6dd489))
* correct default value for the TLS option ([134a70d](https://github.com/taskforcesh/taskforce-connector/commit/134a70d79eda418ce6e8a49cca76c6e10b6377cf))
* do not reconnect on errors to avoid double connections ([24aa108](https://github.com/taskforcesh/taskforce-connector/commit/24aa108d700a6cb5eefd2899eae2dfb1d965ef3d))
* exit with error if missing token ([8720473](https://github.com/taskforcesh/taskforce-connector/commit/8720473d921f031c3a2693a6ddd5bfcc5508fd2f))
* read package.json with proper path ([39f6d7f](https://github.com/taskforcesh/taskforce-connector/commit/39f6d7fa770b50c92bb691fa0471710f3be264cf))
* upgrade bull version ([8e021ee](https://github.com/taskforcesh/taskforce-connector/commit/8e021eedbcd22122412039aa38c238834a0ac768))
* upgrade dependencies ([d3807be](https://github.com/taskforcesh/taskforce-connector/commit/d3807be641f848fd23a3054d10b6a6a5b71aba4b))


### Features

* add dockerfile ([ede57ec](https://github.com/taskforcesh/taskforce-connector/commit/ede57ec1a31bc72eb5f04d83bfcf08226610054b))
* add Dockerfile ([d221bb1](https://github.com/taskforcesh/taskforce-connector/commit/d221bb114302c82eeb97831a397219c9a4cebf0f))
* add get redis info support ([dc66204](https://github.com/taskforcesh/taskforce-connector/commit/dc6620416c7edfade5eb7f7c6b3d19917adacf40))
* add job logs support ([f7f86d3](https://github.com/taskforcesh/taskforce-connector/commit/f7f86d37d589f4e04d5d407e0948b36365c35e51))
* add moveToFailed job command ([e7c64e6](https://github.com/taskforcesh/taskforce-connector/commit/e7c64e6f68c8ad26e88614e3e387a633e3f93279))
* add pause, resume and isPaused commands ([cf34cc6](https://github.com/taskforcesh/taskforce-connector/commit/cf34cc6084222f051c89de8a95edf13e8ee6a40b))
* add support for empty queues ([7928d5a](https://github.com/taskforcesh/taskforce-connector/commit/7928d5a11ebca2bccbc0b0c15eb8776bd184f9f6))
* add support for getting jobs without data ([#19](https://github.com/taskforcesh/taskforce-connector/issues/19)) ([f838f89](https://github.com/taskforcesh/taskforce-connector/commit/f838f89d6472ae98f5fbd32516a389ffcdb1873e))
* add support for obliterate ([a7ca9a0](https://github.com/taskforcesh/taskforce-connector/commit/a7ca9a08e2682e5c30b878ad3e87d74dd22bd315))
* add support for prefixes ([7f56bba](https://github.com/taskforcesh/taskforce-connector/commit/7f56bba2520a914e81dd42189938344faa577f63))
* add support for prefixes ([#18](https://github.com/taskforcesh/taskforce-connector/issues/18)) ([0ec6e7a](https://github.com/taskforcesh/taskforce-connector/commit/0ec6e7a6ea66c45c3c3a5ba3c3e855277878b57c))
* add support for Redis Sentinel ([#15](https://github.com/taskforcesh/taskforce-connector/issues/15)) ([870fce3](https://github.com/taskforcesh/taskforce-connector/commit/870fce361e82447075c802b1c244573e015d2cbc))
* add support for removing jobs, discarding, promoting, and retrying ([75a26ac](https://github.com/taskforcesh/taskforce-connector/commit/75a26ace7ad87ff1b75947c79a846aebb2019f15))
* add support for TLS and teams ([6837da5](https://github.com/taskforcesh/taskforce-connector/commit/6837da5aace9cb9d66c4cb5c082661a20a414149))
* send version to server ([3ccf451](https://github.com/taskforcesh/taskforce-connector/commit/3ccf4516d812d49f22bd96fb44bdc08590dd66a4))
