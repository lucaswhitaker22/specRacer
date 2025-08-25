import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { routes } from './router/index'
import { usePlayerStore } from './stores/player'
import './styles/global.css'

// Create Pinia store
const pinia = createPinia()

// Create Vue Router
const router = createRouter({
  history: createWebHistory(),
  routes
})

// Create and mount the Vue app
const app = createApp(App)

app.use(pinia)
app.use(router)

// Add route guards after pinia is installed
router.beforeEach(async (to, from, next) => {
  const playerStore = usePlayerStore()
  
  // Initialize player store from localStorage on first load
  if (!playerStore.currentPlayer) {
    await playerStore.initializeFromStorage()
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest)

  if (requiresAuth && !playerStore.isAuthenticated) {
    next('/login')
  } else if (requiresGuest && playerStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

app.mount('#app')