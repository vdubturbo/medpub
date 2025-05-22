'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase_client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Magic link sent! Check your inbox.')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 bg-zinc-800 p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-white text-center">Login</h2>
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full mb-4 p-2 rounded bg-zinc-700 text-white"
      />
      <button
        onClick={handleLogin}
        className="w-full bg-blue-600 hover:bg-blue-700 transition px-4 py-2 rounded text-white"
      >
        Send Magic Link
      </button>
      {message && <p className="mt-4 text-gray-300 text-sm">{message}</p>}
    </div>
  )
}