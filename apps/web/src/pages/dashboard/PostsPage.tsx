import { useEffect, useState } from 'react'
import { Plus, ExternalLink, Trash2, Send, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import type { Post, PostStatus } from '@autoblog/shared'

const statusColors: Record<PostStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'secondary',
  SCHEDULED: 'outline',
  PUBLISHING: 'default',
  PUBLISHED: 'default',
  FAILED: 'destructive',
}

const statusLabels: Record<PostStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PUBLISHING: 'Publishing',
  PUBLISHED: 'Published',
  FAILED: 'Failed',
}

export function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const postsPerPage = 10

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const { data } = await api.get('/api/posts')
      if (data.success) {
        setPosts(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return
    
    try {
      await api.delete(`/api/posts/${id}`)
      const updated = posts.filter(p => p.id !== id)
      setPosts(updated)
      
      // Adjust current page if the deletion left the current page empty
      const totalPagesAfterDelete = Math.ceil(updated.length / postsPerPage)
      if (currentPage > totalPagesAfterDelete && totalPagesAfterDelete > 0) {
        setCurrentPage(totalPagesAfterDelete)
      }
    } catch (error) {
      console.error('Failed to delete post:', error)
    }
  }

  const handlePublish = async (id: string) => {
    try {
      await api.post(`/api/posts/${id}/publish`)
      fetchPosts()
    } catch (error) {
      console.error('Failed to publish post:', error)
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading posts...</div>
  }

  const totalPages = Math.ceil(posts.length / postsPerPage)
  const paginatedPosts = posts.slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Posts</h1>
          <p className="text-muted-foreground">Manage your blog posts</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Generate New Post
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No posts yet. Create your first post to get started.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                {paginatedPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start justify-between p-4 border rounded-lg dark:border-gray-800"
                  >
                    <div className="space-y-1">
                      <h3 className="font-semibold">{post.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={statusColors[post.status]}>
                          {statusLabels[post.status]}
                        </Badge>
                        <span>•</span>
                        <span>{post.wordCount} words</span>
                        <span>•</span>
                        <span>{post.tone}</span>
                        {post.n8nRunId && (
                          <>
                            <span>•</span>
                            <span>n8n: {post.n8nRunId.slice(0, 8)}...</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {post.status === 'DRAFT' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePublish(post.id)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {post.wpPostId && (
                        <Button variant="outline" size="sm" asChild>
                          <a 
                            href={`${post.site?.url}/?p=${post.wpPostId}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(post.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t dark:border-gray-800 pt-4 mt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing <span className="font-medium">{(currentPage - 1) * postsPerPage + 1}</span> to{" "}
                    <span className="font-medium">
                      {Math.min(currentPage * postsPerPage, posts.length)}
                    </span>{" "}
                    of <span className="font-medium">{posts.length}</span> posts
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Limit visible pages if there are too many (e.g. only show current, +/- 1, first, and last)
                        if (
                          totalPages > 6 &&
                          page !== 1 &&
                          page !== totalPages &&
                          Math.abs(page - currentPage) > 1
                        ) {
                          if (page === 2 && currentPage > 3) {
                            return <span key="ellipsis-start" className="px-2 text-muted-foreground">...</span>
                          }
                          if (page === totalPages - 1 && currentPage < totalPages - 2) {
                            return <span key="ellipsis-end" className="px-2 text-muted-foreground">...</span>
                          }
                          return null
                        }

                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

