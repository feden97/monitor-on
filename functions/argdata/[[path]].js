import { createProxy } from '../../server/proxy.js'

export const onRequest = createProxy({
  prefix: '/argdata',
  origin: 'https://api.argentinadatos.com',
  source: 'ArgentinaDatos',
  cacheSeconds: 300,
})
