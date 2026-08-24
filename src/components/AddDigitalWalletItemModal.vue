<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Image, FileUp, ShieldCheck, X } from 'lucide-vue-next'
import type { DigitalWalletItemKind, NewDigitalWalletItemInput } from '../types/finance'

const props = withDefaults(defineProps<{ busy?: boolean; saveError?: string }>(), { busy: false, saveError: '' })
const emit = defineEmits<{ close: []; save: [input: NewDigitalWalletItemInput] }>()
const error = ref('')
const reading = ref(false)
const form = reactive({
  kind: 'ticket' as DigitalWalletItemKind, title: '', issuer: '', notes: '', qrValue: '',
  fileName: null as string | null, mimeType: null as string | null,
  fileDataUrl: null as string | null, expiresAt: '',
})
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

function pickFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  error.value = ''
  if (!allowed.has(file.type)) { error.value = 'Use uma imagem JPG, PNG, WebP ou um PDF.'; input.value = ''; return }
  if (file.size > 3 * 1024 * 1024) { error.value = 'O arquivo deve ter no máximo 3 MB.'; input.value = ''; return }
  reading.value = true
  const reader = new FileReader()
  reader.onload = () => {
    form.fileName = file.name
    form.mimeType = file.type
    form.fileDataUrl = String(reader.result)
    reading.value = false
  }
  reader.onerror = () => { error.value = 'Não foi possível ler este arquivo.'; reading.value = false }
  reader.readAsDataURL(file)
}
function submit() {
  if (props.busy || reading.value) return
  if (!form.title.trim()) { error.value = 'Dê um nome para este item.'; return }
  emit('save', {
    kind: form.kind, title: form.title.trim(), issuer: form.issuer.trim(), notes: form.notes.trim(),
    qrValue: form.qrValue.trim() || null, fileName: form.fileName, mimeType: form.mimeType,
    fileDataUrl: form.fileDataUrl, expiresAt: form.expiresAt || null,
  })
}
</script>

<template>
  <div class="pingo-modal-backdrop fixed inset-0 z-[90] flex items-end bg-slate-950/55 sm:items-center sm:justify-center sm:p-4" @click.self="!busy && emit('close')">
    <form class="pingo-modal-panel max-h-[94dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-[2rem] sm:p-6" @submit.prevent="submit">
      <div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold text-violet-600">Carteira ao vivo</p><h2 class="text-xl font-black">Criar cartão com sua imagem</h2><p class="mt-1 text-xs text-slate-500">Escolha uma foto da galeria para usar como capa.</p></div><button type="button" :disabled="busy" class="grid size-10 place-items-center rounded-xl bg-slate-100 disabled:opacity-40 dark:bg-slate-800" aria-label="Fechar" @click="emit('close')"><X :size="19" /></button></div>
      <div class="mt-5 grid gap-4 sm:grid-cols-2"><label class="grid gap-1.5 text-sm font-bold">Tipo<select v-model="form.kind" class="rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-slate-700"><option value="ticket">Ingresso / passagem</option><option value="document">Documento pessoal</option><option value="qr_code">QR Code</option><option value="other">Outro</option></select></label><label class="grid gap-1.5 text-sm font-bold">Validade<input v-model="form.expiresAt" type="date" class="rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-slate-700" /></label><label class="grid gap-1.5 text-sm font-bold sm:col-span-2">Nome<input v-model="form.title" maxlength="100" class="rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-slate-700" placeholder="Ex.: Ingresso do show" /></label><label class="grid gap-1.5 text-sm font-bold sm:col-span-2">Emissor<input v-model="form.issuer" maxlength="100" class="rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-slate-700" placeholder="Empresa ou órgão (opcional)" /></label><label class="grid gap-1.5 text-sm font-bold sm:col-span-2">Conteúdo do QR / código<input v-model="form.qrValue" maxlength="2000" class="rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-slate-700" placeholder="Opcional" /></label><label class="grid gap-1.5 text-sm font-bold sm:col-span-2">Observações<textarea v-model="form.notes" maxlength="500" rows="3" class="resize-none rounded-xl border border-slate-200 bg-transparent px-3 py-3 dark:border-slate-700"></textarea></label></div>
      <div v-if="form.fileDataUrl && form.mimeType?.startsWith('image/')" class="relative mt-4 aspect-[1.586/1] overflow-hidden rounded-[1.5rem] bg-slate-950"><img :src="form.fileDataUrl" alt="Prévia da capa" class="absolute inset-0 size-full object-cover" /><span class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-slate-950/10"></span><span class="absolute inset-x-4 bottom-4 truncate text-sm font-black text-white">{{ form.title || 'Prévia do cartão ao vivo' }}</span></div>
      <label class="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-violet-200 p-4 dark:border-violet-900"><Image v-if="!form.fileName" :size="22" class="text-violet-600" /><FileUp v-else :size="22" class="text-violet-600" /><span class="min-w-0"><strong class="block truncate text-sm">{{ reading ? 'Lendo arquivo…' : form.fileName || 'Escolher foto da galeria ou PDF' }}</strong><span class="block text-xs text-slate-500">JPG, PNG, WebP ou PDF · até 3 MB</span></span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="sr-only" @change="pickFile" /></label>
      <div class="mt-4 flex gap-3 rounded-2xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><ShieldCheck :size="19" class="shrink-0" /><p>O arquivo fica somente neste dispositivo. O Pingo não valida identidade nem substitui o documento original.</p></div>
      <p v-if="error || saveError" class="mt-3 text-sm font-bold text-rose-600" role="alert">{{ error || saveError }}</p>
      <button :disabled="reading || busy" class="mt-5 w-full rounded-2xl bg-violet-500 py-3.5 font-black text-white disabled:cursor-wait disabled:opacity-50">{{ busy ? 'Guardando…' : 'Guardar na carteira' }}</button>
    </form>
  </div>
</template>
