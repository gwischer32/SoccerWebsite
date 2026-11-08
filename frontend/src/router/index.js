
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue')
  },
  {
    path: '/teams/:id',
    name: 'Team',
    component: () => import('../views/TeamView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
 