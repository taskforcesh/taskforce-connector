# [1.28.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.27.2...v1.28.0) (2024-05-20)


### Features

* add response time to logs ([9b461f7](https://github.com/taskforcesh/taskforce-connector/commit/9b461f7a9a617506e1717901dd1576a5e7b0c426))

## [1.27.2](https://github.com/taskforcesh/taskforce-connector/compare/v1.27.1...v1.27.2) (2024-05-20)


### Bug Fixes

* improve scan max count ([dfaec16](https://github.com/taskforcesh/taskforce-connector/commit/dfaec16822695f2a31327a94971b1f2aefe66d09))

## [1.27.1](https://github.com/taskforcesh/taskforce-connector/compare/v1.27.0...v1.27.1) (2024-05-20)


### Bug Fixes

* **ws:** log send errors ([4726f7b](https://github.com/taskforcesh/taskforce-connector/commit/4726f7b52cd48a8a4ccb54447413aab6976fcaa8))

# [1.27.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.26.0...v1.27.0) (2024-05-20)


### Features

* add support for getWorkersCount ([f07db90](https://github.com/taskforcesh/taskforce-connector/commit/f07db908737a3fb9938e2d2276266ff0c5e883e1))
* better logs when getting connection ([4dee10f](https://github.com/taskforcesh/taskforce-connector/commit/4dee10f7fd901caaf72a8f8a99a074551a051ec1))
* upgrade bull and bullmq dependencies ([67235bf](https://github.com/taskforcesh/taskforce-connector/commit/67235bf6a27883d4173bfaa1d4690bff3af4f621))

# [1.26.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.25.1...v1.26.0) (2023-12-21)


### Features

* add support for bullmq flows ([42281f9](https://github.com/taskforcesh/taskforce-connector/commit/42281f9190149af7a6f91de670f99f6e353973b2))

## [1.25.1](https://github.com/taskforcesh/taskforce-connector/compare/v1.25.0...v1.25.1) (2023-11-17)


### Bug Fixes

* correctly discover queues in redis clusters ([781e963](https://github.com/taskforcesh/taskforce-connector/commit/781e963cca48dcde7063fab13cd4148522480848))

# [1.25.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.24.5...v1.25.0) (2023-11-05)


### Features

* add support for env var REDIS_NODES ([ec32ad6](https://github.com/taskforcesh/taskforce-connector/commit/ec32ad6431d98681856849ed92d64127680ba33c))

## [1.24.5](https://github.com/taskforcesh/taskforce-connector/compare/v1.24.4...v1.24.5) (2023-08-08)


### Bug Fixes

* use different connections for bull and bullmq ([a7ebf24](https://github.com/taskforcesh/taskforce-connector/commit/a7ebf244903548c07ed3cc069a23918adbfc924f))

## [1.24.4](https://github.com/taskforcesh/taskforce-connector/compare/v1.24.3...v1.24.4) (2023-08-08)


### Bug Fixes

* upgrade bull and bullmq ([30e7b38](https://github.com/taskforcesh/taskforce-connector/commit/30e7b38d480a5683892c4995e3b9a83c7d3ca8ca))

## [1.24.3](https://github.com/taskforcesh/taskforce-connector/compare/v1.24.2...v1.24.3) (2023-05-16)


### Bug Fixes

* **cmdline:** fix teams and nodes options ([7981945](https://github.com/taskforcesh/taskforce-connector/commit/798194558067815bcb00030dfadcf4fcf089d886))

## [1.24.2](https://github.com/taskforcesh/taskforce-connector/compare/v1.24.1...v1.24.2) (2023-05-16)


### Bug Fixes

* **bullmq:** call clean with correct arguments ([0822374](https://github.com/taskforcesh/taskforce-connector/commit/08223745983b9ed1310e7668573cfe6faf27ea10))

## [1.24.1](https://github.com/taskforcesh/taskforce-connector/compare/v1.24.0...v1.24.1) (2023-04-20)


### Bug Fixes

* pick username from Connection options ([57fd2f5](https://github.com/taskforcesh/taskforce-connector/commit/57fd2f5fc958ea49adfd72c90d8cfd99def5e55f))

# [1.24.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.23.0...v1.24.0) (2023-04-20)


### Bug Fixes

* **cli:** correct newest version reporting ([949dabb](https://github.com/taskforcesh/taskforce-connector/commit/949dabb19885e4fb75dc75f7259aa3cf0faf33ed))
* upgrade bull and bullmq packages ([72fd1f2](https://github.com/taskforcesh/taskforce-connector/commit/72fd1f27a4835ec96632f1088cda388a3a8ad773))


### Features

* add support for queue integrations ([f8d2067](https://github.com/taskforcesh/taskforce-connector/commit/f8d2067d2988922e921a3dafb32ba4a12633ed78))

# [1.23.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.22.0...v1.23.0) (2023-04-12)


### Features

* add bullmq support ([1ff070b](https://github.com/taskforcesh/taskforce-connector/commit/1ff070ba57f480566f8c751e2c68444f7314a4e1))

# [1.22.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.21.2...v1.22.0) (2023-03-24)


### Features

* add sentinel password support ([3ee89e0](https://github.com/taskforcesh/taskforce-connector/commit/3ee89e0c2e1f8c5e0c9d55426671e3d0f6b1feb3))

## [1.21.2](https://github.com/taskforcesh/taskforce-connector/compare/v1.21.1...v1.21.2) (2023-03-10)


### Bug Fixes

* better error handling ([6981600](https://github.com/taskforcesh/taskforce-connector/commit/69816006ce39a3638baa8751b0fc5b797cf52ae0))

## [1.21.1](https://github.com/taskforcesh/taskforce-connector/compare/v1.21.0...v1.21.1) (2023-01-23)


### Bug Fixes

* **queues:** use scan instead of keys fixes https://github.com/taskforcesh/issues/issues/65 ([3c017ec](https://github.com/taskforcesh/taskforce-connector/commit/3c017ec490e622b8054f5af6871ebb69a46638aa))

# [1.21.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.20.0...v1.21.0) (2023-01-23)


### Features

* support custom backend programmatically ([87a0e60](https://github.com/taskforcesh/taskforce-connector/commit/87a0e60a6c06b757cebf9c1e0c0241ec65379726))

# [1.20.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.19.0...v1.20.0) (2022-06-09)


### Features

* add experimental support to redis cluster ([e0e12bb](https://github.com/taskforcesh/taskforce-connector/commit/e0e12bb0e18d9781924f63dd57e61ca872e436b6))

# [1.19.0](https://github.com/taskforcesh/taskforce-connector/compare/v1.18.0...v1.19.0) (2022-05-31)


### Bug Fixes

* **dockerfile:** update pm2 fixes [#45](https://github.com/taskforcesh/taskforce-connector/issues/45) ([1aa1e5d](https://github.com/taskforcesh/taskforce-connector/commit/1aa1e5dc6d309ff3aae430c6a94e4c6322831d20))


### Features

* add ping support ([3805b5a](https://github.com/taskforcesh/taskforce-connector/commit/3805b5a6707e36cb493a3f097560892f19f23aa7))

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
