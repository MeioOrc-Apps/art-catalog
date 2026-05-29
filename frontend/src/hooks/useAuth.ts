import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

export function useAuthInit() {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [setUser, setLoading])
}

export function useRequireAuth() {
  const { user, isLoading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login', { replace: true })
    }
  }, [user, isLoading, navigate])

  return { user, isLoading }
}

export function useLogout() {
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  return async () => {
    await authApi.logout()
    setUser(null)
    navigate('/login', { replace: true })
  }
}
