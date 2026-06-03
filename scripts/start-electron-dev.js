const { spawn } = require('child_process')
const path = require('path')

const electronBin = process.platform === 'win32' ? 'electron.cmd' : 'electron'
const userDataDir = path.join(__dirname, '..', '.tmp', 'electron-dev-user-data')

const child = spawn(electronBin, ['.', `--user-data-dir=${userDataDir}`], {
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173',
  },
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
