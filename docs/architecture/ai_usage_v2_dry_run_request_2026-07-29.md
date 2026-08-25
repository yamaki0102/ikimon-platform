# AI Usage v2 exact-SHA dry-run request

- PR: https://github.com/yamaki0102/ikimon-platform/pull/1497
- exact SHA: `427894a0c0ff4b395031420abf276f779b07cdcf`
- action: staging dry-run only
- prohibited: deploy, migration application, database write, feature activation, production mutation

Required validation:

- `npm --prefix platform_v2 run typecheck`
- targeted AI usage/context/provider tests
- `npm --prefix platform_v2 run test:node`
- `npm --prefix platform_v2 run build`
- PostgreSQL migration source/integration contract using disposable storage only
