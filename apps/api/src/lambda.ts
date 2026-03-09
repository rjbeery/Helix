import serverless from 'serverless-http'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'

let appHandler: ReturnType<typeof serverless> | null = null
let initError: Error | null = null

// Initialize app at module load time
async function initializeApp() {
  try {
    console.log('[lambda] Starting initialization...')
    
    // Load secrets
    const { initSecrets } = await import('./config/secrets.js')
    console.log('[lambda] Loaded secrets module')
    await initSecrets()
    console.log('[lambda] Secrets initialized')

    // Import app after secrets are loaded
    const appModule = await import('./app.js')
    console.log('[lambda] App module loaded')
    
    if (!appModule.app) {
      throw new Error('app.js did not export "app"')
    }

    appHandler = serverless(appModule.app)
    console.log('[lambda] Handler initialized successfully')
  } catch (err) {
    console.error('[lambda] Initialization failed:', err)
    initError = err as Error
    throw err
  }
}

// Initialize immediately
await initializeApp().catch(err => {
  console.error('[lambda] Cold start failed:', err)
})

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  // If initialization failed, return error
  if (initError) {
    console.error('[lambda] Handler invoked but init failed:', initError.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'API initialization failed',
        details: process.env.NODE_ENV === 'production' ? undefined : initError.message
      })
    }
  }

  if (!appHandler) {
    console.error('[lambda] Handler invoked but appHandler is null')
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error', message: 'Handler not initialized' })
    }
  }

  try {
    console.log(`[lambda] Processing request: ${event.requestContext?.http?.method} ${event.rawPath}`)
    const result = await appHandler(event, {} as any)
    console.log(`[lambda] Request completed with status ${(result as any).statusCode || 'unknown'}`)
    return result
  } catch (err) {
    console.error('[lambda] Request handling error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 'Request failed' : (err as Error).message
      })
    }
  }
}
