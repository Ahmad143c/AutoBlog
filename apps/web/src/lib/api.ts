import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export { api }

// API response type
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export async function fetchStats() {
  const res = await api.get('/api/dashboard/stats')
  return res.data
}

export async function fetchSites() {
  const res = await api.get('/api/sites')
  return res.data
}

export async function fetchPosts() {
  const res = await api.get('/api/posts')
  return res.data
}

export async function fetchWorkflows() {
  const res = await api.get('/api/workflows')
  return res.data
}

export async function testSiteConnection(data: {
  url: string
  platform: "WORDPRESS" | "NEXTJS"
  credentials: object
}) {
  const res = await api.post('/api/sites/test', data)
  return res.data
}

export async function connectSite(data: object) {
  const res = await api.post('/api/sites', data)
  return res.data
}

export async function generatePost(data: {
  siteId: string
  topic: string
  keywords: string[]
  tone: string
  wordCount: number
  language: string
}) {
  const token = localStorage.getItem('auth_token')
  const res = await fetch(`${BASE_URL}/api/posts/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(data)
  })
  return res
}

export async function saveDraft(data: {
  siteId: string
  title: string
  content: string
  keywords: string[]
  tone: string
  wordCount: number
}) {
  const res = await api.post('/api/posts', data)
  return res.data
}

export async function publishPost(id: string) {
  const res = await api.post(`/api/posts/${id}/publish`)
  return res.data
}

export async function createWorkflow(data: object) {
  try {
    const res = await api.post('/api/workflows', data)
    return res.data
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw new Error(error.response.data.error || 'Failed to create workflow')
    }
    throw error
  }
}

export async function toggleWorkflow(id: string) {
  const res = await api.patch(`/api/workflows/${id}/toggle`)
  return res.data
}

export async function deletePost(id: string) {
  const res = await api.delete(`/api/posts/${id}`)
  return res.data
}

export async function deleteWorkflow(id: string) {
  const res = await api.delete(`/api/workflows/${id}`)
  return res.data
}

export async function deleteSite(id: string) {
  const res = await api.delete(`/api/sites/${id}`)
  return res.data
}
