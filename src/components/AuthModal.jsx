import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { login, register } from '../api/client'

const inputClass =
  'w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400'

function AuthModal({ notice, onClose, onAuthenticated }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', name: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateField = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const user =
        mode === 'login'
          ? await login({ email: form.email.trim(), password: form.password })
          : await register({ email: form.email.trim(), name: form.name.trim(), password: form.password })
      onAuthenticated(user)
    } catch (authError) {
      if (mode === 'login' && authError.status === 401) {
        setError('Invalid email or password.')
      } else if (authError.status === 409) {
        setError('That email is already registered.')
      } else {
        setError(authError.message || 'Authentication failed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <form
        className="w-full max-w-md space-y-4 rounded-[2rem] border border-slate-700 bg-slate-950 p-6 shadow-2xl shadow-black/40"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Account</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{mode === 'login' ? 'Log in' : 'Create account'}</h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {notice ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{notice}</div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

        <input className={inputClass} type="email" placeholder="Email" required value={form.email} onChange={updateField('email')} />
        {mode === 'register' ? (
          <input
            className={inputClass}
            placeholder="Name"
            required
            maxLength={100}
            value={form.name}
            onChange={updateField('name')}
          />
        ) : null}
        <input
          className={inputClass}
          type="password"
          placeholder="Password"
          required
          minLength={mode === 'register' ? 8 : undefined}
          maxLength={72}
          value={form.password}
          onChange={updateField('password')}
        />

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:from-cyan-400 hover:to-emerald-300 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === 'login' ? 'Log in' : 'Register'}
        </button>

        <p className="text-center text-sm text-slate-400">
          {mode === 'login' ? 'No account yet?' : 'Already registered?'}{' '}
          <button
            type="button"
            className="font-semibold text-cyan-300 hover:text-cyan-200"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
            }}
          >
            {mode === 'login' ? 'Create one' : 'Log in'}
          </button>
        </p>
      </form>
    </div>
  )
}

export default AuthModal
