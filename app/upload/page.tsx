'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase_client'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')
  const router = useRouter()

  const handleUpload = async () => {
    if (!file) return setStatus('Please select a file.')

    setStatus('Uploading...')

    const userRes = await supabase.auth.getUser()
    const user = userRes.data.user

    if (!user) return setStatus('You must be logged in.')

    const filename = `${Date.now()}_${file.name}`

    // Upload to Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('uploads')
      .upload(filename, file)

    if (storageError) {
      setStatus(`Storage error: ${storageError.message}`)
      return
    }

    // Insert into uploads table
    const { error: dbError } = await supabase
      .from('uploads')
      .insert({
        file_name: filename,
        uploader_id: user.id,
        status: 'processing',
      })

    if (dbError) {
      setStatus(`DB error: ${dbError.message}`)
      return
    }

    setStatus('Upload successful! Redirecting...')
    setTimeout(() => router.push('/'), 2000)
  }

  return (
    <div className="max-w-md mx-auto mt-20 bg-zinc-800 p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-white text-center">Upload PDF</h2>

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full mb-4 text-sm text-gray-300 file:mr-4 file:py-2 file:px-4
                   file:rounded file:border-0 file:text-sm file:font-semibold
                   file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      <button
        onClick={handleUpload}
        disabled={!file}
        className="w-full bg-blue-600 hover:bg-blue-700 transition px-4 py-2 rounded text-white disabled:opacity-50"
      >
        Upload
      </button>

      {status && <p className="mt-4 text-gray-300 text-sm text-center">{status}</p>}
    </div>
  )
}