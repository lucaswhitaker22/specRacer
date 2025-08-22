import type { RouteRecordRaw } from 'vue-router'
import Home from '../views/Home.vue'
import Race from '../views/Race.vue'
import CarSelection from '../views/CarSelection.vue'
import Standings from '../views/Standings.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/car-selection',
    name: 'CarSelection',
    component: CarSelection
  },
  {
    path: '/race',
    name: 'Race',
    component: Race
  },
  {
    path: '/standings',
    name: 'Standings',
    component: Standings
  }
]