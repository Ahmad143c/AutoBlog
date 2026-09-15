import { useState, useEffect, useMemo } from "react"
import { X, Save, Brain, Loader2, Clock, FileText, ChevronDown, ChevronUp, Search } from "lucide-react"
import { ImageUploadSlot } from "./ImageUploadSlot"
import RichTextEditor from "@/components/editor/RichTextEditor"
import { api, BASE_URL } from "@/lib/api"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { calculateReadabilityClient, calculateKeywordDensityClient } from "@/lib/seo"

interface WorkflowExpandedPanelProps {
  workflow: {
    id: string
    name: string
    scheduleData: any
    tone: string
    wordCount: number
    language: string
  }
  onSave: (updatedScheduleData: any, wordCount: number) => void
  onClose: () => void
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function WorkflowExpandedPanel({
  workflow,
  onSave,
  onClose,
}: WorkflowExpandedPanelProps) {
  const scheduleData = typeof workflow.scheduleData === "string"
    ? JSON.parse(workflow.scheduleData)
    : workflow.scheduleData

  const [wordCount, setWordCount] = useState(workflow.wordCount || 1000)
  const [scheduleType, setScheduleType] = useState<"daily" | "weekly" | "cron">(scheduleData.type || "daily")
  const [publishTime, setPublishTime] = useState(scheduleData.time || "09:00")
  const [numWeeks, setNumWeeks] = useState(scheduleData.weeks || 1)
  const [selectedDays, setSelectedDays] = useState<string[]>(scheduleData.days || ["Mon", "Wed", "Fri"])
  const [cronExpression, setCronExpression] = useState(scheduleData.cronExpression || "0 9 * * 1,3,5")
  const [contentMode, setContentMode] = useState<"manual" | "auto">(scheduleData.mode || "manual")

  const [localPlan, setLocalPlan] = useState(
    JSON.parse(JSON.stringify(scheduleData.plan || {}))
  )
  const [activeWeek, setActiveWeek] = useState("week1")
  const [isSaving, setIsSaving] = useState(false)
  const [isDescGenerating, setIsDescGenerating] = useState(false)
  const [selectedDescriptionDay, setSelectedDescriptionDay] = useState<string | null>(null)
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false)
  const [seoExpanded, setSeoExpanded] = useState(false)
  const [activeKeywordType, setActiveKeywordType] = useState<"seed" | "short" | "long" | "custom">("long")

  function getActiveDays(): string[] {
    if (scheduleType === "daily") return DAYS
    if (scheduleType === "weekly") return selectedDays
    return []
  }

  function initPlan(weeksCount: number, days: string[]) {
    const newPlan: any = {}
    for (let w = 1; w <= weeksCount; w++) {
      const weekKey = `week${w}`
      newPlan[weekKey] = {}
      days.forEach(day => {
        newPlan[weekKey][day] =
          localPlan[weekKey]?.[day] ||
          { title: "", keywords: "", baseTopic: "", categories: "", tags: "", description: "", imageFile: null, imagePreview: "", metaDescription: "", seoTitle: "", focusKeyword: "", slug: "", schemaMarkup: "" }
      })
    }
    setLocalPlan(newPlan)
  }

  // Sync plan structure when duration or active days change
  useEffect(() => {
    if (scheduleType !== "cron") {
      initPlan(numWeeks, getActiveDays())
    }
  }, [numWeeks, selectedDays, scheduleType])

  useEffect(() => {
    const weekNum = parseInt(activeWeek.replace("week", ""))
    if (weekNum > numWeeks) {
      setActiveWeek("week1")
    }
  }, [numWeeks, activeWeek])

  const weeks = Object.keys(localPlan)
  const activeDays = Object.keys(localPlan[activeWeek] || {})
  const DAY_ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
  const orderedDays = DAY_ORDER.filter(d => activeDays.includes(d))
  const selectedDescriptionEntry = selectedDescriptionDay
    ? localPlan[activeWeek]?.[selectedDescriptionDay]
    : null

  function updateEntry(week: string, day: string, field: string, value: any) {
    setLocalPlan((prev: any) => ({
      ...prev,
      [week]: {
        ...prev[week],
        [day]: { ...prev[week][day], [field]: value }
      }
    }))
  }

  function handleImageSelect(week: string, day: string, file: File) {
    if (file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return }
    const preview = URL.createObjectURL(file)
    updateEntry(week, day, "imageFile", file)
    updateEntry(week, day, "imagePreview", preview)
  }

  async function handleGenerateDescription(week: string, day: string, entry: any) {
    try {
      setIsDescGenerating(true)
      const res = await api.post('/api/workflows/generate-description', {
        title: entry.title || entry.baseTopic,
        keywords: entry.keywords,
        categories: entry.categories,
        tags: entry.tags,
        wordCount: workflow.wordCount,
        tone: workflow.tone,
        language: workflow.language,
      })
      if (res.data?.success) {
        updateEntry(week, day, 'description', res.data.data.description)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsDescGenerating(false)
    }
  }

  async function handleGenerateSEO(week: string, day: string, entry: any) {
    const title = entry.title || entry.baseTopic
    const content = entry.description
    if (!title || !content) { alert("Generate a description first before generating SEO data."); return }
    setIsGeneratingSEO(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${BASE_URL}/api/posts/generate-seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ postTitle: title, content, keywords: entry.keywords ? entry.keywords.split(',').map((k: string) => k.trim()) : [], tone: workflow.tone || 'Professional' })
      })
      const data = await res.json()
      if (data.success) {
        updateEntry(week, day, 'metaDescription', data.data.metaDescription)
        updateEntry(week, day, 'seoTitle', data.data.seoTitle)
        updateEntry(week, day, 'slug', data.data.slug)
        // Store full keyword set; default active = long tail
        updateEntry(week, day, 'keywordSet', data.data.keywords)
        updateEntry(week, day, 'focusKeyword', data.data.keywords?.longTail || data.data.selectedKeyword || '')
        updateEntry(week, day, 'schemaMarkup', data.data.schemaMarkup)
        setActiveKeywordType("long")
        setSeoExpanded(true)
      }
    } catch (e) { console.error(e) } finally { setIsGeneratingSEO(false) }
  }

  // Compute readability & density for the selected day
  const selectedReadability = useMemo(() => {
    if (!selectedDescriptionEntry?.description) return null
    return calculateReadabilityClient(selectedDescriptionEntry.description)
  }, [selectedDescriptionEntry?.description])

  const selectedDensity = useMemo(() => {
    if (!selectedDescriptionEntry?.description || !selectedDescriptionEntry?.focusKeyword) return null
    return calculateKeywordDensityClient(selectedDescriptionEntry.description, selectedDescriptionEntry.focusKeyword)
  }, [selectedDescriptionEntry?.description, selectedDescriptionEntry?.focusKeyword])

  const keywordSet = selectedDescriptionEntry?.keywordSet || null

  async function handleSave() {
    setIsSaving(true)
    try {
      // Upload any new images first
      for (const [weekKey, days] of Object.entries(localPlan)) {
        for (const [day, data] of Object.entries(days as any)) {
          if ((data as any).imageFile) {
            const formData = new FormData()
            formData.append("image", (data as any).imageFile)
            formData.append("imageKey", `wf_${workflow.id}_${weekKey}_${day.toLowerCase()}`)

            const token = localStorage.getItem('auth_token')
            const res = await fetch(
              `${BASE_URL}/api/workflows/upload-image`,
              {
                method: "POST",
                body: formData,
                headers: {
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
              }
            )
            const result = await res.json()
            if (result.success) {
              updateEntry(weekKey, day, "imageUrl", result.data.url)
              updateEntry(weekKey, day, "imageFile", null)
              updateEntry(weekKey, day, "imagePreview", "")
            }
          }
        }
      }

      // Build updated scheduleData
      const updatedScheduleData = {
        ...scheduleData,
        type: scheduleType,
        weeks: numWeeks,
        time: publishTime,
        days: scheduleType === "weekly" ? selectedDays : undefined,
        mode: contentMode,
        cronExpression: scheduleType === "cron" ? cronExpression : undefined,
        plan: localPlan,
      }

      onSave(updatedScheduleData, wordCount)
    } catch (err: any) {
      alert("Error saving schedule: " + (err.message || err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50">
      <div className="p-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Edit workflow posts
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Changes apply to future scheduled runs only.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings & Week tabs Grid Layout */}
        <div className="w-full mb-6 p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-6">
          {/* SECTION 1.5: Word count range */}
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

          {/* Content mode selection inside expanded panel */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setContentMode("manual")}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                contentMode === "manual" ? "border-purple-600 bg-purple-50/50" : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <FileText className={`w-4 h-4 ${contentMode === "manual" ? "text-purple-600" : "text-gray-400"}`} />
                <span className="font-bold text-xs">Manual Titles</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">Provide exact titles &amp; images.</p>
            </button>
            <button
              onClick={() => setContentMode("auto")}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                contentMode === "auto" ? "border-purple-600 bg-purple-50/50" : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Brain className={`w-4 h-4 ${contentMode === "auto" ? "text-purple-600" : "text-gray-400"}`} />
                <span className="font-bold text-xs">AI Auto-Variations</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">Provide a base topic.</p>
            </button>
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
                <Label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Cron Expression</Label>
                <Input 
                  value={cronExpression} 
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 9 * * 1,3,5" 
                />
                <p className="text-xs text-gray-400">Standard cron syntax: min hour day-of-month month day-of-week</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs text-gray-500 font-bold uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5" /> Publish time
                    </Label>
                    <Input 
                      type="time" 
                      value={publishTime} 
                      onChange={(e) => setPublishTime(e.target.value)}
                      className="w-32 h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Duration (Weeks)</Label>
                    <Select value={numWeeks.toString()} onValueChange={(v) => setNumWeeks(parseInt(v))}>
                      <SelectTrigger className="w-32 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 6, 8].map(w => <SelectItem key={w} value={w.toString()}>{w} {w === 1 ? 'week' : 'weeks'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {scheduleType === "weekly" && (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Days</Label>
                    <div className="flex flex-wrap gap-1">
                      {DAYS.map(day => (
                        <button
                          key={day}
                          onClick={() => {
                            setSelectedDays(prev => 
                              prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                            )
                          }}
                          className={`w-9 h-9 rounded-lg text-xs font-bold border transition-all ${
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

                {/* Workflow Schedule Weeks placed below Active days */}
                <div className="pt-2">
                  <Label className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2 block">
                    Workflow Schedule Weeks
                  </Label>
                  {weeks.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {weeks.map(w => (
                        <button
                          key={w}
                          onClick={() => {
                            setActiveWeek(w)
                            setSelectedDescriptionDay(null)
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border
                                      transition-colors ${
                            activeWeek === w
                              ? "bg-purple-600 text-white border-purple-600"
                              : "border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Week {w.replace("week", "")}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200 w-fit">
                      This workflow is configured for a single week schedule.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Day rows */}
        {scheduleType !== "cron" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(640px,820px)]">
            <div className="space-y-3">
              {orderedDays.map(day => {
                const entry = localPlan[activeWeek]?.[day] || {}
                const isManual = contentMode === "manual"
                const isSelectedDescription = selectedDescriptionDay === day

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDescriptionDay(day)}
                    className={`bg-white border rounded-xl p-4 transition-all cursor-pointer ${
                      isSelectedDescription
                        ? "border-purple-300 ring-2 ring-purple-100"
                        : "border-gray-100 hover:border-purple-200"
                    }`}
                  >
                    <div className="min-w-0">
                    {/* Day header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-10 h-10 rounded-full bg-purple-50 
                                       flex items-center justify-center text-xs 
                                       font-semibold text-purple-700 flex-shrink-0">
                        {day}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <input
                          type="text"
                          value={entry.title || entry.baseTopic || ""}
                          onChange={(e) =>
                            updateEntry(activeWeek, day, "title", e.target.value)
                          }
                          placeholder={`Post title for ${day}...`}
                          className="w-full text-sm font-medium border-b border-transparent 
                                     hover:border-gray-200 focus:border-purple-400 
                                     focus:outline-none py-0.5 bg-transparent"
                        />
                        {!entry.title && entry.baseTopic && (
                          <p className="text-[11px] text-gray-400">
                            Auto generated base topic: {entry.baseTopic}
                          </p>
                        )}
                      </div>
                      {/* Mode badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                        isManual
                          ? "bg-green-50 text-green-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {isManual ? "Manual" : "AI auto"}
                      </span>
                    </div>

                    {/* Keywords + Categories + Tags + Image row */}
                    <div className="flex gap-3 items-start pl-12">
                      {/* Keywords */}
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1 block">
                          Keywords
                        </label>
                        <input
                          type="text"
                          value={entry.keywords || ""}
                          onChange={(e) =>
                            updateEntry(activeWeek, day, "keywords", e.target.value)
                          }
                          placeholder="keyword1, keyword2..."
                          className="w-full text-xs border border-gray-200 rounded-lg 
                                     px-2.5 py-1.5 focus:outline-none 
                                     focus:ring-1 focus:ring-purple-400"
                        />
                      </div>

                      {/* Categories */}
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1 block">
                          Categories
                        </label>
                        <input
                          type="text"
                          value={entry.categories || ""}
                          onChange={(e) =>
                            updateEntry(activeWeek, day, "categories", e.target.value)
                          }
                          placeholder="Tech, Marketing..."
                          className="w-full text-xs border border-gray-200 rounded-lg 
                                     px-2.5 py-1.5 focus:outline-none 
                                     focus:ring-1 focus:ring-purple-400"
                        />
                      </div>

                      {/* Tags */}
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1 block">
                          Tags
                        </label>
                        <input
                          type="text"
                          value={entry.tags || ""}
                          onChange={(e) =>
                            updateEntry(activeWeek, day, "tags", e.target.value)
                          }
                          placeholder="AI, Automation..."
                          className="w-full text-xs border border-gray-200 rounded-lg 
                                     px-2.5 py-1.5 focus:outline-none 
                                     focus:ring-1 focus:ring-purple-400"
                        />
                      </div>

                      <div className="flex-shrink-0">
                        <label className="text-xs text-gray-400 mb-1 block">
                          Image
                        </label>
                        <ImageUploadSlot
                          inputId={`workflow-image-input-${activeWeek}-${day}`}
                          preview={
                            entry.imagePreview ||
                            (entry.imageUrl && entry.imageUrl.startsWith('/') ? `${BASE_URL}${entry.imageUrl}` : entry.imageUrl) ||
                            ""
                          }
                          onSelect={(file) => handleImageSelect(activeWeek, day, file)}
                          size={48}
                        />
                      </div>
                    </div>

                    {/* Description controls */}
                    <div className="mt-3 pl-12">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedDescriptionDay(day)
                            handleGenerateDescription(activeWeek, day, entry)
                          }}
                          disabled={isDescGenerating}
                          className="inline-flex items-center text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-1.5 px-3 rounded"
                        >
                          {isDescGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Brain className="w-3 h-3 mr-1" />}
                          Generate Again
                        </button>
                      </div>
                    </div>
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
                    Week {activeWeek.replace("week", "")} / {selectedDescriptionDay}
                  </span>
                )}
              </div>
              <div>
                {selectedDescriptionDay && selectedDescriptionEntry ? (
                  <>
                    {isDescGenerating && (
                      <div className="mb-2 inline-flex items-center gap-2 text-xs text-gray-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating...
                      </div>
                    )}
                    <div className="h-[600px]">
                      <RichTextEditor
                        content={selectedDescriptionEntry.description || ""}
                        onChange={(html) => updateEntry(activeWeek, selectedDescriptionDay, "description", html)}
                        placeholder={`Generated (~${wordCount} words)`}
                      />
                    </div>

                    {/* SEO Panel */}
                    <div className="mt-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      <button
                        onClick={() => setSeoExpanded(!seoExpanded)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Search className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-gray-800">SEO</span>
                          {isGeneratingSEO && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />}
                          {!isGeneratingSEO && selectedDescriptionEntry.metaDescription && (
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
                              onClick={() => handleGenerateSEO(activeWeek, selectedDescriptionDay, selectedDescriptionEntry)}
                              disabled={isGeneratingSEO || !selectedDescriptionEntry.description}
                              className="w-full text-xs text-purple-600 border border-purple-200 rounded-lg py-2 hover:bg-purple-50 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-colors"
                            >
                              {isGeneratingSEO ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                              {isGeneratingSEO ? "Generating SEO..." : selectedDescriptionEntry.metaDescription ? "Regenerate SEO data" : "Generate SEO data"}
                            </button>
                          </div>

                          {selectedDescriptionEntry.metaDescription && (
                            <>
                              {/* Meta description */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-xs font-medium text-gray-600">Meta description</label>
                                  <span className={`text-xs ${
                                    selectedDescriptionEntry.metaDescription.length > 155 ? "text-red-500"
                                    : selectedDescriptionEntry.metaDescription.length > 140 ? "text-green-600"
                                    : "text-gray-400"
                                  }`}>{selectedDescriptionEntry.metaDescription.length}/155</span>
                                </div>
                                <textarea
                                  value={selectedDescriptionEntry.metaDescription}
                                  onChange={(e) => updateEntry(activeWeek, selectedDescriptionDay, "metaDescription", e.target.value)}
                                  rows={2}
                                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
                                />
                              </div>

                              {/* SEO title */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-xs font-medium text-gray-600">SEO title</label>
                                  <span className={`text-xs ${
                                    selectedDescriptionEntry.seoTitle.length > 60 ? "text-red-500"
                                    : selectedDescriptionEntry.seoTitle.length > 50 ? "text-green-600"
                                    : "text-gray-400"
                                  }`}>{selectedDescriptionEntry.seoTitle.length}/60</span>
                                </div>
                                <input
                                  type="text"
                                  value={selectedDescriptionEntry.seoTitle}
                                  onChange={(e) => updateEntry(activeWeek, selectedDescriptionDay, "seoTitle", e.target.value)}
                                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                />
                                {/* Google preview */}
                                <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                  <p className="text-xs text-gray-400 mb-1">Google preview</p>
                                  <p className="text-sm text-blue-700 font-medium leading-tight">{selectedDescriptionEntry.seoTitle || selectedDescriptionEntry.title}</p>
                                  <p className="text-xs text-green-700 mt-0.5">yourdomain.com/{selectedDescriptionEntry.slug}</p>
                                  <p className="text-xs text-gray-600 mt-0.5 leading-tight">
                                    {selectedDescriptionEntry.metaDescription.substring(0, 120)}{selectedDescriptionEntry.metaDescription.length > 120 ? "..." : ""}
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
                                    value={selectedDescriptionEntry.slug}
                                    onChange={(e) => updateEntry(activeWeek, selectedDescriptionDay, "slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))}
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
                                          updateEntry(activeWeek, selectedDescriptionDay, "focusKeyword", value)
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
                                          value={activeKeywordType === "custom" ? (selectedDescriptionEntry.focusKeyword || "") : ""}
                                          onChange={(e) => {
                                            setActiveKeywordType("custom")
                                            updateEntry(activeWeek, selectedDescriptionDay, "focusKeyword", e.target.value)
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
                                  {selectedDensity && selectedDescriptionEntry.focusKeyword && (
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
                                      value={selectedDescriptionEntry.focusKeyword || ""}
                                      onChange={(e) => updateEntry(activeWeek, selectedDescriptionDay, "focusKeyword", e.target.value)}
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
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
            This workflow schedule is currently set to Cron mode. Under Cron mode, posts are dynamically generated on-demand at execution time, so a weekly pre-planned preview is not available.
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 
                       rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white 
                       rounded-lg hover:bg-purple-700 disabled:opacity-40 
                       flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" 
                          strokeWidth="3" strokeDasharray="30 70"/>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
