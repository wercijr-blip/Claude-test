const clients = new Set()

export function addSSEClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  res.write(':ok\n\n')
  clients.add(res)
  req.on('close', () => clients.delete(res))
}

export function broadcastSSE(event, data = {}) {
  if (clients.size === 0) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of clients) {
    try { res.write(payload) } catch { clients.delete(res) }
  }
}
