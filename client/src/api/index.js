import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('remed_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('remed_token')
      localStorage.removeItem('remed_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
}

export const schemaApi = {
  get: () => api.get('/schema'),
}

export const complaintsApi = {
  submit: (formData) => api.post('/complaints', formData),
  list: (params) => api.get('/complaints', { params }),
  get: (id) => api.get(`/complaints/${id}`),
  update: (id, data) => api.patch(`/complaints/${id}`, data),
  addNote: (id, note) => api.post(`/complaints/${id}/notes`, { note }),
  export: () => api.get('/complaints/export', { responseType: 'blob' }),
}

export const adminApi = {
  getUsers: () => api.get('/admin/users'),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getPriorityRules: () => api.get('/admin/priority-rules'),
  createPriorityRule: (data) => api.post('/admin/priority-rules', data),
  updatePriorityRule: (id, data) => api.patch(`/admin/priority-rules/${id}`, data),
  deletePriorityRule: (id) => api.delete(`/admin/priority-rules/${id}`),
  getRoutingRules: () => api.get('/admin/routing-rules'),
  createRoutingRule: (data) => api.post('/admin/routing-rules', data),
  updateRoutingRule: (id, data) => api.patch(`/admin/routing-rules/${id}`, data),
  deleteRoutingRule: (id) => api.delete(`/admin/routing-rules/${id}`),
  getSlaConfigs: () => api.get('/admin/sla-configs'),
  updateSlaConfig: (priority, data) => api.patch(`/admin/sla-configs/${priority}`, data),
}

export const teamsApi = {
  getTeams: () => api.get('/admin/teams'),
  createTeam: (data) => api.post('/admin/teams', data),
  updateTeam: (id, data) => api.patch(`/admin/teams/${id}`, data),
  deleteTeam: (id) => api.delete(`/admin/teams/${id}`),
}

export const analyticsApi = {
  summary: () => api.get('/analytics/summary'),
}

export default api
