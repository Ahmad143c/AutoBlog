import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Upload, FileText, Check, ChevronDown, ChevronUp, Brain, Loader2, Calendar, Clock, X } from "lucide-react"
import { api, BASE_URL, fetchSites } from "@/lib/api"
import RichTextEditor from "@/components/editor/RichTextEditor"
import { calculateReadabilityClient, calculateKeywordDensityClient, slugifyClient } from "@/lib/seo"

export default function NewPost() {
  const [postTitle, setPostTitle] = useState("")        // replaces topic
  const [keywords, setKeywords] = useState("")
  const [tone, setTone] = useState("Professional")
  const [wordCount, setWordCount] = useState(1000)
  const [language, setLanguage] = useState("English")
  const [selectedSite, setSelectedSite] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [previewContent, setPreviewContent] = useState("")
  const [generateError, setGenerateError] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [sites, setSites] = useState([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [successAction, setSuccessAction] = useState<"draft" | "publish" | "schedule">("draft")
  const [showSchedulePicker, setShowSchedulePicker] = useState(false)
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("09:00")
  const scheduleRef = useRef<HTMLDivElement>(null)

  const [categories, setCategories] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [categoryInput, setCategoryInput] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [wpCategories, setWpCategories] = useState<{ id: number, name: string }[]>([])
  const [postDescription, setPostDescription] = useState("")
  const [isDescGenerating, setIsDescGenerating] = useState(false)
  const [descOpen, setDescOpen] = useState(false)

  // SEO states
  const [seoData, setSeoData] = useState<{
    keywords: {
      seedWord: string
      shortTail: string
      longTail: string
    }
    selectedKeyword: string
    selectedKeywordType: "seed" | "short" | "long"
    metaDescription: string
    seoTitle: string
    slug: string
    schemaMarkup: string
  } | null>(null)
  const [keywordSet, setKeywordSet] = useState<{
    seedWord: string
    shortTail: string
    longTail: string
  } | null>(null)
  const [activeKeywordType, setActiveKeywordType] = useState<
    "seed" | "short" | "long" | "custom"
  >("long")
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false)
  const [readability, setReadability] = useState<{
    score: number
    label: string
    color: "green" | "blue" | "amber" | "red"
    wordCount: number
    sentenceCount: number
    avgWordsPerSentence: number
    longSentences: number
    complexWords: number
    suggestions: string[]
    grade: string
  } | null>(null)
  const [keywordDensity, setKeywordDensity] = useState<{
    count: number
    density: number
    status: "low" | "good" | "high"
  } | null>(null)
  const [focusKeyword, setFocusKeyword] = useState("")
  const [seoExpanded, setSeoExpanded] = useState(false)

  const navigate = useNavigate()

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
        body: JSON.stringify({ title: postTitle, language, tone }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        const { keywords: kw, categories: cat, tags: tg } = data.data
        if (kw && kw.length) setKeywords(kw.join(", "))
        if (cat && cat.length) setCategories(prev => [...new Set([...prev, ...cat])])
        if (tg && tg.length) setTags(prev => [...new Set([...prev, ...tg])])
      }
    } catch (err) {
      console.error("Failed to generate metadata:", err)
    } finally {
      setIsGeneratingMetadata(false)
    }
  }

  async function handleGenerateDescription() {
    try {
      setIsDescGenerating(true)
      const res = await api.post('/api/workflows/generate-description', {
        title: postTitle,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        categories: categories.join(", "),
        tags: tags.join(", "),
        wordCount,
        tone,
        language,
        descriptionFormat: "postDescription",
      })
      if (res.data?.success) {
        setPostDescription(res.data.data.description)
      }
    } catch (e) {
      console.error("Failed to generate description:", e)
    } finally {
      setIsDescGenerating(false)
    }
  }

  // Load sites on mount
  useEffect(() => {
    const loadSites = async () => {
      try {
        const data = await fetchSites()
        if (data.success) setSites(data.data)
      } catch (error) {
        console.error("Failed to load sites:", error)
      }
    }
    loadSites()
  }, [])

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
    if (!selectedSite) return
    const token = localStorage.getItem('auth_token')
    fetch(`${BASE_URL}/api/sites/${selectedSite}/categories`, {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setWpCategories(data.data)
      })
  }, [selectedSite])

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
    setGenerateError("")

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

      let fullContent = ""
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
              if (data.error) {
                setGenerateError(data.error)
                setPreviewContent("")
                continue
              }
              if (data.content) {
                fullContent += data.content
                setPreviewContent((prev) => prev + data.content)
              }
            } catch (e) {
              // fallback
            }
          }
        }
      }
      // Auto-generate SEO after streaming completes
      if (fullContent) {
        generateSEO(fullContent)
      }
    } catch (err: any) {
      setGenerateError(err.message || "Generation failed. Check your Groq API key.")
      alert(err.message || "Generation failed. Check your Groq API key.");
    } finally {
      setIsGenerating(false)
    }
  }

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
        setKeywordSet(data.data.keywords)
        setActiveKeywordType("long")
        setFocusKeyword(data.data.keywords.longTail)
        setSeoExpanded(true)
      }
    } finally {
      setIsGeneratingSEO(false)
    }
  }

  async function handleSave(action: "draft" | "publish" | "schedule") {
    if (action === "draft") setIsSaving(true)
    else if (action === "publish") setIsPublishing(true)
    else setIsScheduling(true)

    try {
      // Build scheduledAt ISO string if scheduling
      let scheduledAt: string | undefined
      if (action === "schedule") {
        if (!scheduleDate || !scheduleTime) {
          throw new Error("Please select a date and time for scheduling.")
        }
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
      }

      // Step 1: Save post to DB
      const { data: saveData } = await api.post("/api/posts", {
        title: postTitle,
        content: previewContent,
        description: postDescription,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        categories,
        tags,
        tone,
        wordCount,
        siteId: selectedSite,
        status: "DRAFT",
        slug: seoData?.slug || slugifyClient(postTitle),
        // SEO fields
        metaDescription: seoData?.metaDescription || null,
        seoTitle: seoData?.seoTitle || null,
        focusKeyword: focusKeyword || null,
        schemaMarkup: seoData?.schemaMarkup || null,
        readabilityScore: readability?.score || null,
        ...(scheduledAt ? { scheduledAt } : {}),
      })

      if (!saveData.success) throw new Error(saveData.error)

      const postId = saveData.data.id

      // Step 2: If publish, send image + publish to WordPress
      if (action === "publish") {
        const formData = new FormData()
        if (imageFile) {
          formData.append("featuredImage", imageFile)
        }
        formData.append("metaDescription", seoData?.metaDescription || "")
        formData.append("seoTitle", seoData?.seoTitle || "")
        formData.append("focusKeyword", focusKeyword || "")
        formData.append("schemaMarkup", seoData?.schemaMarkup || "")
        formData.append("readabilityScore", String(readability?.score || 0))
        formData.append("slug", seoData?.slug || slugifyClient(postTitle))

        const token = localStorage.getItem('auth_token')
        const publishRes = await fetch(
          `${BASE_URL}/api/posts/${postId}/publish-with-image`,
          {
            method: "POST",
            headers: {
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: formData
          }
        )

        const publishData = await publishRes.json()
        if (!publishData.success) throw new Error(publishData.error)
      }

      // Step 2b: If schedule, send schedule metadata and optional image for later publishing
      if (action === "schedule" && scheduledAt) {
        const formData = new FormData()
        formData.append("scheduledAt", scheduledAt)
        if (imageFile) {
          formData.append("featuredImage", imageFile)
        }

        const token = localStorage.getItem('auth_token')
        const scheduleRes = await fetch(
          `${BASE_URL}/api/posts/${postId}/schedule`,
          {
            method: "POST",
            headers: {
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: formData,
          }
        )

        const scheduleData = await scheduleRes.json()
        if (!scheduleData.success) throw new Error(scheduleData.error)
      }

      // Step 3: Show success overlay and wait 5 seconds then redirect
      setShowSuccess(true)
      setSuccessAction(action)
      setShowSchedulePicker(false)
      await new Promise((resolve) => setTimeout(resolve, 5000))
      navigate("/dashboard/posts")

    } catch (err: any) {
      alert(err.message || "Something went wrong")
      setIsSaving(false)
      setIsPublishing(false)
      setIsScheduling(false)
    }
  }

  return (
    <div className="flex h-full bg-white overflow-hidden relative">
      {/* Success Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center z-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {successAction === "publish"
                ? "Post published!"
                : successAction === "schedule"
                  ? "Post scheduled!"
                  : "Draft saved!"}
            </h3>
            <p className="text-sm text-gray-500">
              {successAction === "schedule" && scheduleDate
                ? `Scheduled for ${new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}. Redirecting...`
                : "Redirecting to posts in 5 seconds..."}
            </p>
            <div className="w-48 h-1 bg-gray-100 rounded-full mt-4 mx-auto overflow-hidden">
              <div
                className="h-full bg-purple-600 rounded-full"
                style={{
                  width: "100%",
                  animation: "shrink 5s linear forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* LEFT PANEL */}
      <div className="flex flex-col gap-4 p-6 bg-white border-r border-gray-100 overflow-y-auto" style={{ width: "400px", minWidth: "400px" }}>
        <h2 className="text-lg font-medium text-gray-900">Create new post</h2>

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

        {/* Post Description / Excerpt */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => {
                const willOpen = !descOpen
                setDescOpen(willOpen)
                // If opening and no description yet, generate one
                if (willOpen && !postDescription) {
                  handleGenerateDescription()
                }
              }}
              className="flex items-center text-sm text-purple-600 hover:underline"
            >
              {descOpen ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
              {descOpen ? "Hide" : "Show"} post description
            </button>
          </div>
          {descOpen && (
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-2 mb-2">
                <button
                  onClick={handleGenerateDescription}
                  disabled={isDescGenerating}
                  className="inline-flex items-center text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-1.5 px-3 rounded"
                >
                  {isDescGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Brain className="w-3 h-3 mr-1" />}
                  Generate Again
                </button>
              </div>
              {isDescGenerating ? (
                <div className="text-sm text-gray-500">Generating description...</div>
              ) : (
                <div className="h-48">
                  <RichTextEditor
                    content={postDescription || ""}
                    onChange={(html) => setPostDescription(html)}
                    placeholder="Generated meta description, blog intro, and social caption"
                  />
                </div>
              )}
            </div>
          )}
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
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-36 object-cover rounded-lg"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setImageFile(null)
                    setImagePreview("")
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs hover:bg-red-600 flex items-center justify-center"
                >
                  x
                </button>
                <p className="text-xs text-gray-400 mt-2 truncate">
                  {imageFile?.name}
                </p>
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
            "Generate post"
          )}
        </button>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
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
          {generateError ? (
            <div className="h-full flex items-start justify-center pt-12">
              <div className="max-w-xl w-full flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
                <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700">Generation failed</p>
                  <p className="text-xs text-red-600 mt-1">{generateError}</p>
                  <a
                    href="/dashboard/settings"
                    className="text-xs text-purple-600 underline mt-2 inline-block"
                  >
                    Update your Groq API key in Settings
                  </a>
                </div>
              </div>
            </div>
          ) : !previewContent && !isGenerating ? (
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
              placeholder="Your generated post will appear here. Fill in the title and click Generate."
            />
          )}
        </div>

        {/* SEO Panel — shown after content generation or if generating SEO */}
        {(seoData || isGeneratingSEO) && (
          <div className="border-t border-gray-100 bg-white flex-shrink-0">

            {/* SEO Panel header — click to expand/collapse */}
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
                    Generated
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
                {seoExpanded
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Expanded SEO panel */}
            {seoExpanded && seoData && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-50 max-h-[42vh] overflow-y-auto overscroll-contain">

                {/* Meta description */}
                <div className="pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">
                      Meta description
                    </label>
                    <div className="flex items-center gap-1.5">
                      {/* Strict range indicator */}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        seoData.metaDescription.length >= 130 &&
                        seoData.metaDescription.length <= 142
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}>
                        {seoData.metaDescription.length >= 130 &&
                         seoData.metaDescription.length <= 142
                          ? "✓ Optimal"
                          : seoData.metaDescription.length < 130
                          ? `Too short — need ${130 - seoData.metaDescription.length} more`
                          : `Too long — remove ${seoData.metaDescription.length - 142}`
                        }
                      </span>
                      <span className="text-xs text-gray-400">
                        {seoData.metaDescription.length}/142
                      </span>
                    </div>
                  </div>
                  <textarea
                    value={seoData.metaDescription}
                    onChange={(e) => {
                      // Enforce max 142 characters
                      const val = e.target.value.substring(0, 142)
                      setSeoData(prev => prev ? { ...prev, metaDescription: val } : null)
                    }}
                    rows={3}
                    maxLength={142}
                    className={`w-full text-xs border rounded-lg px-3 py-2 
                                focus:outline-none focus:ring-1 resize-none ${
                      seoData.metaDescription.length >= 130 &&
                      seoData.metaDescription.length <= 142
                        ? "border-green-300 focus:ring-green-400"
                        : "border-red-200 focus:ring-red-400"
                    }`}
                  />
                  {/* Character range visual bar */}
                  <div className="mt-1 w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                    <div
                      className={`h-1 rounded-full transition-all ${
                        seoData.metaDescription.length >= 130 &&
                        seoData.metaDescription.length <= 142
                          ? "bg-green-500"
                          : seoData.metaDescription.length > 142
                          ? "bg-red-500"
                          : "bg-amber-400"
                      }`}
                      style={{
                        width: `${Math.min(
                          (seoData.metaDescription.length / 142) * 100, 100
                        )}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5 px-1">
                    <span>0</span>
                    <span className="text-amber-500">130</span>
                    <span className="text-green-500">142</span>
                  </div>
                </div>

                {/* SEO title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">SEO title</label>
                    <span className={`text-xs ${
                      seoData.seoTitle.length > 60 ? "text-red-500"
                      : seoData.seoTitle.length > 50 ? "text-green-600"
                      : "text-gray-400"
                    }`}>
                      {seoData.seoTitle.length}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    value={seoData.seoTitle}
                    onChange={(e) => setSeoData(prev => prev ? { ...prev, seoTitle: e.target.value } : null)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                  />
                  {/* Google preview */}
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
                {keywordSet && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">
                      Focus keyword
                    </label>

                    {/* Three keyword type cards */}
                    <div className="space-y-2">

                      {/* Seed word */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveKeywordType("seed")
                          setFocusKeyword(keywordSet.seedWord)
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                          activeKeywordType === "seed"
                            ? "border-purple-300 bg-purple-50"
                            : "border-gray-100 hover:border-gray-200 bg-white"
                        }`}
                      >
                        <div className={`w-16 text-center py-0.5 rounded-lg text-[10px] uppercase font-bold flex-shrink-0 ${
                          activeKeywordType === "seed"
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          Seed
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">
                            {keywordSet.seedWord}
                          </p>
                          <p className="text-[10px] text-gray-400 leading-tight">
                            Single word — high volume, hardest to rank
                          </p>
                        </div>
                        {activeKeywordType === "seed" && (
                          <span className="text-purple-600 text-xs font-bold">✓</span>
                        )}
                      </button>

                      {/* Short tail */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveKeywordType("short")
                          setFocusKeyword(keywordSet.shortTail)
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                          activeKeywordType === "short"
                            ? "border-purple-300 bg-purple-50"
                            : "border-gray-100 hover:border-gray-200 bg-white"
                        }`}
                      >
                        <div className={`w-16 text-center py-0.5 rounded-lg text-[10px] uppercase font-bold flex-shrink-0 ${
                          activeKeywordType === "short"
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          Short
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">
                            {keywordSet.shortTail}
                          </p>
                          <p className="text-[10px] text-gray-400 leading-tight">
                            2-3 words — medium volume, medium competition
                          </p>
                        </div>
                        {activeKeywordType === "short" && (
                          <span className="text-purple-600 text-xs font-bold">✓</span>
                        )}
                      </button>

                      {/* Long tail */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveKeywordType("long")
                          setFocusKeyword(keywordSet.longTail)
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                          activeKeywordType === "long"
                            ? "border-purple-300 bg-purple-50"
                            : "border-gray-100 hover:border-gray-200 bg-white"
                        }`}
                      >
                        <div className={`w-16 text-center py-0.5 rounded-lg text-[10px] uppercase font-bold flex-shrink-0 ${
                          activeKeywordType === "long"
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          Long
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">
                            {keywordSet.longTail}
                          </p>
                          <p className="text-[10px] text-gray-400 leading-tight">
                            4-6 words — lower volume, easiest to rank
                          </p>
                        </div>
                        {activeKeywordType === "long" && (
                          <span className="text-purple-600 text-xs font-bold">✓</span>
                        )}
                      </button>

                      {/* Custom keyword */}
                      <div className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                        activeKeywordType === "custom"
                          ? "border-purple-300 bg-purple-50"
                          : "border-gray-100 bg-white"
                      }`}>
                        <button
                          type="button"
                          onClick={() => setActiveKeywordType("custom")}
                          className={`w-16 text-center py-0.5 rounded-lg text-[10px] uppercase font-bold flex-shrink-0 ${
                            activeKeywordType === "custom"
                              ? "bg-purple-600 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                          }`}
                        >
                          Custom
                        </button>
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            placeholder="Enter custom keyword..."
                            value={activeKeywordType === "custom" ? focusKeyword : ""}
                            onChange={(e) => {
                              setActiveKeywordType("custom")
                              setFocusKeyword(e.target.value)
                            }}
                            onClick={() => setActiveKeywordType("custom")}
                            className="w-full text-xs font-semibold text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 placeholder:font-normal"
                          />
                          <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                            Enter your own specific keyword phrase
                          </p>
                        </div>
                        {activeKeywordType === "custom" && (
                          <span className="text-purple-600 text-xs font-bold">✓</span>
                        )}
                      </div>
                    </div>

                    {/* Keyword density for active keyword */}
                    {keywordDensity && focusKeyword && (
                      <div className={`mt-2 flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
                        keywordDensity.status === "good"
                          ? "bg-green-50 text-green-700"
                          : keywordDensity.status === "high"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        <span>
                          Keyword density: <strong>{keywordDensity.density}%</strong> ({keywordDensity.count} times)
                        </span>
                        <span className="font-semibold">
                          {keywordDensity.status === "good" ? "Optimal" 
                           : keywordDensity.status === "high" ? "Too high" 
                           : "Too low"}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Readability details */}
                {readability && (
                  <div className={`rounded-xl p-3 border ${
                    readability.color === "green"
                      ? "bg-green-50 border-green-100"
                      : readability.color === "blue"
                      ? "bg-blue-50 border-blue-100"
                      : readability.color === "amber"
                      ? "bg-amber-50 border-amber-100"
                      : "bg-red-50 border-red-100"
                  }`}>
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700">
                        Readability
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{readability.grade}</span>
                        <span className={`text-xs font-medium ${
                          readability.color === "green" ? "text-green-700"
                          : readability.color === "blue" ? "text-blue-700"
                          : readability.color === "amber" ? "text-amber-700"
                          : "text-red-700"
                        }`}>
                          {readability.label}
                        </span>
                        <span className={`text-sm font-semibold ${
                          readability.color === "green" ? "text-green-700"
                          : readability.color === "blue" ? "text-blue-700"
                          : readability.color === "amber" ? "text-amber-700"
                          : "text-red-700"
                        }`}>
                          {readability.score}/100
                        </span>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="w-full bg-white bg-opacity-60 rounded-full h-2 mb-3 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          readability.color === "green" ? "bg-green-500"
                          : readability.color === "blue" ? "bg-blue-500"
                          : readability.color === "amber" ? "bg-amber-500"
                          : "bg-red-500"
                        }`}
                        style={{ width: `${readability.score}%` }}
                      />
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="bg-white bg-opacity-60 rounded-lg p-2 text-center">
                        <p className="text-xs font-semibold text-gray-800">
                          {readability.wordCount}
                        </p>
                        <p className="text-[10px] text-gray-500">Words</p>
                      </div>
                      <div className={`rounded-lg p-2 text-center ${
                        readability.avgWordsPerSentence > 20
                          ? "bg-red-100"
                          : readability.avgWordsPerSentence > 15
                          ? "bg-amber-100"
                          : "bg-white bg-opacity-60"
                      }`}>
                        <p className="text-xs font-semibold text-gray-800">
                          {readability.avgWordsPerSentence}
                        </p>
                        <p className="text-[10px] text-gray-500">Words/sentence</p>
                      </div>
                      <div className={`rounded-lg p-2 text-center ${
                        readability.longSentences > 0
                          ? "bg-amber-100"
                          : "bg-white bg-opacity-60"
                      }`}>
                        <p className="text-xs font-semibold text-gray-800">
                          {readability.longSentences}
                        </p>
                        <p className="text-[10px] text-gray-500">Long sentences</p>
                      </div>
                    </div>

                    {/* Suggestions */}
                    {readability.suggestions.map((suggestion, i) => (
                      <div key={i} className="flex items-start gap-1.5 mt-1.5">
                        <span className={`text-xs mt-0.5 flex-shrink-0 ${
                          suggestion.includes("Excellent")
                            ? "text-green-600 font-bold"
                            : "text-amber-500 font-bold"
                        }`}>
                          {suggestion.includes("Excellent") ? "✓" : "!"}
                        </span>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {suggestion}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Regenerate SEO button */}
                <button
                  onClick={() => generateSEO(previewContent)}
                  disabled={isGeneratingSEO}
                  className="w-full text-xs text-purple-600 border border-purple-200 rounded-lg py-1.5 hover:bg-purple-50 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 ${isGeneratingSEO ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  {isGeneratingSEO ? "Generating SEO..." : "Regenerate SEO data"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action buttons — show after content exists */}
        {previewContent && previewContent !== "<p></p>" && (
          <div className="sticky bottom-0 z-20 border-t border-gray-200 p-4 bg-white flex-shrink-0 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
            {/* Schedule picker popover */}
            {showSchedulePicker && (
              <div
                ref={scheduleRef}
                className="mb-3 p-4 bg-white border border-purple-200 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
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
                    Will be published on{" "}
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
                  onClick={() => handleSave("schedule")}
                  disabled={isScheduling || !scheduleDate}
                  className="w-full bg-purple-600 text-white rounded-lg py-2 text-sm font-medium
                             hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors flex items-center justify-center gap-2"
                >
                  {isScheduling ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                      </svg>
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      Confirm schedule
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleSave("draft")}
                disabled={isSaving}
                className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                {isSaving ? "Saving..." : "Save draft"}
              </button>
              <button
                onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${showSchedulePicker
                    ? "bg-purple-50 border-purple-300 text-purple-700"
                    : "border-purple-200 text-purple-600 hover:bg-purple-50"
                  }`}
              >
                <Clock className="w-4 h-4" />
                Schedule
              </button>
              <button
                onClick={() => handleSave("publish")}
                disabled={isPublishing}
                className="flex-1 bg-purple-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                {isPublishing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                    </svg>
                    Publishing...
                  </span>
                ) : (
                  "Publish now"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
