import { createProxy } from '../../server/proxy.js'

export const onRequest = createProxy({
  prefix: '/cripto',
  origin: 'https://criptoya.com',
  source: 'CriptoYa',
  cacheSeconds: 30,
})
