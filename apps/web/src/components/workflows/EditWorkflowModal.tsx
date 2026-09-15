import { useState, useEffect, useMemo } from "react"
import { Calendar, Clock, Brain, FileText, ChevronRight, Loader2, ChevronDown, ChevronUp, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ImageUploadSlot } from "./ImageUploadSlot"
import RichTextEditor from "@/components/editor/RichTextEditor"
import { api, BASE_URL } from "@/lib/api"
import { calculateReadabilityClient, calculateKeywordDensityClient } from "@/lib/seo"

interface EditWorkflowModalProps {
  open: boolean
  onClose: () => void
  onWorkflowUpdated: () => void
  sites: any[]
  workflow: any | null   // existing workflow record
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const TONES = ["Professional", "Casual", "Friendly", "Technical", "Persuasive", "Informative"]
const LANGUAGES = ["English", "Spanish", "French", "German", "Arabic"]

export function EditWorkflowModal({ open, onClose, onWorkflowUpdated, sites, workflow }: EditWorkflowModalProps) {
  const [scheduleType, setScheduleType] = useState<"daily" | "weekly" | "cron">("daily")
  const [numWeeks, setNumWeeks] = useState(1)
  const [activeWeek, setActiveWeek] = useState(1)
  const [selectedDays, setSelectedDays] = useState<string[]>(["Mon", "Wed", "Fri"])
  const [publishTime, setPublishTime] = useState("09:00")
  const [contentMode, setContentMode] = useState<"manual" | "auto">("manual")
  const [selectedSite, setSelectedSite] = useState("")
  const [tone, setTone] = useState("Professional")
  const [wordCount, setWordCount] = useState(1000)
  const [language, setLanguage] = useState("English")
  const [cronExpression, setCronExpression] = useState("0 9 * * 1,3,5")
  const [workflowName, setWorkflowName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDescGenerating, setIsDescGenerating] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null)
  const [selectedDescriptionDay, setSelectedDescriptionDay] = useState<string | null>(null)
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false)
  const [seoExpanded, setSeoExpanded] = useState(false)
  const [activeKeywordType, setActiveKeywordType] = useState<"seed" | "short" | "long" | "custom">("long")

  const [plan, setPlan] = useState<Record<string, Record<string, {
    title: string
    keywords: string
    baseTopic: string
    categories: string
    tags: string
    description: string
    imageFile: File | null
    imagePreview: string
    metaDescription: string
    seoTitle: string
    focusKeyword: string
    slug: string
    schemaMarkup: string
    keywordSet?: { seedWord: string; shortTail: string; longTail: string } | null
  }>>>({})

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Pre-fill from existing workflow when modal opens
  useEffect(() => {
    if (!open || !workflow) return

    setWorkflowName(workflow.name || "")
    setSelectedSite(workflow.siteId || "")
    setTone(workflow.tone || "Professional")
    setWordCount(workflow.wordCount || 1000)

    const sd = (workflow.scheduleData as any) || {}
    const type = sd.type || "daily"
    setScheduleType(type)
    setPublishTime(sd.time || "09:00")
    setNumWeeks(sd.weeks || 1)
    setActiveWeek(1)

    if (type === "weekly" && sd.days) {
      setSelectedDays(sd.days)
    } else if (type === "cron" && sd.cronExpression) {
      setCronExpression(sd.cronExpression)
    }

    if (sd.plan) {
      // Restore plan — images can't be restored from server paths, so imageFile = null
      const restored: any = {}
      for (const [weekKey, days] of Object.entries(sd.plan as any)) {
        restored[weekKey] = {}
        for (const [day, data] of Object.entries(days as any)) {
          restored[weekKey][day] = {
            title: (data as any).title || "",
            keywords: (data as any).keywords || "",
            baseTopic: (data as any).baseTopic || "",
            categories: (data as any).categories || "",
            tags: (data as any).tags || "",
            description: (data as any).description || "",
            imageFile: null,
            imagePreview: (data as any).imageUrl || "",
            metaDescription: (data as any).metaDescription || "",
            seoTitle: (data as any).seoTitle || "",
            focusKeyword: (data as any).focusKeyword || "",
            slug: (data as any).slug || "",
            schemaMarkup: (data as any).schemaMarkup || "",
          }
        }
      }
      setPlan(restored)
      setContentMode(sd.mode || "manual")
    } else {
      setPlan({})
      setContentMode("manual")
    }
  }, [open, workflow])

  function getActiveDays(): string[] {
    if (scheduleType === "daily") return DAYS
    if (scheduleType === "weekly") return selectedDays
    return []
  }

  function initPlan(weeks: number, days: string[]) {
    const newPlan: any = {}
    for (let w = 1; w <= weeks; w++) {
      const weekKey = `week${w}`
      newPlan[weekKey] = {}
      days.forEach(day => {
        newPlan[weekKey][day] =
          plan[weekKey]?.[day] ||
          { title: "", keywords: "", baseTopic: "", categories: "", tags: "", description: "", imageFile: null, imagePreview: "", metaDescription: "", seoTitle: "", focusKeyword: "", slug: "", schemaMarkup: "", keywordSet: null }
      })
    }
    setPlan(newPlan)
  }

  useEffect(() => {
    if (open && plan && Object.keys(plan).length > 0) {
      initPlan(numWeeks, getActiveDays())
    }
  }, [numWeeks, selectedDays, scheduleType])

  function updateDay(week: number, day: string, field: string, value: any) {
    setPlan(prev => ({
      ...prev,
      [`week${week}`]: {
        ...prev[`week${week}`],
        [day]: { ...prev[`week${week}`]?.[day], [field]: value }
      }
    }))
  }

  function handleImageSelect(week: number, day: string, file: File) {
    if (file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return }
    updateDay(week, day, "imageFile", file)
    updateDay(week, day, "imagePreview", URL.createObjectURL(file))
  }

  async function handleGeneratePlan() {
    if (!workflowName.trim()) { alert("Please enter a Workflow Name first"); return }
    setIsGenerating(true)
    try {
      const activeDays = getActiveDays()
      const totalCount = activeDays.length * numWeeks
      const res = await api.post("/api/workflows/generate-plan", {
        name: workflowName,
        count: totalCount,
        tone,
        language,
        wordCount,
      })

      if (res.data.success) {
        const aiPlan = res.data.data
        const newPlan = { ...plan }
        let planIdx = 0

        for (let w = 1; w <= numWeeks; w++) {
          const weekKey = `week${w}`
          if (!newPlan[weekKey]) newPlan[weekKey] = {}
          activeDays.forEach(day => {
            if (aiPlan[planIdx]) {
              newPlan[weekKey][day] = {
                ...newPlan[weekKey][day],
                title: aiPlan[planIdx].title,
                keywords: aiPlan[planIdx].keywords?.join(", ") ?? "",
                categories: aiPlan[planIdx].categories?.join(", ") ?? "",
                tags: aiPlan[planIdx].tags?.join(", ") ?? "",
                description: aiPlan[planIdx].description ?? "",
                baseTopic: "",
                imageFile: null,
                imagePreview: newPlan[weekKey][day]?.imagePreview || "",
              }
              planIdx++
            }
          })
        }
        setPlan(newPlan)
        showToast("AI plan generated!")
      }
    } catch (err: any) {
      showToast(err.message || "Failed to generate plan", "error")
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSubmit() {
    if (!selectedSite) { alert("Please select a site"); return }
    setIsSubmitting(true)

    try {
      // Upload any newly selected images
      const imageUploads: Record<string, string> = {}

      for (const [weekKey, days] of Object.entries(plan)) {
        for (const [day, data] of Object.entries(days)) {
          if (data.imageFile) {
            const weekNum = weekKey.replace("week", "")
            const imageKey = `wf_temp_w${weekNum}_${day.toLowerCase()}`
            const formData = new FormData()
            formData.append("image", data.imageFile)
            formData.append("imageKey", imageKey)

            const res = await fetch(`${BASE_URL}/api/workflows/upload-image`, {
              method: "POST",
              headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
              body: formData,
            })
            const result = await res.json()
            if (result.success) {
              imageUploads[imageKey] = result.data.url
            }
          }
        }
      }

      // Build scheduleData
      const scheduleData = {
        type: scheduleType,
        weeks: numWeeks,
        time: publishTime,
        days: scheduleType === "weekly" ? selectedDays : undefined,
        mode: contentMode,
        cronExpression: scheduleType === "cron" ? cronExpression : undefined,
        plan: Object.fromEntries(
          Object.entries(plan).map(([weekKey, days]) => [
            weekKey,
            Object.fromEntries(
              Object.entries(days).map(([day, data]: [string, any]) => {
                const weekNum = weekKey.replace("week", "")
                const imageKey = `wf_temp_w${weekNum}_${day.toLowerCase()}`
                return [day, {
                  title: data.title,
                  baseTopic: data.baseTopic,
                  keywords: data.keywords,
                  categories: data.categories,
                  tags: data.tags,
                  description: data.description,
                  imageUrl: imageUploads[imageKey] || data.imagePreview || null,
                  metaDescription: data.metaDescription || "",
                  seoTitle: data.seoTitle || "",
                  focusKeyword: data.focusKeyword || "",
                  slug: data.slug || "",
                  schemaMarkup: data.schemaMarkup || "",
                }]
              })
            )
          ])
        )
      }

      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${BASE_URL}/api/workflows/${workflow.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          siteId: selectedSite,
          name: workflowName,
          scheduleData,
          tone,
          wordCount,
          language,
        })
      })

      const result = await res.json()
      if (result.success) {
        onWorkflowUpdated()
        onClose()
      } else {
        showToast("Update failed: " + result.error, "error")
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update workflow", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeDays = getActiveDays()
  const totalPosts = activeDays.length * numWeeks
  const selectedDescriptionData = selectedDescriptionDay
    ? plan[`week${activeWeek}`]?.[selectedDescriptionDay]
    : null

  async function handleGenerateSEO(week: number, day: string, entry: any) {
    const title = entry.title || entry.baseTopic
    const content = entry.description
    if (!title || !content) { alert("Generate a description first before generating SEO data."); return }
    setIsGeneratingSEO(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${BASE_URL}/api/posts/generate-seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ postTitle: title, content, keywords: entry.keywords ? entry.keywords.split(',').map((k: string) => k.trim()) : [], tone: tone || 'Professional' })
      })
      const data = await res.json()
      if (data.success) {
        updateDay(week, day, 'metaDescription', data.data.metaDescription)
        updateDay(week, day, 'seoTitle', data.data.seoTitle)
        updateDay(week, day, 'slug', data.data.slug)
        // Store the full keyword set; default active selection = long tail
        updateDay(week, day, 'keywordSet', data.data.keywords)
        updateDay(week, day, 'focusKeyword', data.data.keywords?.longTail || data.data.selectedKeyword || '')
        updateDay(week, day, 'schemaMarkup', data.data.schemaMarkup)
        setActiveKeywordType("long")
        setSeoExpanded(true)
      }
    } catch (e) { console.error(e) } finally { setIsGeneratingSEO(false) }
  }

  const selectedReadability = useMemo(() => {
    if (!selectedDescriptionData?.description) return null
    return calculateReadabilityClient(selectedDescriptionData.description)
  }, [selectedDescriptionData?.description])

  const selectedDensity = useMemo(() => {
    if (!selectedDescriptionData?.description || !selectedDescriptionData?.focusKeyword) return null
    return calculateKeywordDensityClient(selectedDescriptionData.description, selectedDescriptionData.focusKeyword)
  }, [selectedDescriptionData?.description, selectedDescriptionData?.focusKeyword])

  const keywordSet = selectedDescriptionData?.keywordSet || null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[1400px] w-[96vw] max-h-[90vh] overflow-hidden flex flex-col p-0 bg-white">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white
            ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
            {toast.msg}
          </div>
        )}

        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Edit workflow
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Basic settings */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Site</Label>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(site => (
                    <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Workflow name + generate button */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Workflow Name</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. 'Coffee Brewing Mastery'"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="h-10"
              />
              {contentMode === "auto" && (
                <Button
                  onClick={handleGeneratePlan}
                  disabled={isGenerating || !workflowName.trim()}
                  variant="outline"
                  className="h-10 border-purple-200 text-purple-600 hover:bg-purple-50 shrink-0"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
                  Regenerate AI Plan
                </Button>
              )}
            </div>
          </div>

          {/* SECTION 1.5: Word count range */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Word count — <span className="text-purple-600 font-semibold">{wordCount} words</span>
            </label>
            <input
              type="range" min={500} max={3000} step={100} value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>500 short</span><span>1500 ideal</span><span>3000 long</span>
            </div>
          </div>

          {/* SECTION 2: Schedule type tabs */}
          <div className="space-y-4">
            <div className="flex p-1 bg-gray-50 border rounded-lg w-fit">
              {["daily", "weekly", "cron"].map((type) => (
                <button
                  key={type}
                  onClick={() => setScheduleType(type as any)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    scheduleType === type ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {scheduleType === "cron" ? (
              <div className="space-y-2">
                <Label>Cron Expression</Label>
                <Input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 9 * * 1,3,5"
                />
                <p className="text-xs text-gray-400">Standard cron syntax: min hour day-of-month month day-of-week</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-end gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Publish time
                    </Label>
                    <Input
                      type="time" value={publishTime}
                      onChange={(e) => setPublishTime(e.target.value)}
                      className="w-32 h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (Weeks)</Label>
                    <Select value={numWeeks.toString()} onValueChange={(v) => setNumWeeks(parseInt(v))}>
                      <SelectTrigger className="w-32 h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 6, 8].map(w => (
                          <SelectItem key={w} value={w.toString()}>{w} {w === 1 ? 'week' : 'weeks'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {scheduleType === "weekly" && (
                    <div className="space-y-2 flex-1">
                      <Label>Active Days</Label>
                      <div className="flex gap-1">
                        {DAYS.map(day => (
                          <button
                            key={day}
                            onClick={() => setSelectedDays(prev =>
                              prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                            )}
                            className={`w-10 h-10 rounded-lg text-xs font-bold border transition-all ${
                              selectedDays.includes(day)
                                ? "bg-purple-600 border-purple-600 text-white"
                                : "bg-white border-gray-200 text-gray-400 hover:border-purple-300"
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Content mode */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setContentMode("manual")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      contentMode === "manual" ? "border-purple-600 bg-purple-50/50" : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className={`w-5 h-5 ${contentMode === "manual" ? "text-purple-600" : "text-gray-400"}`} />
                      <span className="font-bold">Manual Titles</span>
                    </div>
                    <p className="text-xs text-gray-500">Provide exact titles and unique images for each post.</p>
                  </button>
                  <button
                    onClick={() => setContentMode("auto")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      contentMode === "auto" ? "border-purple-600 bg-purple-50/50" : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Brain className={`w-5 h-5 ${contentMode === "auto" ? "text-purple-600" : "text-gray-400"}`} />
                      <span className="font-bold">AI Auto-Variations</span>
                    </div>
                    <p className="text-xs text-gray-500">Provide a base topic—AI creates unique titles and posts automatically.</p>
                  </button>
                </div>

                {/* Week tabs */}
                {numWeeks > 1 && (
                  <div className="flex gap-2 border-b overflow-x-auto pb-px">
                    {Array.from({ length: numWeeks }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveWeek(i + 1)}
                        className={`px-4 py-2 text-sm font-medium transition-all relative ${
                          activeWeek === i + 1 ? "text-purple-600" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Week {i + 1}
                        {activeWeek === i + 1 && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Day grid */}
                <div className="grid gap-4 bg-white p-4 rounded-xl border border-gray-100 lg:grid-cols-[minmax(0,1fr)_minmax(520px,600px)]">
                  {activeDays.length === 0 ? (
                    <>
                      <div className="text-center py-8 text-gray-400 text-sm">Select at least one day above</div>
                      <div className="min-h-[300px] rounded-lg border border-gray-200 bg-gray-50 p-3" />
                    </>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {activeDays.map(day => {
                          const dayData = plan[`week${activeWeek}`]?.[day] || { title: "", keywords: "", baseTopic: "", categories: "", tags: "", description: "", imagePreview: "" }
                          const isSelectedDescription = selectedDescriptionDay === day
                          return (
                            <div
                              key={day}
                              onClick={() => setSelectedDescriptionDay(day)}
                              className={`bg-white p-3 rounded-lg border shadow-sm transition-all cursor-pointer ${
                                isSelectedDescription
                                  ? "border-purple-300 ring-2 ring-purple-100"
                                  : "border-gray-200 hover:border-purple-200"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex gap-3 items-start">
                                  <div className="w-10 pt-2.5">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-tighter">{day}</span>
                                  </div>
                                  <div className="flex-1">
                                    <div className="relative">
                                      <Input 
                                        placeholder={contentMode === "auto" ? "AI Title will appear here..." : "Post Title"} 
                                        value={dayData.title}
                                        onChange={(e) => updateDay(activeWeek, day, "title", e.target.value)}
                                        className="h-9 text-sm pr-16"
                                      />
                                      {contentMode === "auto" ? (
                                        <Badge className="absolute right-2 top-1.5 bg-purple-100 text-purple-600 border-none text-[10px] uppercase tracking-tighter">AI Generated</Badge>
                                      ) : (
                                        <Badge variant="outline" className="absolute right-2 top-1.5 border-gray-200 text-gray-400 text-[10px] uppercase tracking-tighter">Manual</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2 items-start pl-12 mt-2">
                                  <div className="flex-1">
                                    <label className="text-xs text-gray-400 mb-1 block">Keywords</label>
                                    <input type="text" value={dayData.keywords || ""} onChange={(e) => updateDay(activeWeek, day, "keywords", e.target.value)} placeholder="keyword1, keyword2..." className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs text-gray-400 mb-1 block">Categories</label>
                                    <input type="text" value={dayData.categories || ""} onChange={(e) => updateDay(activeWeek, day, "categories", e.target.value)} placeholder="Tech, Marketing..." className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs text-gray-400 mb-1 block">Tags</label>
                                    <input type="text" value={dayData.tags || ""} onChange={(e) => updateDay(activeWeek, day, "tags", e.target.value)} placeholder="AI, Automation..." className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400" />
                                  </div>
                                  {(contentMode === "manual" || contentMode === "auto") && (
                                    <div>
                                      <label className="text-xs text-gray-400 mb-1 block">Image</label>
                                      <ImageUploadSlot preview={dayData.imagePreview} onSelect={(f) => handleImageSelect(activeWeek, day, f)} size={48} />
                                    </div>
                                  )}
                                </div>

                                {(contentMode === "auto" || contentMode === "manual") && (
                                  <div className="mt-3 pl-12">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.stopPropagation()
                                          setSelectedDescriptionDay(day)
                                          try {
                                            setIsDescGenerating(true)
                                            const res = await api.post('/api/workflows/generate-description', {
                                              title: dayData.title,
                                              keywords: dayData.keywords,
                                              categories: dayData.categories,
                                              tags: dayData.tags,
                                              wordCount,
                                              tone,
                                              language,
                                            })
                                            if (res.data?.success) {
                                              updateDay(activeWeek, day, 'description', res.data.data.description)
                                            }
                                          } catch (err) {
                                            console.error(err)
                                          } finally {
                                            setIsDescGenerating(false)
                                          }
                                        }}
                                        disabled={isDescGenerating}
                                        className="inline-flex items-center text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-1.5 px-3 rounded"
                                      >
                                        {isDescGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Brain className="w-3 h-3 mr-1" />}
                                        {dayData.description ? "Generate Description again" : "Generate Description"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="min-w-0 self-stretch rounded-lg border border-purple-100 bg-purple-50/30 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase text-gray-500">Description</span>
                          {selectedDescriptionDay && (
                            <span className="text-xs font-semibold text-purple-600">
                              Week {activeWeek} / {selectedDescriptionDay}
                            </span>
                          )}
                        </div>
                        <div>
                          {selectedDescriptionDay && selectedDescriptionData ? (
                            <>
                              {isDescGenerating && (
                                <div className="mb-2 inline-flex items-center gap-2 text-xs text-gray-500">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Generating...
                                </div>
                              )}
                              <div className="h-[600px]">
                                <RichTextEditor
                                  content={selectedDescriptionData.description || ""}
                                  onChange={(html) => updateDay(activeWeek, selectedDescriptionDay, "description", html)}
                                  placeholder={`Generated (~${wordCount} words)`}
                                />
                              </div>

                              {/* SEO Panel */}
                              <div className="mt-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => setSeoExpanded(!seoExpanded)}
                                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <Search className="w-4 h-4 text-purple-600" />
                                    <span className="text-sm font-medium text-gray-800">SEO</span>
                                    {isGeneratingSEO && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />}
                                    {!isGeneratingSEO && selectedDescriptionData.metaDescription && (
                                      <span className="text-xs text-green-600 flex items-center gap-1">✓ Generated</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {selectedReadability && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        selectedReadability.color === "green" ? "bg-green-50 text-green-700"
                                        : selectedReadability.color === "blue" ? "bg-blue-50 text-blue-700"
                                        : selectedReadability.color === "amber" ? "bg-amber-50 text-amber-700"
                                        : "bg-red-50 text-red-700"
                                      }`}>
                                        {selectedReadability.label} · {selectedReadability.score}
                                      </span>
                                    )}
                                    {seoExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                  </div>
                                </button>

                                {seoExpanded && (
                                  <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
                                    {/* Generate SEO button */}
                                    <div className="pt-3">
                                      <button
                                        type="button"
                                        onClick={() => handleGenerateSEO(activeWeek, selectedDescriptionDay, selectedDescriptionData)}
                                        disabled={isGeneratingSEO || !selectedDescriptionData.description}
                                        className="w-full text-xs text-purple-600 border border-purple-200 rounded-lg py-2 hover:bg-purple-50 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-colors"
                                      >
                                        {isGeneratingSEO ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                                        {isGeneratingSEO ? "Generating SEO..." : selectedDescriptionData.metaDescription ? "Regenerate SEO data" : "Generate SEO data"}
                                      </button>
                                    </div>

                                    {selectedDescriptionData.metaDescription && (
                                      <>
                                        {/* Meta description */}
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-medium text-gray-600">Meta description</label>
                                            <span className={`text-xs ${
                                              selectedDescriptionData.metaDescription.length > 155 ? "text-red-500"
                                              : selectedDescriptionData.metaDescription.length > 140 ? "text-green-600"
                                              : "text-gray-400"
                                            }`}>{selectedDescriptionData.metaDescription.length}/155</span>
                                          </div>
                                          <textarea
                                            value={selectedDescriptionData.metaDescription}
                                            onChange={(e) => updateDay(activeWeek, selectedDescriptionDay, "metaDescription", e.target.value)}
                                            rows={2}
                                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
                                          />
                                        </div>

                                        {/* SEO title */}
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-medium text-gray-600">SEO title</label>
                                            <span className={`text-xs ${
                                              selectedDescriptionData.seoTitle.length > 60 ? "text-red-500"
                                              : selectedDescriptionData.seoTitle.length > 50 ? "text-green-600"
                                              : "text-gray-400"
                                            }`}>{selectedDescriptionData.seoTitle.length}/60</span>
                                          </div>
                                          <input
                                            type="text"
                                            value={selectedDescriptionData.seoTitle}
                                            onChange={(e) => updateDay(activeWeek, selectedDescriptionDay, "seoTitle", e.target.value)}
                                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                          />
                                          {/* Google preview */}
                                          <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                            <p className="text-xs text-gray-400 mb-1">Google preview</p>
                                            <p className="text-sm text-blue-700 font-medium leading-tight">{selectedDescriptionData.seoTitle || selectedDescriptionData.title}</p>
                                            <p className="text-xs text-green-700 mt-0.5">yourdomain.com/{selectedDescriptionData.slug}</p>
                                            <p className="text-xs text-gray-600 mt-0.5 leading-tight">
                                              {selectedDescriptionData.metaDescription.substring(0, 120)}{selectedDescriptionData.metaDescription.length > 120 ? "..." : ""}
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
                                              value={selectedDescriptionData.slug}
                                              onChange={(e) => updateDay(activeWeek, selectedDescriptionDay, "slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))}
                                              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 font-mono"
                                            />
                                          </div>
                                        </div>

                                        {/* Focus keyword — 3-card selector */}
                                        {keywordSet ? (
                                          <div>
                                            <label className="text-xs font-medium text-gray-600 block mb-2">Focus keyword</label>
                                            <div className="space-y-2">
                                              {([
                                                { type: "seed" as const, label: "Seed", value: keywordSet.seedWord, hint: "Single word — high volume, hardest to rank" },
                                                { type: "short" as const, label: "Short", value: keywordSet.shortTail, hint: "2-3 words — medium volume, medium competition" },
                                                { type: "long" as const, label: "Long", value: keywordSet.longTail, hint: "4-6 words — lower volume, easiest to rank" },
                                              ]).map(({ type, label, value, hint }) => (
                                                <button
                                                  key={type}
                                                  type="button"
                                                  onClick={() => {
                                                    setActiveKeywordType(type)
                                                    updateDay(activeWeek, selectedDescriptionDay, "focusKeyword", value)
                                                  }}
                                                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                                                    activeKeywordType === type
                                                      ? "border-purple-300 bg-purple-50"
                                                      : "border-gray-100 hover:border-gray-200 bg-white"
                                                  }`}
                                                >
                                                  <div className={`w-14 text-center py-0.5 rounded-lg text-[10px] uppercase font-bold flex-shrink-0 ${
                                                    activeKeywordType === type ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500"
                                                  }`}>{label}</div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{value}</p>
                                                    <p className="text-[10px] text-gray-400 leading-tight">{hint}</p>
                                                  </div>
                                                  {activeKeywordType === type && <span className="text-purple-600 text-xs font-bold">✓</span>}
                                                </button>
                                              ))}

                                              {/* Custom keyword */}
                                              <div className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                                                activeKeywordType === "custom"
                                                  ? "border-purple-300 bg-purple-50"
                                                  : "border-gray-100 bg-white"
                                              }`}>
                                                <button
                                                  type="button"
                                                  onClick={() => setActiveKeywordType("custom")}
                                                  className={`w-14 text-center py-0.5 rounded-lg text-[10px] uppercase font-bold flex-shrink-0 ${
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
                                                    value={activeKeywordType === "custom" ? (selectedDescriptionData.focusKeyword || "") : ""}
                                                    onChange={(e) => {
                                                      setActiveKeywordType("custom")
                                                      updateDay(activeWeek, selectedDescriptionDay, "focusKeyword", e.target.value)
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
                                            {selectedDensity && selectedDescriptionData.focusKeyword && (
                                              <div className={`mt-2 flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
                                                selectedDensity.status === "good" ? "bg-green-50 text-green-700"
                                                : selectedDensity.status === "high" ? "bg-red-50 text-red-700"
                                                : "bg-amber-50 text-amber-700"
                                              }`}>
                                                <span>Keyword density: <strong>{selectedDensity.density}%</strong> ({selectedDensity.count} times)</span>
                                                <span className="font-semibold">{selectedDensity.status === "good" ? "Optimal" : selectedDensity.status === "high" ? "Too high" : "Too low"}</span>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div>
                                            <label className="text-xs font-medium text-gray-600 block mb-1">Focus keyword</label>
                                            <div className="flex gap-2">
                                              <input
                                                type="text"
                                                value={selectedDescriptionData.focusKeyword || ""}
                                                onChange={(e) => updateDay(activeWeek, selectedDescriptionDay, "focusKeyword", e.target.value)}
                                                placeholder="Primary keyword phrase..."
                                                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                              />
                                              {selectedDensity && (
                                                <span className={`text-xs px-2 py-1.5 rounded-lg font-medium flex-shrink-0 ${
                                                  selectedDensity.status === "good" ? "bg-green-50 text-green-700"
                                                  : selectedDensity.status === "high" ? "bg-red-50 text-red-700"
                                                  : "bg-amber-50 text-amber-700"
                                                }`}>{selectedDensity.density}% · {selectedDensity.count}x</span>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Readability — metrics grid */}
                                        {selectedReadability && (
                                          <div className={`rounded-xl p-3 border ${
                                            selectedReadability.color === "green" ? "bg-green-50 border-green-100"
                                            : selectedReadability.color === "blue" ? "bg-blue-50 border-blue-100"
                                            : selectedReadability.color === "amber" ? "bg-amber-50 border-amber-100"
                                            : "bg-red-50 border-red-100"
                                          }`}>
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-xs font-medium text-gray-700">Readability</span>
                                              <div className="flex items-center gap-2">
                                                {(selectedReadability as any).grade && <span className="text-xs text-gray-500">{(selectedReadability as any).grade}</span>}
                                                <span className={`text-xs font-medium ${
                                                  selectedReadability.color === "green" ? "text-green-700"
                                                  : selectedReadability.color === "blue" ? "text-blue-700"
                                                  : selectedReadability.color === "amber" ? "text-amber-700"
                                                  : "text-red-700"
                                                }`}>{selectedReadability.label}</span>
                                                <span className={`text-sm font-semibold ${
                                                  selectedReadability.color === "green" ? "text-green-700"
                                                  : selectedReadability.color === "blue" ? "text-blue-700"
                                                  : selectedReadability.color === "amber" ? "text-amber-700"
                                                  : "text-red-700"
                                                }`}>{selectedReadability.score}/100</span>
                                              </div>
                                            </div>
                                            <div className="w-full bg-white bg-opacity-60 rounded-full h-2 mb-3 overflow-hidden">
                                              <div
                                                className={`h-2 rounded-full transition-all duration-500 ${
                                                  selectedReadability.color === "green" ? "bg-green-500"
                                                  : selectedReadability.color === "blue" ? "bg-blue-500"
                                                  : selectedReadability.color === "amber" ? "bg-amber-500"
                                                  : "bg-red-500"
                                                }`}
                                                style={{ width: `${selectedReadability.score}%` }}
                                              />
                                            </div>
                                            {/* Stats grid */}
                                            <div className="grid grid-cols-3 gap-2 mb-2">
                                              <div className="bg-white bg-opacity-60 rounded-lg p-2 text-center">
                                                <p className="text-xs font-semibold text-gray-800">{(selectedReadability as any).wordCount ?? "—"}</p>
                                                <p className="text-[10px] text-gray-500">Words</p>
                                              </div>
                                              <div className={`rounded-lg p-2 text-center ${
                                                (selectedReadability as any).avgWordsPerSentence > 20 ? "bg-red-100"
                                                : (selectedReadability as any).avgWordsPerSentence > 15 ? "bg-amber-100"
                                                : "bg-white bg-opacity-60"
                                              }`}>
                                                <p className="text-xs font-semibold text-gray-800">{(selectedReadability as any).avgWordsPerSentence ?? "—"}</p>
                                                <p className="text-[10px] text-gray-500">Words/sentence</p>
                                              </div>
                                              <div className={`rounded-lg p-2 text-center ${
                                                (selectedReadability as any).longSentences > 0 ? "bg-amber-100" : "bg-white bg-opacity-60"
                                              }`}>
                                                <p className="text-xs font-semibold text-gray-800">{(selectedReadability as any).longSentences ?? "—"}</p>
                                                <p className="text-[10px] text-gray-500">Long sentences</p>
                                              </div>
                                            </div>
                                            {selectedReadability.suggestions.map((s, i) => (
                                              <div key={i} className="flex items-start gap-1.5 mt-1.5">
                                                <span className={`text-xs mt-0.5 flex-shrink-0 font-bold ${
                                                  s.includes("Excellent") ? "text-green-600" : "text-amber-500"
                                                }`}>{s.includes("Excellent") ? "✓" : "!"}</span>
                                                <p className="text-xs text-gray-600 leading-relaxed">{s}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="min-h-[600px] rounded-xl border border-dashed border-gray-200 bg-white" />
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 bg-white border-t items-center justify-between sm:justify-between">
          <div className="text-sm">
            {scheduleType !== "cron" && (
              <div className="flex items-center gap-2 text-gray-600">
                <Badge variant="outline" className="bg-white border-purple-200 text-purple-600">
                  {totalPosts} posts scheduled
                </Badge>
                <ChevronRight className="w-4 h-4 text-gray-300" />
                <span className="text-gray-400">Across {numWeeks} {numWeeks === 1 ? 'week' : 'weeks'}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (scheduleType !== "cron" && activeDays.length === 0)}
              className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
            >
              {isSubmitting ? "Saving..." : "Update workflow"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
