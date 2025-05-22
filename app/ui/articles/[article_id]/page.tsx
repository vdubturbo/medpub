'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase_client'

export default function ArticleDetailPage() {
  const params = useParams()
  const articleId = params?.article_id
  const [article, setArticle] = useState(null)

  useEffect(() => {
    if (articleId) {
      fetchArticle()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId])

  async function fetchArticle() {
    const { data } = await supabase
      .from('articles')
      .select(`
        *,
        article_categories(
          confidence,
          categories(name)
        ),
        article_authors(
          display_order,
          authors(full_name)
        )
      `)
      .eq('id', articleId)
      .single()

    setArticle(data)
  }

  if (!article) return <div className="p-4 text-gray-200">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">{article.title}</h1>
      <div className="text-sm text-gray-400 mb-4 space-y-1">
        <div className="flex">
          <div className="w-28 font-medium">Published:</div>
          <div>{article.published_date || '1/1/1111'}</div>
        </div>
        <div className="flex">
          <div className="w-28 font-medium">Publisher:</div>
          <div>{article.publisher || 'Unknown'}</div>
        </div>
        <div className="flex">
          <div className="w-28 font-medium">Authors:</div>
          <div className="pl-6">
            {article.article_authors && article.article_authors.length > 0
              ? article.article_authors
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((entry, i) => entry.authors?.full_name)
                  .filter(Boolean)
                  .join(', ')
              : 'Not listed'}
          </div>
        </div>
        <div className="flex">
          <div className="w-28 font-medium">Length:</div>
          <div>{article.page_count || 'N/A'} pages</div>
        </div>
      </div>
      <p className="text-xs text-purple-400 mb-4">
        Summarized by: {article.model_used || 'Unknown model'}
      </p>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Summary</h2>
        <p className="text-gray-200">{article.summary || 'No summary available.'}</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {Array.isArray(article.article_categories) && article.article_categories.length > 0 ? (
            article.article_categories.map((cat, idx) => (
              <span key={idx} className="bg-blue-700 text-white text-xs px-2 py-1 rounded">
                {cat.categories?.name || 'Unknown'} ({cat.confidence !== undefined ? (cat.confidence * 100).toFixed(0) : '0'}%)
              </span>
            ))
          ) : (
            <span className="text-gray-400">None assigned</span>
          )}
        </div>
      </div>
    <div className="flex justify-end mt-8">
      <button className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded shadow">
        Purchase This Article
      </button>
    </div>
  </div>
  )
}