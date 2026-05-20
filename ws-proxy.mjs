import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'

const PORT = 8765

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.end()
})

const wss = new WebSocketServer({ 
  server,
  handleProtocols: () => false,
  verifyClient: () => true
})

wss.on('connection', (clientWs, req) => {
  const targetPath = req.url
  const targetUrl = `wss://stream.binance.com:9443${targetPath}`
  console.log(`Proxying: ${targetUrl}`)
  
  const binanceWs = new WebSocket(targetUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  
  binanceWs.on('open', () => {
    console.log(`Connected to Binance: ${targetPath}`)
    clientWs.on('message', (msg) => binanceWs.send(msg))
  })
  
  binanceWs.on('message', (msg) => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(msg)
  })
  
  binanceWs.on('close', () => clientWs.close())
  binanceWs.on('error', (e) => { console.log('Binance error:', e.message); clientWs.close() })
  clientWs.on('close', () => binanceWs.close())
  clientWs.on('error', (e) => console.log('Client error:', e.message))
})

server.listen(PORT, '0.0.0.0', () => console.log(`WS proxy en puerto ${PORT}`))
