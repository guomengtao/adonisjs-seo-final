import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Updating the "Accept" header to always accept "application/json" response
 * from the server. This will force the internals of the framework like
 * validator errors or auth errors to return a JSON response.
 */
export default class ForceJsonResponseMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    // Skip JSON force for static files
    const url = request.url()
    const staticFileExtensions = ['.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp']
    const isStaticFile = staticFileExtensions.some(ext => url.endsWith(ext))
    
    if (!isStaticFile) {
      const headers = request.headers()
      headers.accept = 'application/json'
    }

    return next()
  }
}