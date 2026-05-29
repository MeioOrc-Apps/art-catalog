import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

const schema = z
  .object({
    code: z.string().min(1, 'Campo obrigatório'),
    email: z.string().email('Email inválido'),
    username: z
      .string()
      .min(3, 'Mínimo 3 caracteres')
      .max(64)
      .regex(/^[a-zA-Z0-9_\-.]+$/, 'Apenas letras, números, _, -, .'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export default function RegisterWithInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setUser } = useAuthStore()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { code: searchParams.get('code') ?? '' },
  })

  const onSubmit = async (data: FormData) => {
    setServerError(null)
    try {
      await authApi.registerWithInvite({
        code: data.code,
        email: data.email,
        password: data.password,
        username: data.username,
        locale: 'pt-BR',
      })
      await authApi.login(data.email, data.password)
      const user = await authApi.me()
      setUser(user)
      navigate('/', { replace: true })
    } catch {
      setServerError('Código inválido ou já utilizado')
    }
  }

  const field = (
    label: string,
    name: keyof FormData,
    type = 'text',
    autocomplete?: string,
  ) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium mb-1">{label}</label>
      <input
        id={name}
        type={type}
        autoComplete={autocomplete}
        className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        {...register(name)}
      />
      {errors[name] && (
        <p className="mt-1 text-xs text-destructive">{errors[name]?.message}</p>
      )}
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-display italic font-bold text-4xl tracking-tighter bg-gradient-to-r from-accent via-accent-gold to-accent-terracotta bg-clip-text text-transparent">Art Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">Criar conta com código-convite</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {field('Código-convite', 'code')}
          {field('Email', 'email', 'email', 'email')}
          {field('Nome de usuário', 'username', 'text', 'username')}
          {field('Senha', 'password', 'password', 'new-password')}
          {field('Confirmar senha', 'confirmPassword', 'password', 'new-password')}

          {serverError && (
            <p className="text-sm text-destructive text-center">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isSubmitting ? 'Carregando...' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}
