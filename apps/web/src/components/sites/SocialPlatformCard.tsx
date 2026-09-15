import { useState, useEffect } from "react"
import { ChevronDown, AlertCircle, ExternalLink, Loader2, CheckCircle2, XCircle, Wifi } from "lucide-react"
import { api } from "../../lib/api"

interface SocialPlatformCardProps {
  platform: {
    id: string
    name: string
    icon: string
    color: string
    bgColor: string
    free: boolean
    paidNote?: string
    note?: string
    fields: {
      key: string
      label: string
      placeholder: string
      secret?: boolean
      help?: string
    }[]
    helpUrl: string
    helpText: string
  }
  credentials: Record<string, string>
  onChange: (creds: Record<string, string>) => void
  onViewGuide?: () => void
}

export default function SocialPlatformCard({
  platform,
  credentials,
  onChange,
  onViewGuide,
}: SocialPlatformCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectedName, setDetectedName] = useState<string | null>(null)
  const [fbError, setFbError] = useState<string | null>(null)
  const [testState, setTestState] = useState<{ status: "idle" | "loading" | "success" | "error"; message: string }>({ status: "idle", message: "" })
  const [fbPages, setFbPages] = useState<{ id: string; name: string; access_token: string }[] | null>(null)
  const [isFetchingPages, setIsFetchingPages] = useState(false)
  const [igDetecting, setIgDetecting] = useState(false)
  const [igDetectedId, setIgDetectedId] = useState<string | null>(null)
  const [threadsDetecting, setThreadsDetecting] = useState(false)
  const [threadsDetectedId, setThreadsDetectedId] = useState<string | null>(null)
  const isConnected = Object.values(credentials || {}).some(v => v?.trim())

  useEffect(() => {
    if (platform.id === "FACEBOOK") {
      const searchParams = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const error =
        searchParams.get("error_description") ||
        searchParams.get("error_message") ||
        searchParams.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error")

      if (error) {
        const decodedError = decodeURIComponent(error)
        if (decodedError.includes("App Not Set Up") || decodedError.includes("does not have permission")) {
          setFbError("This app is in development mode. Contact AutoBlog support to be added as a tester, or check back soon for general availability.")
        } else {
          setFbError(decodedError)
        }
        setExpanded(true)
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }
  }, [platform.id])

  // LinkedIn: auto-detect Person URN
  const handleLinkedInAutoDetect = async () => {
    const token = credentials["accessToken"]
    if (!token) { alert("Please enter your Access Token first."); return }
    setIsDetecting(true)
    setDetectedName(null)
    try {
      const res = await api.post("/api/social/linkedin/profile", { accessToken: token })
      if (res.data.success) {
        onChange({ ...credentials, personUrn: res.data.data.personUrn })
        setDetectedName(res.data.data.name)
      }
    } catch {
      alert("Failed to auto-detect LinkedIn profile. Check your access token.")
    } finally {
      setIsDetecting(false)
    }
  }

  // Facebook: fetch pages from User Access Token, then let user pick one
  const handleFetchFbPages = async () => {
    const token = credentials["pageAccessToken"]
    if (!token) { alert("Paste your User Access Token into the Page Access Token field first."); return }
    setIsFetchingPages(true)
    setFbPages(null)
    try {
      const res = await api.post("/api/social/facebook/pages", { userAccessToken: token })
      if (res.data.success && res.data.data.length > 0) {
        setFbPages(res.data.data)
      } else {
        alert("No Facebook pages found for this token.")
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to fetch Facebook pages.")
    } finally {
      setIsFetchingPages(false)
    }
  }

  // Facebook: select a page from fetched list
  const handleSelectFbPage = (page: { id: string; name: string; access_token: string }) => {
    onChange({ ...credentials, pageId: page.id, pageAccessToken: page.access_token })
    setFbPages(null)
  }

  // Instagram: auto-detect account ID from page access token
  const handleInstagramAutoDetect = async () => {
    const token = credentials["pageAccessToken"]
    if (!token) { alert("Please enter your Page Access Token first."); return }
    setIgDetecting(true)
    setIgDetectedId(null)
    try {
      const res = await api.post("/api/social/instagram/auto-detect", { pageAccessToken: token })
      if (res.data.success) {
        onChange({ ...credentials, igAccountId: res.data.data.igAccountId })
        setIgDetectedId(res.data.data.igAccountId)
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Could not detect Instagram account. Ensure your page is linked to an Instagram Business Account.")
    } finally {
      setIgDetecting(false)
    }
  }

  // Threads: auto-detect user ID from access token
  const handleThreadsAutoDetect = async () => {
    const token = credentials["accessToken"]
    if (!token) { alert("Please enter your Threads Access Token first."); return }
    setThreadsDetecting(true)
    setThreadsDetectedId(null)
    try {
      const res = await api.post("/api/social/threads/auto-detect", { accessToken: token })
      if (res.data.success) {
        onChange({ ...credentials, threadsUserId: res.data.data.username || res.data.data.id })
        setThreadsDetectedId(res.data.data.username || res.data.data.id)
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Could not detect Threads account. Ensure your access token is correct.")
    } finally {
      setThreadsDetecting(false)
    }
  }

  // Test connection
  const handleTestConnection = async () => {
    setTestState({ status: "loading", message: "" })
    try {
      const res = await api.post("/api/social/test", { platform: platform.id, credentials })
      setTestState({ status: "success", message: res.data.message })
    } catch (err: any) {
      setTestState({ status: "error", message: err.response?.data?.error || "Connection failed" })
    }
  }

  const handleFacebookOAuth = () => {
    setFbError(null)
    const clientId = "YOUR_FB_APP_ID"
    const redirectUri = window.location.href.split("?")[0].split("#")[0]
    const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=pages_show_list,pages_read_engagement,pages_manage_posts`
    window.location.href = oauthUrl
  }

  return (
    <div className={`border rounded-xl mb-2 transition-all ${isConnected ? "border-purple-200 bg-purple-50/30" : "border-gray-100 bg-white"}`}>

      {/* Card header — click to expand */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: platform.bgColor }}>
          <i className={`ti ${platform.icon} text-base`} style={{ color: platform.color }} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{platform.name}</span>
            {!platform.free && (
              <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full">{platform.paidNote}</span>
            )}
            {isConnected && (
              <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Credentials added
              </span>
            )}
          </div>
          {platform.note && !expanded && (
            <p className="text-xs text-amber-600 mt-0.5">{platform.note}</p>
          )}
        </div>

        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-3">
          {/* Platform note */}
          {platform.note && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{platform.note}</p>
            </div>
          )}

          {/* Facebook dev mode error */}
          {fbError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">
                {fbError.includes("development mode")
                  ? "This app is currently in development mode. If you'd like to test Facebook/Instagram sharing, contact the AutoBlog team to be added as a tester. This feature will be available to all users soon."
                  : fbError}
              </p>
            </div>
          )}

          {/* Fields */}
          {platform.fields.map(field => (
            <div key={field.key} className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-500">{field.label}</label>
                <div className="flex items-center gap-1">
                  {/* LinkedIn: auto-detect Person URN */}
                  {platform.id === "LINKEDIN" && field.key === "personUrn" && (
                    <button type="button" onClick={handleLinkedInAutoDetect} disabled={isDetecting}
                      className="text-[10px] bg-purple-50 text-purple-600 hover:bg-purple-100 px-2 py-0.5 rounded font-medium disabled:opacity-50 flex items-center gap-1">
                      {isDetecting && <Loader2 className="w-3 h-3 animate-spin" />}
                      Auto-detect
                    </button>
                  )}
                  {/* Facebook: fetch pages from token */}
                  {platform.id === "FACEBOOK" && field.key === "pageId" && (
                    <button type="button" onClick={handleFetchFbPages} disabled={isFetchingPages}
                      className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded font-medium disabled:opacity-50 flex items-center gap-1">
                      {isFetchingPages ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {isFetchingPages ? "Fetching..." : "Fetch from Token"}
                    </button>
                  )}
                  {/* Facebook: OAuth hint button */}
                  {platform.id === "FACEBOOK" && field.key === "pageAccessToken" && (
                    <button type="button" onClick={handleFacebookOAuth}
                      className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                      Connect via OAuth
                    </button>
                  )}
                  {/* Instagram: auto-detect account ID */}
                  {platform.id === "INSTAGRAM" && field.key === "igAccountId" && (
                    <button type="button" onClick={handleInstagramAutoDetect} disabled={igDetecting}
                      className="text-[10px] bg-pink-50 text-pink-600 hover:bg-pink-100 px-2 py-0.5 rounded font-medium disabled:opacity-50 flex items-center gap-1">
                      {igDetecting && <Loader2 className="w-3 h-3 animate-spin" />}
                      Auto-detect
                    </button>
                  )}
                  {/* Threads: auto-detect user ID */}
                  {platform.id === "THREADS" && field.key === "threadsUserId" && (
                    <button type="button" onClick={handleThreadsAutoDetect} disabled={threadsDetecting}
                      className="text-[10px] bg-purple-50 text-purple-600 hover:bg-purple-100 px-2 py-0.5 rounded font-medium disabled:opacity-50 flex items-center gap-1">
                      {threadsDetecting && <Loader2 className="w-3 h-3 animate-spin" />}
                      Auto-detect
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <input
                  type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                  value={credentials?.[field.key] || ""}
                  onChange={(e) => onChange({ ...credentials, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-400 pr-8"
                />
                {field.secret && (
                  <button type="button"
                    onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <i className={`ti ${showSecrets[field.key] ? "ti-eye-off" : "ti-eye"} text-sm`} />
                  </button>
                )}
              </div>

              {/* Detected hints */}
              {platform.id === "LINKEDIN" && field.key === "personUrn" && detectedName && (
                <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Detected: {detectedName}
                </p>
              )}
              {platform.id === "INSTAGRAM" && field.key === "igAccountId" && igDetectedId && (
                <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Detected ID: {igDetectedId}
                </p>
              )}
              {platform.id === "THREADS" && field.key === "threadsUserId" && threadsDetectedId && (
                <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Detected ID: {threadsDetectedId}
                </p>
              )}
              {field.help && <p className="text-xs text-gray-400 mt-1">{field.help}</p>}
            </div>
          ))}

          {/* Facebook pages picker dropdown */}
          {fbPages && fbPages.length > 0 && (
            <div className="mb-3 border border-blue-100 rounded-lg overflow-hidden">
              <p className="text-xs font-medium text-blue-700 bg-blue-50 px-3 py-2 border-b border-blue-100">
                Select a page to auto-fill:
              </p>
              {fbPages.map(page => (
                <button key={page.id} type="button" onClick={() => handleSelectFbPage(page)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between group">
                  <span className="font-medium text-gray-700">{page.name}</span>
                  <span className="text-gray-400 group-hover:text-blue-600 text-[10px]">ID: {page.id}</span>
                </button>
              ))}
            </div>
          )}

          {/* Test Connection button + result */}
          {isConnected && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleTestConnection} disabled={testState.status === "loading"}
                  className="flex items-center gap-1.5 text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors disabled:opacity-60">
                  {testState.status === "loading"
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Wifi className="w-3.5 h-3.5" />}
                  {testState.status === "loading" ? "Testing..." : "Test Connection"}
                </button>
                {testState.status === "success" && (
                  <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {testState.message}
                  </span>
                )}
                {testState.status === "error" && (
                  <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                    <XCircle className="w-3.5 h-3.5" /> {testState.message}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Footer: help link & guide */}
          <div className="flex items-center justify-between mt-4">
            <a href={platform.helpUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline">
              <ExternalLink className="w-3 h-3" />
              {platform.helpText}
            </a>
            <div className="flex items-center gap-2">
              {isConnected && (
                <button type="button" onClick={() => onChange({})} className="text-xs text-red-400 hover:text-red-600">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => onViewGuide?.()}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors">
                View Setup Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
