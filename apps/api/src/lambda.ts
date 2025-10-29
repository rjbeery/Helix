import serverless from 'serverless-http'
import { initSecrets } from './config/secrets.js'

// Ensure secrets are loaded before accepting requests
await initSecrets()

// Import app after secrets are loaded
const { app } = await import('./app.js')

export const handler = serverless(app)
