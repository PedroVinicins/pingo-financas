import net from 'node:net'
import { spawn } from 'node:child_process'

const port = 1420

function isPortOpen(host) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    socket.once('connect', () => { socket.end(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

if (await isPortOpen('127.0.0.1') || await isPortOpen('::1')) {
  console.log(`Servidor Vite já disponível na porta ${port}; reutilizando-o para o Tauri.`)
  process.exit(0)
}

const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], { stdio: 'inherit' })
child.once('exit', (code) => process.exit(code ?? 1))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
