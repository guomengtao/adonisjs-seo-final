import { defineConfig } from '@adonisjs/static'

export default defineConfig({
  enabled: true,
  dotFiles: 'ignore',
  etag: true,
  lastModified: true,
  maxAge: 3600,
  cacheControl: true
})