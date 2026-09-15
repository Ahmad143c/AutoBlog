import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Edit, Trash2, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import { BASE_URL, fetchPosts, publishPost, fetchWorkflows } from "@/lib/api"

interface Post {
  id: string
  title: string
  site: {
    name: string
    url: string
    socialAccounts?: { platform: string }[]
  }
  siteId: string
  wpPostId: number | null
  status: "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED"
  wordCount: number
  readabilityScore?: number | null
  createdAt: string
  publishedAt?: string
  scheduledAt?: string
  socialShares?: {
    id: string
    platform: string
    status: string
    shareUrl: string | null
    error: string | null
  }[]
}

const PLATFORM_CONFIG: Record<string, {
  icon: string
  color: string
  bgColor: string
  label: string
}> = {
  FACEBOOK:  { icon: "ti-brand-facebook",  color: "#185FA5", bgColor: "#E6F1FB", label: "Facebook" },
  INSTAGRAM: { icon: "ti-brand-instagram", color: "#993556", bgColor: "#FBEAF0", label: "Instagram" },
  LINKEDIN:  { icon: "ti-brand-linkedin",  color: "#0C447C", bgColor: "#E6F1FB", label: "LinkedIn" },
  TWITTER:   { icon: "ti-brand-x",         color: "#2C2C2A", bgColor: "#F1EFE8", label: "X" },
  THREADS:   { icon: "ti-brand-threads",   color: "#000000", bgColor: "#F0F0F0", label: "Threads" },
  YOUTUBE:   { icon: "ti-brand-youtube",   color: "#FF0000", bgColor: "#FFEBEB", label: "YouTube" },
}


function PostStatusBadge({ status, scheduledAt }: { status: string; scheduledAt?: string }) {
  const statusStyles = {
    DRAFT: "bg-gray-100 text-gray-800",
    SCHEDULED: "bg-amber-100 text-amber-800 cursor-help", 
    PUBLISHING: "bg-blue-100 text-blue-800",
    PUBLISHED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800"
  }

  const titleText = status === "SCHEDULED" && scheduledAt
    ? `Scheduled for: ${new Date(scheduledAt).toLocaleString()}`
    : undefined

  return (
    <span 
      title={titleText}
      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status as keyof typeof statusStyles]}`}
    >
      {status}
    </span>
  )
}

export default function Posts() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const postsPerPage = 10

  useEffect(() => {
    setCurrentPage(1)
  }, [activeFilter])
  
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
    wpPostId: number | null
    siteId: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const [toast, setToast] = useState<{msg:string,type:"success"|"error"}|null>(null)

  function showToast(msg: string, type: "success"|"error" = "success") {
    setToast({ msg, type })
    setTimeout(() => setToast(null), type === "error" ? 7000 : 3500)
  }

  const filters = [
    { id: "all", label: "All" },
    { id: "DRAFT", label: "Draft" },
    { id: "SCHEDULED", label: "Scheduled" },
    { id: "PUBLISHED", label: "Published" },
    { id: "FAILED", label: "Failed" }
  ]

  const [workflows, setWorkflows] = useState<any[]>([])
  
  const [shareModal, setShareModal] = useState<{
    post: Post
    platform: string
  } | null>(null)
  
  const [viewShareUrl, setViewShareUrl] = useState<{
    platform: string
    url: string
  } | null>(null)

  const handleSocialIconClick = (post: Post, platform: string) => {
    const share = post.socialShares?.find(s => s.platform === platform)
    if (share?.status === "SHARED" && share.shareUrl) {
      setViewShareUrl({ platform, url: share.shareUrl })
    } else {
      setShareModal({ post, platform })
    }
  }

  const handleExecuteShare = async (post: Post, platform: string) => {
    setShareModal(null)
    
    // Set status to pending in local state
    setPosts(prev => prev.map(p => {
      if (p.id === post.id) {
        const existingShares = p.socialShares || []
        const cleanShares = existingShares.filter(s => s.platform !== platform)
        return {
          ...p,
          socialShares: [
            ...cleanShares,
            { id: "temp", platform, status: "PENDING", shareUrl: null, error: null }
          ]
        }
      }
      return p
    }))

    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${BASE_URL}/api/social/share/${post.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ platform })
      })
      const data = await res.json()

      if (data.success) {
        setPosts(prev => prev.map(p => {
          if (p.id === post.id) {
            const existingShares = p.socialShares || []
            const cleanShares = existingShares.filter(s => s.platform !== platform)
            return {
              ...p,
              socialShares: [
                ...cleanShares,
                {
                  id: data.data.id,
                  platform,
                  status: "SHARED",
                  shareUrl: data.data.shareUrl,
                  error: null
                }
              ]
            }
          }
          return p
        }))
        showToast(`Successfully shared to ${PLATFORM_CONFIG[platform]?.label}!`)
      } else {
        // Build a user-friendly error message based on the HTTP status
        let userMsg: string
        const platformLabel = PLATFORM_CONFIG[platform]?.label || platform
        const detail = data.platformError ? ` (${data.platformError.replace(/^\[\d{3}\]\s*/, "")})` : ""

        if (res.status === 401 || res.status === 403) {
          if (platform === "LINKEDIN") {
            userMsg = `LinkedIn rejected the request (403). Regenerate your token at linkedin.com/developers and select the "w_member_social" scope.`
          } else {
            userMsg = `${platformLabel}: Access denied${detail}. Please reconnect your account in site Settings → Social Accounts.`
          }
        } else if (res.status === 400) {
          userMsg = data.platformError || data.error || "Bad request — check your social account configuration."
        } else {
          const raw = data.platformError || data.error || "Failed to share post"
          userMsg = raw.replace(/^\[\d{3}\]\s*/, "")
        }
        throw Object.assign(new Error(userMsg), { httpStatus: res.status })
      }
    } catch (err: any) {
      console.error("[Posts] share error:", err)
      const displayMsg = err.message || "Failed to share post"
      setPosts(prev => prev.map(p => {
        if (p.id === post.id) {
          const existingShares = p.socialShares || []
          const cleanShares = existingShares.filter(s => s.platform !== platform)
          return {
            ...p,
            socialShares: [
              ...cleanShares,
              {
                id: "temp",
                platform,
                status: "FAILED",
                shareUrl: null,
                error: displayMsg
              }
            ]
          }
        }
        return p
      }))
      showToast(displayMsg, "error")
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const [postsRes, workflowsRes] = await Promise.all([
          fetchPosts(),
          fetchWorkflows()
        ])
        if (postsRes.success) {
          setPosts(postsRes.data)
        }
        if (workflowsRes.success) {
          setWorkflows(workflowsRes.data)
        }
      } catch (error) {
        console.error('Error fetching posts or workflows:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handlePublish = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await publishPost(id)
      if (res.success) {
        setPosts(posts.map(p => p.id === id ? { ...p, status: 'PUBLISHING' } : p))
      } else {
        alert(res.error || "Failed to publish post")
      }
    } catch (error: any) {
      alert(error.message || "Failed to publish post")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(target: typeof deleteTarget) {
    if (!target) return
    setIsDeleting(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(
        `${BASE_URL}/api/posts/${target.id}`,
        { 
          method: "DELETE",
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        }
      )
      const data = await res.json()

      if (data.success) {
        // Remove from local posts list immediately
        const updated = posts.filter(p => p.id !== target.id)
        setPosts(updated)
        setDeleteTarget(null)

        // Adjust current page if the deletion left the current page empty
        const currentFiltered = activeFilter === "all" ? updated : updated.filter(p => p.status === activeFilter)
        const totalPagesAfterDelete = Math.ceil(currentFiltered.length / postsPerPage)
        if (currentPage > totalPagesAfterDelete && totalPagesAfterDelete > 0) {
          setCurrentPage(totalPagesAfterDelete)
        }

        // Show success toast
        showToast(
          data.data.wpTrashed
            ? "Post moved to trash on WordPress too."
            : "Post deleted from AutoBlog.",
          "success"
        )
      } else {
        showToast("Delete failed: " + data.error, "error")
      }
    } catch (error: any) {
      showToast("Delete failed: " + error.message, "error")
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredPosts = activeFilter === "all" 
    ? posts 
    : posts.filter(post => post.status === activeFilter)

  const totalPages = Math.ceil(filteredPosts.length / postsPerPage)
  const paginatedPosts = filteredPosts.slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage)

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg
                         text-sm font-medium text-white max-w-sm leading-snug
                         ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}
      
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center 
                        justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Move to trash?</h3>
                <p className="text-xs text-gray-500 mt-0.5">This will also trash the post on WordPress.</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mb-4">
              "{deleteTarget.title}"
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 border border-gray-200 text-gray-700 rounded-lg 
                           py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm 
                           font-medium hover:bg-red-700 disabled:opacity-40"
              >
                {isDeleting ? "Moving to trash..." : "Move to trash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Blog Posts</h1>
        <button 
          onClick={() => navigate('/dashboard/posts/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Generate New Post
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <div className="flex space-x-1">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeFilter === filter.id
                    ? "bg-primary-100 text-primary-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts Table */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded mb-2"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {activeFilter === "SCHEDULED" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Automation Workflows</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Recurring automated post generation schedules.</p>
                </div>
                <button
                  onClick={() => navigate('/dashboard/workflows')}
                  className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                >
                  Manage Workflows &rarr;
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Workflow Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Site
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Topic/Theme
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Schedule
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {workflows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                          No automation workflows configured.
                        </td>
                      </tr>
                    ) : (
                      workflows.map((workflow) => (
                        <tr key={workflow.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{workflow.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-500">{workflow.site?.name || 'Unknown'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-500 max-w-xs truncate">{workflow.topic}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-500">{workflow.schedule}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              workflow.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}>
                              {workflow.isActive ? "Active" : "Paused"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {activeFilter === "SCHEDULED" && (
              <div className="p-6 border-b border-gray-200 bg-gray-50/50">
                <h2 className="text-lg font-semibold text-gray-900">Scheduled Individual Posts</h2>
                <p className="text-sm text-gray-500 mt-0.5">Posts manually scheduled for publication.</p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Site
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Words
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Share
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                          {post.title}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">{post.site?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <PostStatusBadge status={post.status} scheduledAt={(post as any).scheduledAt} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-gray-500">{post.wordCount}</span>
                          {post.readabilityScore != null && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              post.readabilityScore >= 60 ? "bg-green-50 text-green-700"
                              : post.readabilityScore >= 40 ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                            }`} title={`Readability: ${post.readabilityScore}/100`}>
                              {post.readabilityScore}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        {post.status === "PUBLISHED" ? (
                          <div className="flex items-center gap-1.5">
                            {post.site?.socialAccounts?.map((account) => {
                              const share = post.socialShares?.find(
                                (s) => s.platform === account.platform
                              )
                              const isShared = share?.status === "SHARED"
                              const isPending = share?.status === "PENDING"
                              const isFailed = share?.status === "FAILED"

                              return (
                                <button
                                  key={account.platform}
                                  onClick={() => handleSocialIconClick(post, account.platform)}
                                  className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                                    isShared
                                      ? "opacity-100 hover:scale-105"
                                      : "opacity-40 hover:opacity-80"
                                  }`}
                                  style={{
                                    background: PLATFORM_CONFIG[account.platform]?.bgColor,
                                    border: isFailed ? '1px solid #ef4444' : 'none'
                                  }}
                                  title={
                                    isShared
                                      ? `Shared on ${PLATFORM_CONFIG[account.platform]?.label}. Click to view.`
                                      : isFailed
                                      ? `Share failed: ${share.error || 'Unknown error'}. Click to retry.`
                                      : isPending
                                      ? `Sharing in progress...`
                                      : `Share to ${PLATFORM_CONFIG[account.platform]?.label}`
                                  }
                                  disabled={isPending}
                                >
                                  {isPending ? (
                                    <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <i
                                      className={`ti ${PLATFORM_CONFIG[account.platform]?.icon} text-xs`}
                                      style={{ color: PLATFORM_CONFIG[account.platform]?.color }}
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                              )
                            })}
                            {!post.site?.socialAccounts?.length && (
                              <span className="text-xs text-gray-400 font-normal">No platforms</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            className="text-primary-600 hover:text-primary-900"
                            onClick={() => navigate(`/dashboard/posts/${post.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {post.status === "DRAFT" && (
                            <button 
                              className="text-green-600 hover:text-green-900 disabled:opacity-50 text-sm font-medium"
                              onClick={() => handlePublish(post.id)}
                              disabled={actionLoading === post.id}
                            >
                              {actionLoading === post.id ? '...' : 'Publish'}
                            </button>
                          )}
                          <button 
                            onClick={() => setDeleteTarget({
                              id: post.id,
                              title: post.title,
                              wpPostId: post.wpPostId,
                              siteId: post.siteId,
                            })}
                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                            title="Move to trash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredPosts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No posts found for the selected filter.</p>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-6 py-4 bg-gray-50/30 dark:bg-gray-900/10">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing <span className="font-medium text-gray-900 dark:text-gray-200">{(currentPage - 1) * postsPerPage + 1}</span> to{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-200">
                    {Math.min(currentPage * postsPerPage, filteredPosts.length)}
                  </span>{" "}
                  of <span className="font-medium text-gray-900 dark:text-gray-200">{filteredPosts.length}</span> posts
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-850 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        totalPages > 6 &&
                        page !== 1 &&
                        page !== totalPages &&
                        Math.abs(page - currentPage) > 1
                      ) {
                        if (page === 2 && currentPage > 3) {
                          return <span key="ellipsis-start" className="px-2 text-gray-400 dark:text-gray-500">...</span>
                        }
                        if (page === totalPages - 1 && currentPage < totalPages - 2) {
                          return <span key="ellipsis-end" className="px-2 text-gray-400 dark:text-gray-500">...</span>
                        }
                        return null
                      }

                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`h-8 w-8 text-sm font-medium rounded-md flex items-center justify-center transition-all ${
                            currentPage === page
                              ? "bg-primary-600 text-white shadow-sm"
                              : "border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-850 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          }`}
                        >
                          {page}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-850 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Confirmation Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: PLATFORM_CONFIG[shareModal.platform]?.bgColor }}
              >
                <i
                  className={`ti ${PLATFORM_CONFIG[shareModal.platform]?.icon} text-lg`}
                  style={{ color: PLATFORM_CONFIG[shareModal.platform]?.color }}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Share to {PLATFORM_CONFIG[shareModal.platform]?.label}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Confirm sharing this blog post.
                </p>
              </div>
            </div>

            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
              <p className="font-medium text-gray-800 line-clamp-1">{shareModal.post.title}</p>
              <p className="text-xs text-gray-400 line-clamp-3">
                {shareModal.post.title}... (will be posted with a link to the published article)
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShareModal(null)}
                className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecuteShare(shareModal.post, shareModal.platform)}
                className="flex-1 bg-purple-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-purple-700"
              >
                Share Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Share URL Modal */}
      {viewShareUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: PLATFORM_CONFIG[viewShareUrl.platform]?.bgColor }}
              >
                <i
                  className={`ti ${PLATFORM_CONFIG[viewShareUrl.platform]?.icon} text-lg`}
                  style={{ color: PLATFORM_CONFIG[viewShareUrl.platform]?.color }}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Post shared!
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Successfully shared to {PLATFORM_CONFIG[viewShareUrl.platform]?.label}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              <label className="text-xs text-gray-400 font-medium">Share Link:</label>
              <input
                type="text"
                readOnly
                value={viewShareUrl.url}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 text-gray-600 focus:outline-none"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <span className="text-[10px] text-gray-400">Click to select all and copy</span>
            </div>

            <div className="flex gap-3">
              <a
                href={viewShareUrl.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-purple-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-purple-700 text-center flex items-center justify-center"
              >
                Go to post
              </a>
              <button
                onClick={() => setViewShareUrl(null)}
                className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
