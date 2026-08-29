import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import { installMobileModalViewportSync } from './services/mobileViewport'

createApp(App).use(createPinia()).mount('#app')
installMobileModalViewportSync()
