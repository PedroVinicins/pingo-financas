import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const androidRoot = path.join(root, 'src-tauri', 'gen', 'android', 'app', 'src', 'main')
const manifestPath = path.join(androidRoot, 'AndroidManifest.xml')

if (!fs.existsSync(manifestPath)) {
  console.error('Android ainda não foi inicializado. Execute: npm run tauri android init')
  process.exit(1)
}

const xmlDir = path.join(androidRoot, 'res', 'xml')
const valuesDir = path.join(androidRoot, 'res', 'values')
fs.mkdirSync(xmlDir, { recursive: true })
fs.mkdirSync(valuesDir, { recursive: true })

fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut android:shortcutId="quick_expense" android:enabled="true" android:shortcutShortLabel="@string/pingo_shortcut_expense_short" android:shortcutLongLabel="@string/pingo_shortcut_expense_long">
    <intent android:action="android.intent.action.VIEW" android:data="pingo://expense" />
  </shortcut>
  <shortcut android:shortcutId="wallet" android:enabled="true" android:shortcutShortLabel="@string/pingo_shortcut_wallet_short" android:shortcutLongLabel="@string/pingo_shortcut_wallet_long">
    <intent android:action="android.intent.action.VIEW" android:data="pingo://wallet" />
  </shortcut>
  <shortcut android:shortcutId="vaults" android:enabled="true" android:shortcutShortLabel="@string/pingo_shortcut_vaults_short" android:shortcutLongLabel="@string/pingo_shortcut_vaults_long">
    <intent android:action="android.intent.action.VIEW" android:data="pingo://vaults" />
  </shortcut>
  <shortcut android:shortcutId="dashboard" android:enabled="true" android:shortcutShortLabel="@string/pingo_shortcut_dashboard_short" android:shortcutLongLabel="@string/pingo_shortcut_dashboard_long">
    <intent android:action="android.intent.action.VIEW" android:data="pingo://dashboard" />
  </shortcut>
</shortcuts>
`)

const stringsPath = path.join(valuesDir, 'strings.xml')
let strings = fs.existsSync(stringsPath) ? fs.readFileSync(stringsPath, 'utf8') : '<resources>\n</resources>\n'
const resources = [
  ['pingo_shortcut_expense_short', 'Novo gasto'],
  ['pingo_shortcut_expense_long', 'Registrar gasto rápido'],
  ['pingo_shortcut_wallet_short', 'Carteira'],
  ['pingo_shortcut_wallet_long', 'Abrir Pingo Wallet'],
  ['pingo_shortcut_vaults_short', 'Cofres'],
  ['pingo_shortcut_vaults_long', 'Ver dinheiro guardado'],
  ['pingo_shortcut_dashboard_short', 'Resumo'],
  ['pingo_shortcut_dashboard_long', 'Abrir resumo financeiro'],
]
for (const [name, value] of resources) {
  if (!strings.includes(`name="${name}"`)) strings = strings.replace('</resources>', `  <string name="${name}">${value}</string>\n</resources>`)
}
fs.writeFileSync(stringsPath, strings)

let manifest = fs.readFileSync(manifestPath, 'utf8')
if (!manifest.includes('android:allowBackup=')) {
  manifest = manifest.replace('<application', '<application\n        android:allowBackup="false"')
}
if (!manifest.includes('android.app.shortcuts')) {
  const activityEnd = manifest.indexOf('</activity>')
  if (activityEnd === -1) throw new Error('Não foi possível localizar a MainActivity no AndroidManifest.xml')
  const metadata = '      <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />\n    '
  manifest = manifest.slice(0, activityEnd) + metadata + manifest.slice(activityEnd)
}
if (!manifest.includes('android:windowSoftInputMode=')) {
  manifest = manifest.replace('<activity', '<activity\n            android:windowSoftInputMode="adjustResize"')
}
fs.writeFileSync(manifestPath, manifest)

console.log('Android configurado: teclado em adjustResize, backup externo desativado e atalhos Novo gasto, Carteira, Cofres e Resumo.')
