import { defineConfig } from '@adonisjs/static'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Get absolute path to the project root
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

export default defineConfig({
  enabled: true,
  dotFiles: 'ignore',
  etag: true,
  lastModified: true,
  maxAge: 3600,
  cacheControl: 'public, max-age=3600',
  /**
   * Paths to serve as static files
   */
  dirs: [
    {
      url: '/dist',
      directory: resolve(projectRoot, 'dist'),
      index: false
    }
  ]
})