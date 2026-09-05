'use client'

import { FormEvent, useState } from 'react'
import { Mail, Phone, ShieldCheck, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailMode, setEmailMode] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('')
    const result = mode === 'sign-up' ? await authClient.signUp.email({ name, email, password }) : await authClient.signIn.email({ email, password })
    setPending(false)
    if (result.error) { setError('We could not complete that request. Check your details and try again.'); return }
    router.push('/'); router.refresh()
  }

  return <main className="min-h-screen bg-background px-4 py-5 sm:flex sm:items-center sm:justify-center sm:py-8"><form onSubmit={submit} className="mx-auto flex min-h-[560px] w-full max-w-[360px] flex-col rounded-[2rem] border border-border/70 bg-card px-5 pb-7 pt-10 shadow-[0_18px_55px_-28px_color-mix(in_oklab,var(--primary)_35%,transparent)] sm:px-8">
    <div className="flex flex-col items-center text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Sparkles className="size-6" /></span><h1 className="mt-4 text-[22px] font-bold tracking-tight">{mode === 'sign-up' ? 'Create your account' : 'Welcome to Labzeck'}</h1><p className="mt-2 max-w-[250px] text-xs leading-5 text-muted-foreground">Get started by signing in to your account</p></div>
    <div className="mt-8 flex flex-col gap-3">
      <button type="button" className="flex min-h-12 items-center gap-4 rounded-xl border border-border/80 bg-card px-4 text-left text-xs font-semibold transition-colors hover:border-primary hover:bg-primary/5"><span className="text-lg font-black text-[#4285F4]">G</span><span className="flex-1 text-center">Continue with Google</span></button>
      <button type="button" onClick={() => setEmailMode(true)} className="flex min-h-12 items-center gap-4 rounded-xl border border-border/80 bg-card px-4 text-left text-xs font-semibold transition-colors hover:border-primary hover:bg-primary/5"><Mail className="size-[18px] text-foreground" /><span className="flex-1 text-center">Continue with email &amp; password</span></button>
      <button type="button" disabled className="flex min-h-12 items-center gap-3 rounded-xl border border-border/80 bg-card px-4 text-left text-xs font-semibold text-foreground disabled:cursor-not-allowed"><Phone className="size-[18px]" /><span className="flex-1">Phone number</span><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Coming soon</span></button>
    </div>
    {emailMode && <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-muted/50 p-3"><p className="text-[11px] font-semibold text-muted-foreground">{mode === 'sign-up' ? 'Create your account with email' : 'Sign in with email'}</p>{mode === 'sign-up' && <input aria-label="Full name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" />}<input type="email" aria-label="Email address" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" /><input type="password" aria-label="Password" placeholder="Password (8+ characters)" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" />{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<button disabled={pending} className="min-h-11 rounded-xl bg-primary text-xs font-bold text-primary-foreground disabled:opacity-50">{pending ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}</button></div>}
    <div className="mt-auto pt-8 text-center"><div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" />By continuing, you agree to our</div><p className="mt-1 text-[10px] font-semibold text-primary">Terms of Service <span className="font-normal text-muted-foreground">and</span> Privacy Policy</p><a href={mode === 'sign-up' ? '/sign-in' : '/sign-up'} className="mt-5 block text-xs font-semibold text-primary">{mode === 'sign-up' ? 'Already have an account? Sign in' : 'New to Labzeck? Create an account'}</a></div>
  </form></main>
}
