'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase_client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleLogin = () => {
    router.push('/login')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  console.log("USER OBJECT:", user)
  return (
    <nav className="w-full px-6 py-4 bg-zinc-800 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/ui/articles_dashboard" className="text-xl font-semibold hover:underline">
          🧬 MedPub Archive
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-gray-300">
                {user?.email || 'User logged in'}
              </span>
              <button
                onClick={() => router.push('/upload')}
                className="bg-blue-600 px-4 py-1 rounded text-sm hover:bg-blue-700 transition"
              >
                Upload
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-500 px-4 py-1 rounded text-sm hover:bg-red-600 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={handleLogin}
              className="bg-green-500 px-4 py-1 rounded text-sm hover:bg-green-600 transition"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}