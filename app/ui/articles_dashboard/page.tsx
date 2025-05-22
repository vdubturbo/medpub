'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase_client'

export default function ArticlesDashboard() {
  const [stats, setStats] = useState({
    totalArticles: 0,
    newThisWeek: 0,
    totalCategories: 0,
    topCategories: []
  })
  const [articles, setArticles] = useState([])
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const pageSize = 10

  useEffect(() => {
    fetchStats()
    fetchArticles()
  }, [page])

  const filteredArticles = articles.filter(a =>
    a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  async function fetchStats() {
    const { data: articlesData } = await supabase
      .from('articles')
      .select('id, created_at')

    const { data: categoryData } = await supabase
      .from('categories')
      .select('id')

    const { data: topCats } = await supabase
      .rpc('get_top_categories', { limit_arg: 10 })

    const totalArticles = articlesData.length
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const newThisWeek = articlesData.filter(a => new Date(a.created_at) > oneWeekAgo).length

    setStats({
      totalArticles,
      newThisWeek,
      totalCategories: categoryData.length,
      topCategories: topCats || []
    })
  }

  async function fetchArticles() {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data } = await supabase
      .from('articles')
      .select(`
        *,
        article_categories(
          confidence,
          categories(name)
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, to)

    setArticles(data)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Article Dashboard</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Articles" value={stats.totalArticles} />
        <StatCard label="New This Week" value={stats.newThisWeek} />
        <StatCard label="Total Categories" value={stats.totalCategories} />
        <StatCard
          label="Top Categories"
          value={
            stats.topCategories && stats.topCategories.length > 0
              ? stats.topCategories.slice(0, 3).map(c => c.name).join(', ')
              : 'None'
          }
        />
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search articles titles and summaries..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 text-sm bg-zinc-700 text-white rounded border border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-4">
        {filteredArticles.map(article => (
          <div key={article.id} className="bg-zinc-800 p-4 rounded shadow">
            <Link href={`/ui/articles/${article.id}`}>
              <h2 className="text-xl font-semibold text-blue-400 hover:underline">{article.title}</h2>
            </Link>
            <p className="text-sm text-gray-400">
              Category: {article.article_categories?.[0]?.categories?.name || 'Unknown'} • Published: {article.published_date || '1/1/1111'}
            </p>
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          disabled={page === 1}
          className="bg-blue-600 px-4 py-2 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => setPage(p => p + 1)}
          className="bg-blue-600 px-4 py-2 rounded"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-zinc-800 p-4 rounded shadow text-center">
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-base text-gray-300">{value}</div>
    </div>
  )
}