import { useState, useEffect, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { Upload, FileText, ArrowLeft, RefreshCw, Calendar, Clock, X, ChevronDown, ChevronUp } from "lucide-react"
import { BASE_URL, fetchSites } from "@/lib/api"
import RichTextEditor from "@/components/editor/RichTextEditor"
import { calculateReadabilityClient, calculateKeywordDensityClient } from "@/lib/seo"

export default function EditPost() {
  const params = useParams()
  const [postTitle, setPostTitle] = useState("")        // replaces topic
  const [keywords, setKeywords] = useState("")
  const [tone, setTone] = useState("Professional")
  const [wordCount, setWordCount] = useState(1000)
  const [language, setLanguage] = useState("English")
  const [selectedSite, setSelectedSite] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [existingImageUrl, setExistingImageUrl] = useState("")
  const [postStatus, setPostStatus] = useState("DRAFT")
  const [previewContent, setPreviewContent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [sites, setSites] = useState([])
  const [toast, setToast] = useState<{msg:string, type:"success"|"error"} | null>(null)
  const [scheduledAt, setScheduledAt] = useState<string | null>(null)
  const [showSchedulePicker, setShowSchedulePicker] = useState(false)
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("09:00")
  const scheduleRef = useRef<HTMLDivElement>(null)
  
  function showToast(msg: string, type: "success"|"error" = "success") {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }
  
  const [categories, setCategories] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [categoryInput, setCategoryInput] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [wpCategories, setWpCategories] = useState<{id:number, name:string}[]>([])

  // SEO states
  const [seoData, setSeoData] = useState<{
    metaDescription: string
    seoTitle: string
    slug: string
    focusKeyword: string
    schemaMarkup: string
  } | null>(null)
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false)
  const [readability, setReadability] = useState<{
    score: number
    label: string
    color: string
    suggestions: string[]
  } | null>(null)
  const [keywordDensity, setKeywordDensity] = useState<{
    count: number
    density: number
    status: string
  } | null>(null)
  const [focusKeyword, setFocusKeyword] = useState("")
  const [seoExpanded, setSeoExpanded] = useState(true)

  async function handleGenerateMetadata() {
    if (!postTitle.trim()) return
    setIsGeneratingMetadata(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${BASE_URL}/api/posts/generate-metadata`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ title: postTitle }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        const { keywords: kw, categories: cat, tags: tg } = data.data
        if (kw && kw.length) setKeywords(kw.join(", "))
        if (cat && cat.length) setCategories(prev => [...new Set([...prev, ...cat])])
        if (tg && tg.length) setTags(prev => [...new Set([...prev, ...tg])])
        showToast("Metadata generated successfully!")
      } else {
        showToast("Failed to generate metadata", "error")
      }
    } catch (err) {
      console.error("Failed to generate metadata:", err)
      showToast("Error generating metadata", "error")
    } finally {
      setIsGeneratingMetadata(false)
    }
  }

  useEffect(() => {
    const loadSitesAndPost = async () => {
      try {
        const sitesData = await fetchSites()
        if (sitesData.success) setSites(sitesData.data)
        
        const postId = params.id
        if (!postId) return
        
        const token = localStorage.getItem('auth_token')
        const postRes = await fetch(`${BASE_URL}/api/posts/${postId}`, {
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        })
        
        // Let's get the post from the standard GET /api/posts list since there isn't a get by id endpoint defined in the prompt.
        // Wait, the prompt says: fetch(`http://localhost:3001/api/posts/${postId}`).
        // So I will assume the endpoint exists or will just use it. (I should check posts.ts later if it exists, or just use the GET /api/posts and filter).
        // The prompt says: "fetch(`http://localhost:3001/api/posts/${postId}`).then(r => r.json()).then(data => {..."
        const data = await postRes.json()
        if (data.success) {
          const p = data.data
          setPostTitle(p.title)
          setKeywords(p.keywords?.join(", ") || "")
          setCategories(p.categories || [])
          setTags(p.tags || [])
          setTone(p.tone || "Professional")
          setWordCount(p.wordCount || 1000)
          setPreviewContent(p.content)
          setSelectedSite(p.siteId)
          setExistingImageUrl(p.featuredImageUrl || "")
          setPostStatus(p.status)
          if (p.scheduledAt) {
            setScheduledAt(p.scheduledAt)
            const dateObj = new Date(p.scheduledAt)
            const yyyy = dateObj.getFullYear()
            const mm = String(dateObj.getMonth() + 1).padStart(2, "0")
            const dd = String(dateObj.getDate()).padStart(2, "0")
            setScheduleDate(`${yyyy}-${mm}-${dd}`)
            const hh = String(dateObj.getHours()).padStart(2, "0")
            const min = String(dateObj.getMinutes()).padStart(2, "0")
            setScheduleTime(`${hh}:${min}`)
          }
          // Pre-fill SEO data if available
          if (p.metaDescription || p.seoTitle || p.slug || p.focusKeyword || p.schemaMarkup) {
            setSeoData({
              metaDescription: p.metaDescription || "",
              seoTitle: p.seoTitle || "",
              slug: p.slug || "",
              focusKeyword: p.focusKeyword || "",
              schemaMarkup: p.schemaMarkup || "",
            })
            setFocusKeyword(p.focusKeyword || "")
            setSeoExpanded(true)
          }
        }
      } catch (error) {
        console.error("Failed to load data:", error)
      }
    }
    loadSitesAndPost()
  }, [params.id])

  // Close schedule picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (scheduleRef.current && !scheduleRef.current.contains(e.target as Node)) {
        setShowSchedulePicker(false)
      }
    }
    if (showSchedulePicker) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showSchedulePicker])

  useEffect(() => {
    if (!selectedSite) return;
    const token = localStorage.getItem('auth_token');
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/sites/${selectedSite}/categories`, {
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        });
        const data = await res.json();
        if (data.success) {
          setWpCategories(data.data);
        } else {
          throw new Error(data.error || 'Failed to fetch categories');
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
        setWpCategories([]);
        showToast('Error fetching categories: ' + (err as Error).message, 'error');
      }
    };
    fetchCategories();
  }, [selectedSite]);

  // Auto-calculate readability and keyword density when content changes
  useEffect(() => {
    if (!previewContent || previewContent === "<p></p>") return
    const r = calculateReadabilityClient(previewContent)
    setReadability(r)
    if (focusKeyword) {
      const d = calculateKeywordDensityClient(previewContent, focusKeyword)
      setKeywordDensity(d)
    }
  }, [previewContent, focusKeyword])

  async function generateSEO(content: string) {
    if (!postTitle.trim() || !content) return
    setIsGeneratingSEO(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(
        `${BASE_URL}/api/posts/generate-seo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            postTitle,
            content,
            keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
            tone,
          })
        }
      )
      const data = await res.json()
      if (data.success) {
        setSeoData(data.data)
        setFocusKeyword(data.data.focusKeyword)
        setSeoExpanded(true)
      }
    } finally {
      setIsGeneratingSEO(false)
    }
  }

  function handleImageSelect(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB")
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleGenerate() {
    if (!postTitle.trim() || !selectedSite) return
    setIsGenerating(true)
    setPreviewContent("")

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${BASE_URL}/api/posts/generate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          topic: postTitle,      // postTitle IS the topic
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
          tone,
          wordCount,
          language,
          siteId: selectedSite,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      if (!response.body) throw new Error("No response body")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        
        // Parse SSE format if necessary, or just handle plain chunks if the backend sends them
        // The backend sends: data: {"content": "..."}
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            if (dataStr === '[DONE]') continue
            try {
              const data = JSON.parse(dataStr)
              if (data.content) {
                setPreviewContent((prev) => prev + data.content)
              }
            } catch (e) {
              // fallback
            }
          }
        }
      }
    } catch (err: any) {
      alert(err.message || "Generation failed. Check your Groq API key.");
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleUpdate(action: "draft" | "publish" | "schedule" | "unschedule") {
    if (action === "publish") {
      setIsPublishing(true)
    } else {
      setIsSaving(true)
    }
    try {
      const formData = new FormData()
      formData.append("title", postTitle)
      formData.append("content", previewContent)
      formData.append("keywords", JSON.stringify(
        keywords.split(",").map(k => k.trim()).filter(Boolean)
      ))
      formData.append("categories", JSON.stringify(categories))
      formData.append("tags", JSON.stringify(tags))
      formData.append("tone", tone)
      formData.append("wordCount", String(wordCount))
      // SEO fields
      if (seoData) {
        formData.append("metaDescription", seoData.metaDescription || "")
        formData.append("seoTitle", seoData.seoTitle || "")
        formData.append("focusKeyword", focusKeyword || seoData.focusKeyword || "")
        formData.append("schemaMarkup", seoData.schemaMarkup || "")
        formData.append("slug", seoData.slug || "")
      }
      if (readability) {
        formData.append("readabilityScore", String(readability.score))
      }

      if (imageFile) {
        formData.append("featuredImage", imageFile)
      }

      let scheduledAtISO: string | null = null
      if (action === "schedule") {
        if (!scheduleDate || !scheduleTime) {
          throw new Error("Please select a date and time for scheduling.")
        }
        scheduledAtISO = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
        formData.append("status", "SCHEDULED")
        formData.append("scheduledAt", scheduledAtISO)
      } else if (action === "unschedule") {
        formData.append("status", "DRAFT")
        formData.append("scheduledAt", "null")
      }

      const token = localStorage.getItem('auth_token')
      const res = await fetch(
        `${BASE_URL}/api/posts/${params.id}`,
        { 
          method: "PUT", 
          body: formData,
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        }
      )
      const data = await res.json()

      if (data.success) {
        if (action === "publish") {
          // If we also want to publish, we should call the publish endpoint
          const publishRes = await fetch(
            `${BASE_URL}/api/posts/${params.id}/publish`,
            { 
              method: "POST", 
              headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
            }
          )
          const publishData = await publishRes.json()
          if (!publishData.success) throw new Error(publishData.error)
          setPostStatus("PUBLISHING")
          showToast("Post queued for publishing!")
        } else if (action === "schedule") {
          setPostStatus("SCHEDULED")
          setScheduledAt(scheduledAtISO)
          setShowSchedulePicker(false)
          showToast("Post scheduled successfully!")
        } else if (action === "unschedule") {
          setPostStatus("DRAFT")
          setScheduledAt(null)
          showToast("Post schedule cancelled!")
        } else {
          showToast("Post updated successfully!")
        }
      } else {
        showToast("Update failed: " + data.error, "error")
      }
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error")
    } finally {
      setIsSaving(false)
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex h-full bg-white overflow-hidden relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg
                         text-sm font-medium text-white transition-all
                         ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}



      {/* LEFT PANEL */}
      <div className="flex flex-col gap-4 p-6 bg-white border-r border-gray-100 overflow-y-auto" style={{ width: "400px", minWidth: "400px" }}>
        
        <Link to="/dashboard/posts" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Posts
        </Link>
        
        <h2 className="text-lg font-medium text-gray-900">Edit post</h2>

        {/* If scheduled, show schedule information */}
        {postStatus === "SCHEDULED" && scheduledAt && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <span className="font-semibold block">Scheduled Publication</span>
              {new Date(scheduledAt).toLocaleString()}
            </div>
            <button
              onClick={() => handleUpdate("unschedule")}
              disabled={isSaving}
              className="text-[10px] bg-white border border-amber-300 text-amber-800 font-medium px-2 py-1 rounded hover:bg-amber-100 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Site selector */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Site
          </label>
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Select a site...</option>
            {sites.map((site: any) => (
              <option key={site.id} value={site.id}>
                {site.name} — {site.url}
              </option>
            ))}
          </select>
        </div>

        {/* Post Title */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Post title
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              placeholder="e.g. How to grow a startup in 2025"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleGenerateMetadata}
              disabled={isGeneratingMetadata || !postTitle.trim()}
              className="whitespace-nowrap px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isGeneratingMetadata ? "Generating..." : "Generate with AI"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            This will be the post title on WordPress and the AI writing topic.
          </p>
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Keywords
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. startup, funding, growth hacking"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Comma-separated SEO keywords to include.
          </p>
        </div>

        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Categories
          </label>

          {/* Selected categories as removable pills */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {categories.map(cat => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 
                             text-purple-700 rounded-full text-xs font-medium"
                >
                  {cat}
                  <button
                    onClick={() => setCategories(prev => prev.filter(c => c !== cat))}
                    className="hover:text-purple-900 font-bold"
                  >×</button>
                </span>
              ))}
            </div>
          )}

          {/* Dropdown showing WP categories + type to add custom */}
          <div className="relative">
            <input
              type="text"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && categoryInput.trim()) {
                  if (!categories.includes(categoryInput.trim())) {
                    setCategories(prev => [...prev, categoryInput.trim()])
                  }
                  setCategoryInput("")
                }
              }}
              placeholder="Type category or select below..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {/* WordPress category suggestions */}
            {wpCategories.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {wpCategories
                  .filter(c => !categories.includes(c.name))
                  .map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategories(prev => [...prev, cat.name])}
                      className="px-2 py-0.5 border border-gray-200 rounded-full text-xs
                                 text-gray-600 hover:bg-purple-50 hover:border-purple-300
                                 hover:text-purple-700 transition-colors"
                    >
                      + {cat.name}
                    </button>
                  ))
                }
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Press Enter to add a custom category or click existing ones above.
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Tags
          </label>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 
                             text-gray-600 rounded-full text-xs font-medium"
                >
                  #{tag}
                  <button
                    onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                    className="hover:text-gray-900 font-bold"
                  >×</button>
                </span>
              ))}
            </div>
          )}

          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                e.preventDefault()
                const newTag = tagInput.trim().replace(/^#/, "")
                if (!tags.includes(newTag)) {
                  setTags(prev => [...prev, newTag])
                }
                setTagInput("")
              }
            }}
            placeholder="Type a tag and press Enter or comma..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Press Enter or comma to add each tag.
          </p>
        </div>

        {/* Tone */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option>Professional</option>
            <option>Casual</option>
            <option>Technical</option>
            <option>Friendly</option>
          </select>
        </div>

        {/* Word count slider */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Word count — <span className="text-purple-600 font-semibold">
              {wordCount} words
            </span>
          </label>
          <input
            type="range"
            min={500}
            max={3000}
            step={100}
            value={wordCount}
            onChange={(e) => setWordCount(Number(e.target.value))}
            className="w-full accent-purple-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>500 short</span>
            <span>1500 ideal</span>
            <span>3000 long</span>
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option>English</option>
            <option>Spanish</option>
            <option>French</option>
            <option>German</option>
            <option>Arabic</option>
          </select>
        </div>

        {/* Featured image upload */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Featured image <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div
            onClick={() => document.getElementById("image-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleImageSelect(file)
            }}
            className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all"
          >
            {(imagePreview || existingImageUrl) ? (
              <div className="relative">
                <img
                  src={imagePreview || existingImageUrl}
                  alt="Preview"
                  className="w-full h-36 object-cover rounded-lg"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setImageFile(null)
                    setImagePreview("")
                    setExistingImageUrl("")
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs hover:bg-red-600 flex items-center justify-center"
                >
                  x
                </button>
                {imageFile && (
                  <p className="text-xs text-gray-400 mt-2 truncate">
                    {imageFile.name}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-3">
                <Upload className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  JPEG, PNG, WebP — max 5MB
                </p>
              </div>
            )}
          </div>
          <input
            id="image-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageSelect(file)
            }}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!postTitle.trim() || !selectedSite || isGenerating}
          className="w-full bg-purple-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
              </svg>
              Generating with AI...
            </span>
          ) : (
            "Regenerate content"
          )}
        </button>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
        {/* Regenerate header */}
        <div className="flex items-center justify-between px-4 py-2 
                        border-b border-gray-100 bg-white flex-shrink-0">
          <span className="text-xs text-gray-500">
            Edit content directly or regenerate with AI
          </span>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !postTitle.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                       text-purple-600 border border-purple-200 rounded-lg
                       hover:bg-purple-50 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
        </div>

        {/* Streaming indicator */}
        {isGenerating && (
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 
                          border-b border-purple-100 flex-shrink-0">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" 
                    style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" 
                    style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" 
                    style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs text-purple-600 font-medium">
              AI is writing your post...
            </span>
          </div>
        )}

        {/* Editor takes all remaining space */}
        <div className="flex-1 overflow-hidden p-4">
          {!previewContent && !isGenerating ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-300 border-2 border-dashed border-gray-100 bg-white rounded-xl">
              <FileText className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium">Your post will appear here</p>
              <p className="text-xs mt-1">
                Fill in the title and keywords, then click Generate
              </p>
            </div>
          ) : (
            <RichTextEditor
              content={previewContent}
              onChange={(html) => setPreviewContent(html)}
              editable={!isGenerating}
              placeholder="Your post content will load here..."
            />
          )}
        </div>

        {/* SEO Panel in Edit Mode */}
        <div className="border-t border-gray-100 bg-white flex-shrink-0">
          <button
            onClick={() => setSeoExpanded(!seoExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-medium text-gray-800">SEO</span>
              {isGeneratingSEO && (
                <svg className="animate-spin w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/>
                </svg>
              )}
              {!isGeneratingSEO && seoData && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  Ready
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {readability && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  readability.color === "green" ? "bg-green-50 text-green-700"
                  : readability.color === "blue" ? "bg-blue-50 text-blue-700"
                  : readability.color === "amber" ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
                }`}>
                  {readability.label} · {readability.score}
                </span>
              )}
              {seoExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {seoExpanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
              {seoData ? (
                <>
                  {/* Meta description */}
                  <div className="pt-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-600">Meta description</label>
                      <span className={`text-xs ${
                        seoData.metaDescription.length > 155 ? "text-red-500"
                        : seoData.metaDescription.length > 140 ? "text-green-600"
                        : "text-gray-400"
                      }`}>{seoData.metaDescription.length}/155</span>
                    </div>
                    <textarea
                      value={seoData.metaDescription}
                      onChange={(e) => setSeoData(prev => prev ? { ...prev, metaDescription: e.target.value } : null)}
                      rows={2}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
                    />
                  </div>

                  {/* SEO title */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-600">SEO title</label>
                      <span className={`text-xs ${
                        seoData.seoTitle.length > 60 ? "text-red-500"
                        : seoData.seoTitle.length > 50 ? "text-green-600"
                        : "text-gray-400"
                      }`}>{seoData.seoTitle.length}/60</span>
                    </div>
                    <input
                      type="text"
                      value={seoData.seoTitle}
                      onChange={(e) => setSeoData(prev => prev ? { ...prev, seoTitle: e.target.value } : null)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                    <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs text-gray-400 mb-1">Google preview</p>
                      <p className="text-sm text-blue-700 font-medium leading-tight">{seoData.seoTitle || postTitle}</p>
                      <p className="text-xs text-green-700 mt-0.5">yourdomain.com/{seoData.slug}</p>
                      <p className="text-xs text-gray-600 mt-0.5 leading-tight">
                        {seoData.metaDescription.substring(0, 120)}{seoData.metaDescription.length > 120 ? "..." : ""}
                      </p>
                    </div>
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">URL slug</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">yourdomain.com/</span>
                      <input
                        type="text"
                        value={seoData.slug}
                        onChange={(e) => setSeoData(prev => prev ? {
                          ...prev,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-")
                        } : null)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 font-mono"
                      />
                    </div>
                  </div>

                  {/* Focus keyword + density */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Focus keyword</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={focusKeyword}
                        onChange={(e) => setFocusKeyword(e.target.value)}
                        placeholder="Primary keyword phrase..."
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      />
                      {keywordDensity && (
                        <span className={`text-xs px-2 py-1.5 rounded-lg font-medium flex-shrink-0 ${
                          keywordDensity.status === "good" ? "bg-green-50 text-green-700"
                          : keywordDensity.status === "high" ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                        }`}>
                          {keywordDensity.density}% · {keywordDensity.count}x
                        </span>
                      )}
                    </div>
                    {keywordDensity && (
                      <p className="text-xs text-gray-400 mt-1">
                        {keywordDensity.status === "good" ? "Keyword density is optimal"
                        : keywordDensity.status === "high" ? "Keyword used too often — reduce for natural flow"
                        : "Keyword used too rarely — include it more naturally"}
                      </p>
                    )}
                  </div>

                  {/* Readability */}
                  {readability && (
                    <div className={`rounded-lg p-3 ${
                      readability.color === "green" ? "bg-green-50 border border-green-100"
                      : readability.color === "blue" ? "bg-blue-50 border border-blue-100"
                      : readability.color === "amber" ? "bg-amber-50 border border-amber-100"
                      : "bg-red-50 border border-red-100"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-700">Readability</span>
                        <span className={`text-xs font-medium ${
                          readability.color === "green" ? "text-green-700"
                          : readability.color === "blue" ? "text-blue-700"
                          : readability.color === "amber" ? "text-amber-700"
                          : "text-red-700"
                        }`}>{readability.label} · {readability.score}/100</span>
                      </div>
                      <div className="w-full bg-white bg-opacity-60 rounded-full h-1.5 mb-2">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            readability.color === "green" ? "bg-green-500"
                            : readability.color === "blue" ? "bg-blue-500"
                            : readability.color === "amber" ? "bg-amber-500"
                            : "bg-red-500"
                          }`}
                          style={{ width: `${readability.score}%` }}
                        />
                      </div>
                      {readability.suggestions.map((s, i) => (
                        <p key={i} className="text-xs text-gray-600 flex items-start gap-1">
                          <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          {s}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="pt-3">
                  <p className="text-xs text-gray-400 mb-2">No SEO data yet. Generate SEO data for this post.</p>
                </div>
              )}

              {/* Regenerate SEO button */}
              <button
                onClick={() => generateSEO(previewContent)}
                disabled={isGeneratingSEO || !previewContent}
                className="w-full text-xs text-purple-600 border border-purple-200 rounded-lg py-1.5 hover:bg-purple-50 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 ${isGeneratingSEO ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {isGeneratingSEO ? "Generating SEO..." : seoData ? "Regenerate SEO data" : "Generate SEO data"}
              </button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {previewContent && (
          <div className="border-t border-gray-100 p-4 bg-white flex-shrink-0">
            {/* Schedule picker popover */}
            {showSchedulePicker && (
              <div
                ref={scheduleRef}
                className="mb-3 p-4 bg-white border border-purple-200 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-950 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    Schedule post
                  </h4>
                  <button
                    onClick={() => setShowSchedulePicker(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {scheduleDate && (
                  <p className="text-xs text-gray-500 mb-3">
                    Will be scheduled for{" "}
                    <span className="font-medium text-purple-600">
                      {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString(undefined, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                )}

                <button
                  onClick={() => handleUpdate("schedule")}
                  disabled={isSaving || !scheduleDate}
                  className="w-full bg-purple-600 text-white rounded-lg py-2 text-sm font-medium
                             hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors flex items-center justify-center gap-2"
                >
                  {postStatus === "SCHEDULED" ? "Update Schedule" : "Confirm Schedule"}
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleUpdate("draft")}
                disabled={isSaving}
                className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                {isSaving ? "Saving..." : "Update Draft"}
              </button>
              <button
                onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  showSchedulePicker || postStatus === "SCHEDULED"
                    ? "bg-purple-50 border-purple-300 text-purple-700"
                    : "border-purple-200 text-purple-600 hover:bg-purple-50"
                }`}
              >
                <Clock className="w-4 h-4" />
                {postStatus === "SCHEDULED" ? "Reschedule" : "Schedule"}
              </button>
              <button
                onClick={() => handleUpdate("publish")}
                disabled={isPublishing || postStatus === "PUBLISHING"}
                className="flex-1 bg-purple-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                {isPublishing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                    </svg>
                    Publishing...
                  </span>
                ) : postStatus === "PUBLISHED" ? (
                  "Update & Publish"
                ) : (
                  "Publish"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}