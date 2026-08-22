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
const kotlinDir = path.join(androidRoot, 'java', 'com', 'pedrosilva', 'financas')
fs.mkdirSync(xmlDir, { recursive: true })
fs.mkdirSync(valuesDir, { recursive: true })
fs.mkdirSync(kotlinDir, { recursive: true })

fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut android:shortcutId="quick_income" android:enabled="true" android:shortcutShortLabel="@string/pingo_shortcut_income_short" android:shortcutLongLabel="@string/pingo_shortcut_income_long">
    <intent android:action="android.intent.action.VIEW" android:data="pingo://income" />
  </shortcut>
  <shortcut android:shortcutId="quick_expense" android:enabled="true" android:shortcutShortLabel="@string/pingo_shortcut_expense_short" android:shortcutLongLabel="@string/pingo_shortcut_expense_long">
    <intent android:action="android.intent.action.VIEW" android:data="pingo://expense" />
  </shortcut>
  <shortcut android:shortcutId="wallet" android:enabled="true" android:shortcutShortLabel="@string/pingo_shortcut_wallet_short" android:shortcutLongLabel="@string/pingo_shortcut_wallet_long">
    <intent android:action="android.intent.action.VIEW" android:data="pingo://wallet" />
  </shortcut>
  <shortcut android:shortcutId="vaults" android:enabled="true" android:shortcutShortLabel="@string/pingo_shortcut_vaults_short" android:shortcutLongLabel="@string/pingo_shortcut_vaults_long">
    <intent android:action="android.intent.action.VIEW" android:data="pingo://vaults" />
  </shortcut>
</shortcuts>
`)

const stringsPath = path.join(valuesDir, 'strings.xml')
let strings = fs.existsSync(stringsPath) ? fs.readFileSync(stringsPath, 'utf8') : '<resources>\n</resources>\n'
const resources = [
  ['pingo_shortcut_income_short', 'Nova entrada'],
  ['pingo_shortcut_income_long', 'Registrar uma nova entrada'],
  ['pingo_shortcut_expense_short', 'Nova saída'],
  ['pingo_shortcut_expense_long', 'Registrar uma nova saída'],
  ['pingo_shortcut_wallet_short', 'Carteira'],
  ['pingo_shortcut_wallet_long', 'Abrir Pingo Wallet'],
  ['pingo_shortcut_vaults_short', 'Cofres'],
  ['pingo_shortcut_vaults_long', 'Ver dinheiro guardado'],
  ['pingo_shortcut_dashboard_short', 'Resumo'],
  ['pingo_shortcut_dashboard_long', 'Abrir resumo financeiro'],
]
for (const [name, value] of resources) {
  const element = `<string name="${name}">${value}</string>`
  const existing = new RegExp(`<string name="${name}">[^<]*</string>`)
  strings = existing.test(strings)
    ? strings.replace(existing, element)
    : strings.replace('</resources>', `  ${element}\n</resources>`)
}
fs.writeFileSync(stringsPath, strings)

fs.writeFileSync(path.join(kotlinDir, 'MobileShortcutsPlugin.kt'), `package com.pedrosilva.financas

import android.app.Activity
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class PinCardShortcutArgs {
  lateinit var cardId: String
  lateinit var label: String
}

@TauriPlugin
class MobileShortcutsPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun pinCardShortcut(invoke: Invoke) {
    val result = JSObject()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      result.put("supported", false)
      result.put("requested", false)
      invoke.resolve(result)
      return
    }

    val args = invoke.parseArgs(PinCardShortcutArgs::class.java)
    val safeLabel = args.label.trim().ifEmpty { "Cartão Pingo" }.take(40)
    val shortcutManager = activity.getSystemService(ShortcutManager::class.java)
    val supported = shortcutManager?.isRequestPinShortcutSupported == true
    var requested = false

    if (supported) {
      val shortcutId = "pingo_card_" + args.cardId.replace(Regex("[^A-Za-z0-9_-]"), "_").take(72)
      val intent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("pingo://wallet?card=" + Uri.encode(args.cardId)),
        activity,
        MainActivity::class.java,
      ).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      val shortcut = ShortcutInfo.Builder(activity, shortcutId)
        .setShortLabel(safeLabel)
        .setLongLabel("Abrir " + safeLabel + " na Carteira")
        .setIcon(Icon.createWithResource(activity, R.mipmap.ic_launcher))
        .setIntent(intent)
        .build()
      requested = shortcutManager.requestPinShortcut(shortcut, null)
    }

    result.put("supported", supported)
    result.put("requested", requested)
    invoke.resolve(result)
  }
}
`)

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

console.log('Android configurado: biometria nativa, atalho de cartão e ações Nova entrada, Nova saída, Carteira e Cofres.')
