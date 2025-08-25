import type { RouteRecordRaw } from 'vue-router'
import Home from '../views/Home.vue'
import Race from '../views/Race.vue'
import CarSelection from '../views/CarSelection.vue'
import Standings from '../views/Standings.vue'
import Login from '../views/Login.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true }
  },
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: true }
  },
  {
    path: '/car-selection',
    name: 'CarSelection',
    component: CarSelection,
    meta: { requiresAuth: true }
  },
  {
    path: '/race',
    name: 'Race',
    component: Race,
    meta: { requiresAuth: true }
  },
  {
    path: '/standings',
    name: 'Standings',
    component: Standings,
    meta: { requiresAuth: true }
  }
]