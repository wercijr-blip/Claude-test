import { Router } from 'express'
import { handleWebhook } from './handler.js'

const webhookRouter = Router()
webhookRouter.post('/', handleWebhook)

export default webhookRouter
