import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, CheckCircle, XCircle, Globe, Save } from "lucide-react"
import { api } from "@/lib/api"

interface SiteDetail {
  id: string
  name: string
  url: string
  platform: string
  status: string
  createdAt?: string
  socialAccounts?: {
    id: string
    platform: string
    accountName: string
    createdAt: string
  }[]
}

export default function EditSite() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [site, setSite] = useState<SiteDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    url: "",
    username: "",
    appPassword: "",
    cmsType: "Contentful",
    apiUrl: "",
    apiToken: "",
  })

  useEffect(() => {
    loadSite()
  }, [id])

  const loadSite = async () => {
    try {
      const res = await api.get(`/api/sites/${id}`)
      if (res.data.success) {
        const s = res.data.data
        setSite(s)
        setFormData(prev => ({
          ...prev,
          name: s.name,
          url: s.url,
        }))
      }
    } catch (err) {
      console.error("Error loading site:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await api.post("/api/sites/test", {
        url: formData.url,
        platform: site?.platform,
        credentials:
          site?.platform === "WORDPRESS"
            ? { username: formData.username, appPassword: formData.appPassword }
            : { cmsType: formData.cmsType, apiUrl: formData.apiUrl, apiToken: formData.apiToken },
      })
      setTestResult({ success: true, message: res.data.message || "Connection successful" })
    } catch (err: any) {
      setTestResult({ success: false, message: err?.response?.data?.error || "Connection test failed" })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveResult(null)
    try {
      const payload: any = {
        name: formData.name,
        url: formData.url,
      }

      // Only include credentials if user filled them in (optional update)
      if (site?.platform === "WORDPRESS" && formData.username && formData.appPassword) {
        payload.credentials = { username: formData.username, appPassword: formData.appPassword }
      } else if (site?.platform === "NEXTJS" && formData.apiUrl && formData.apiToken) {
        payload.credentials = { cmsType: formData.cmsType, apiUrl: formData.apiUrl, apiToken: formData.apiToken }
      }

      const res = await api.put(`/api/sites/${id}`, payload)
      if (res.data.success) {
        setSaveResult({ success: true, message: "Site updated successfully!" })
        setTimeout(() => navigate("/dashboard/sites"), 1500)
      } else {
        setSaveResult({ success: false, message: res.data.error || "Failed to update site" })
      }
    } catch (err: any) {
      setSaveResult({ success: false, message: err?.response?.data?.error || "Failed to save" })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!site) {
    return (
      <div className="text-center py-20">
        <Globe className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Site not found</h3>
        <button onClick={() => navigate("/dashboard/sites")} className="text-primary-600 hover:underline">
          Back to Sites
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard/sites")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Site</h1>
          <p className="text-sm text-gray-500">{site.url}</p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
        {/* Site Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        {/* Site URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Site URL</label>
          <input
            type="url"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={formData.url}
            onChange={e => setFormData({ ...formData, url: e.target.value })}
          />
        </div>

        {/* Platform badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Platform:</span>
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
            site.platform === "WORDPRESS" ? "bg-blue-100 text-blue-800" : "bg-gray-800 text-white"
          }`}>
            {site.platform === "WORDPRESS" ? "WordPress" : "Next.js"}
          </span>
        </div>

        {/* Credentials section */}
        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Update Credentials <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
          </h3>

          {site.platform === "WORDPRESS" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WordPress Username</label>
                <input
                  type="text"
                  placeholder="Leave blank to keep current"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Application Password</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.appPassword}
                  onChange={e => setFormData({ ...formData, appPassword: e.target.value })}
                />
              </div>

              {/* Test Connection */}
              <button
                onClick={handleTestConnection}
                disabled={isTesting || !formData.username || !formData.appPassword}
                className="w-full px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </button>

              {testResult && (
                <div className={`flex items-center p-3 rounded-md text-sm ${testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                  {testResult.success ? <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" /> : <XCircle className="h-4 w-4 mr-2 flex-shrink-0" />}
                  {testResult.message}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CMS Type</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.cmsType}
                  onChange={e => setFormData({ ...formData, cmsType: e.target.value })}
                >
                  <option value="Contentful">Contentful</option>
                  <option value="Sanity">Sanity</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
                <input
                  type="url"
                  placeholder="Leave blank to keep current"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.apiUrl}
                  onChange={e => setFormData({ ...formData, apiUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.apiToken}
                  onChange={e => setFormData({ ...formData, apiToken: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Connected Social Accounts summary */}
        {site.socialAccounts && site.socialAccounts.length > 0 && (
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Connected Social Accounts</h3>
            <div className="space-y-2">
              {site.socialAccounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                  <span className="text-sm text-gray-700">{acc.platform} — {acc.accountName}</span>
                  <span className="text-xs text-gray-400">{new Date(acc.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate(`/dashboard/sites/${id}/social`)}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Manage Social Accounts →
            </button>
          </div>
        )}

        {/* Save result */}
        {saveResult && (
          <div className={`flex items-center p-3 rounded-md text-sm ${saveResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {saveResult.success ? <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" /> : <XCircle className="h-4 w-4 mr-2 flex-shrink-0" />}
            {saveResult.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3 pt-2">
          <button
            onClick={() => navigate("/dashboard/sites")}
            className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !formData.name || !formData.url}
            className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
