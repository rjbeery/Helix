import serverless from 'serverless-http'
import { app } from './app' // your existing Express app export

export const handler = serverless(app)
