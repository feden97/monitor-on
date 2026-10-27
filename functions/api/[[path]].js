import { createProxy } from '../../server/proxy.js'

export const onRequest = createProxy({
  prefix: '/api',
  origin: 'https://data912.com',
  methods: ['GET', 'HEAD', 'POST'],
  cacheSeconds: 10,
  includeDestination: true,
})
