'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase_client'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    const redirectTimer = setTimeout(() => {
      router.push('/ui/articles_dashboard')
    }, 5000)
    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(redirectTimer)
    }
  }, [])

  const goToUpload = () => {
    router.push('/upload')
  }

  return (
    <section className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <img src="/med_pub_logo.webp" alt="MedPub Logo" className="mb-4" />

      {!user && (
        <p className="text-gray-400 text-lg mt-4">Please log in to upload articles.</p>
      )}
    </section>
  )
}