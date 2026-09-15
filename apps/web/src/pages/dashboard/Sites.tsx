import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, CheckCircle, XCircle, Loader2, Globe, Share2, X } from "lucide-react"
import { fetchSites, testSiteConnection, connectSite, deleteSite } from "@/lib/api"
import SocialPlatformCard from "@/components/sites/SocialPlatformCard"
import { SETUP_GUIDES } from "./SiteSocial"

interface Site {
  id: string
  name: string
  url: string
  platform: string
  status: string
  createdAt?: string
  tokenExpiringSoon?: boolean
  expiresInDays?: number
  expiringPlatform?: string
  socialAccounts?: {
    platform: string
    accountName: string
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

const SOCIAL_PLATFORMS = [
  {
    id: "FACEBOOK",
    name: "Facebook page",
    icon: "ti-brand-facebook",
    color: "#185FA5",
    bgColor: "#E6F1FB",
    free: true,
    fields: [
      {
        key: "pageId",
        label: "Page ID",
        placeholder: "123456789012345",
        help: "Found in Facebook Page → About → Page transparency"
      },
      {
        key: "pageAccessToken",
        label: "Page Access Token",
        placeholder: "EAABs...",
        secret: true,
        help: "Get from Meta Business Suite → Graph API Explorer"
      }
    ],
    helpUrl: "https://developers.facebook.com/tools/explorer",
    helpText: "Get token from Graph API Explorer",
  },
  {
    id: "INSTAGRAM",
    name: "Instagram business",
    icon: "ti-brand-instagram",
    color: "#993556",
    bgColor: "#FBEAF0",
    free: true,
    note: "Requires Instagram linked to a Facebook Page. Image required for all posts.",
    fields: [
      {
        key: "igAccountId",
        label: "Instagram account ID",
        placeholder: "17841400000000000",
        help: "GET /{page-id}?fields=instagram_business_account via Graph API"
      },
      {
        key: "pageAccessToken",
        label: "Page Access Token",
        placeholder: "EAABs... (same as Facebook token)",
        secret: true,
        help: "Use the same token from your connected Facebook Page"
      }
    ],
    helpUrl: "https://developers.facebook.com/docs/instagram-api",
    helpText: "Instagram API docs",
  },
  {
    id: "LINKEDIN",
    name: "LinkedIn",
    icon: "ti-brand-linkedin",
    color: "#185FA5",
    bgColor: "#E6F1FB",
    free: true,
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "AQV...",
        secret: true,
        help: "Generate from LinkedIn Developer OAuth Token Generator"
      },
      {
        key: "personUrn",
        label: "Person URN",
        placeholder: "urn:li:person:abc123",
        help: "Found in your LinkedIn profile URL or via /v2/userinfo"
      }
    ],
    helpUrl: "https://www.linkedin.com/developers/tools/oauth/token-generator",
    helpText: "Generate token",
  },
  {
    id: "TWITTER",
    name: "X (Twitter)",
    icon: "ti-brand-x",
    color: "#2C2C2A",
    bgColor: "#F1EFE8",
    free: false,
    paidNote: "Requires $100/month Basic API plan",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "xxxxxxxxxxxxxxxxx",
        secret: true,
      },
      {
        key: "apiSecret",
        label: "API Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
      },
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "000000000-xxxxxxxxxxxxxxxx",
        secret: true,
      },
      {
        key: "accessTokenSecret",
        label: "Access Token Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
      }
    ],
    helpUrl: "https://developer.twitter.com/en/portal/dashboard",
    helpText: "X Developer Portal",
  },
  {
    id: "THREADS",
    name: "Threads",
    icon: "ti-brand-threads",
    color: "#000000",
    bgColor: "#F0F0F0",
    free: true,
    fields: [
      {
        key: "accessToken",
        label: "Threads Access Token",
        placeholder: "TH...",
        secret: true,
        help: "Generate from Meta Developer Portal (Threads API)"
      },
      {
        key: "threadsUserId",
        label: "Threads User ID / Username",
        placeholder: "e.g. mythreadsbrand",
        help: "Your Threads User ID or Username"
      }
    ],
    helpUrl: "https://developers.facebook.com/docs/threads",
    helpText: "Threads API Docs",
  },
  {
    id: "YOUTUBE",
    name: "YouTube",
    icon: "ti-brand-youtube",
    color: "#FF0000",
    bgColor: "#FFEBEB",
    free: true,
    fields: [
      {
        key: "accessToken",
        label: "OAuth Access Token",
        placeholder: "ya29...",
        secret: true,
        help: "Google OAuth 2.0 Access Token with YouTube Upload permissions"
      },
      {
        key: "channelId",
        label: "YouTube Channel ID",
        placeholder: "UCxxxxxxxxxxxxxxxxxxxxxx",
        help: "Your YouTube Channel ID"
      }
    ],
    helpUrl: "https://developers.google.com/youtube/v3",
    helpText: "YouTube API Console",
  },
]

function getSocialAccountName(
  platform: string,
  creds: Record<string, string>
): string {
  switch (platform) {
    case "FACEBOOK":
      return `Facebook Page ${creds.pageId || ""}`.trim()
    case "INSTAGRAM":
      return `Instagram ${creds.igAccountId || ""}`.trim()
    case "LINKEDIN":
      return creds.personUrn || "LinkedIn Account"
    case "TWITTER":
      return "X Account"
    case "THREADS":
      return `@${creds.threadsUserId || "Threads Account"}`
    case "YOUTUBE":
      return `YouTube Channel ${creds.channelId || ""}`.trim()
    default:
      return platform
  }
}

function SiteCard({ site, onDisconnect }: { site: Site; onDisconnect: () => void }) {
  const navigate = useNavigate()
  const platformColors: Record<string, string> = {
    WORDPRESS: "bg-blue-100 text-blue-800",
    NEXTJS: "bg-gray-800 text-white"
  }

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-500",
    INACTIVE: "bg-gray-400",
    ERROR: "bg-red-500"
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{site.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{site.url}</p>

          {site.tokenExpiringSoon && (
            <div className="mt-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-200">
              <span className="mr-1">⚠️</span> 
              {PLATFORM_CONFIG[site.expiringPlatform || ""]?.label || site.expiringPlatform} token expires in {site.expiresInDays} days — update in settings
            </div>
          )}
          {site.socialAccounts && site.socialAccounts.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-xs text-gray-400">Social:</span>
              {site.socialAccounts.map((account: any) => (
                <div
                  key={account.platform}
                  title={account.accountName}
                  className="w-5 h-5 rounded flex items-center justify-center"
                  style={{ background: PLATFORM_CONFIG[account.platform]?.bgColor }}
                >
                  <i
                    className={`ti ${PLATFORM_CONFIG[account.platform]?.icon} text-xs`}
                    style={{ color: PLATFORM_CONFIG[account.platform]?.color }}
                    aria-hidden="true"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[site.status] || 'bg-gray-400'}`} />
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${platformColors[site.platform] || 'bg-gray-100 text-gray-800'}`}>
            {site.platform ? site.platform.charAt(0) + site.platform.slice(1).toLowerCase() : 'Unknown'}
          </span>
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Status</span>
          <span className="font-medium text-gray-900">{site.status ? site.status.charAt(0) + site.status.slice(1).toLowerCase() : 'Unknown'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Connected</span>
          <span className="font-medium text-gray-900">
            {site.createdAt ? new Date(site.createdAt).toLocaleDateString() : 'Unknown'}
          </span>
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => navigate(`/dashboard/sites/${site.id}/edit`)}
          className="flex-1 px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 transition-colors"
        >
          Edit Site
        </button>
        <button
          onClick={() => navigate(`/dashboard/sites/${site.id}/social`)}
          className="flex-1 px-3 py-2 border border-purple-300 text-sm font-medium rounded-md text-purple-700 bg-white hover:bg-purple-50 transition-colors"
        >
          Social Media
        </button>
        <button 
          onClick={onDisconnect}
          className="flex-1 px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  )
}

function ConnectSiteModal({ isOpen, onClose, onConnect }: { isOpen: boolean; onClose: () => void; onConnect: () => void }) {
  const [activeTab, setActiveTab] = useState<"WordPress" | "NextJS">("WordPress")
  const [formData, setFormData] = useState({
    siteUrl: "",
    username: "",
    appPassword: "",
    cmsType: "Contentful",
    apiUrl: "",
    apiToken: ""
  })
  const [socialCredentials, setSocialCredentials] = useState<
    Record<string, Record<string, string>>
  >({})
  const [isTesting, setIsTesting] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [guidePlatform, setGuidePlatform] = useState<string | null>(null)

  if (!isOpen) return null

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    
    try {
      const result = await testSiteConnection({
        url: formData.siteUrl,
        platform: activeTab.toUpperCase() as "WORDPRESS" | "NEXTJS",
        credentials: activeTab === "WordPress" 
          ? { username: formData.username, appPassword: formData.appPassword }
          : { cmsType: formData.cmsType, apiUrl: formData.apiUrl, apiToken: formData.apiToken }
      })
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, message: "Connection test failed" })
    } finally {
      setIsTesting(false)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    
    try {
      const socialPlatforms = Object.entries(socialCredentials)
        .filter(([_, creds]) =>
          Object.values(creds).some(v => v?.trim())
        )
        .map(([platform, creds]) => ({
          platform,
          credentials: creds,
          accountName: getSocialAccountName(platform, creds),
        }))

      const result = await connectSite({
        name: formData.siteUrl.split("//")[1]?.split("/")[0] || "New Site",
        url: formData.siteUrl,
        platform: activeTab.toUpperCase(),
        credentials: activeTab === "WordPress" 
          ? { username: formData.username, appPassword: formData.appPassword }
          : { cmsType: formData.cmsType, apiUrl: formData.apiUrl, apiToken: formData.apiToken },
        socialPlatforms,
      })
      
      if (result.success) {
        onConnect()
        onClose()
      }
    } catch (error) {
      console.error('Error connecting site:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Connect New Site</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("WordPress")}
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              activeTab === "WordPress"
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            WordPress
          </button>
          <button
            onClick={() => setActiveTab("NextJS")}
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              activeTab === "NextJS"
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Next.js
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site URL
            </label>
            <input
              type="url"
              placeholder="https://myblog.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={formData.siteUrl}
              onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
            />
          </div>

          {activeTab === "WordPress" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WordPress Username
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Application Password
                </label>
                <input
                  type="password"
                  placeholder="Generate in WordPress → Users → Profile → Application Passwords"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.appPassword}
                  onChange={(e) => setFormData({ ...formData, appPassword: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Generate in WordPress → Users → Profile → Application Passwords
                </p>
              </div>
              <button 
                onClick={handleTestConnection}
                disabled={isTesting || !formData.siteUrl || (activeTab === "WordPress" && (!formData.username || !formData.appPassword))}
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
                <div className={`flex items-center p-2 rounded-md text-sm ${testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  {testResult.message}
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CMS Type
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.cmsType}
                  onChange={(e) => setFormData({ ...formData, cmsType: e.target.value })}
                >
                  <option value="Contentful">Contentful</option>
                  <option value="Sanity">Sanity</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API URL
                </label>
                <input
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.apiUrl}
                  onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Token
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.apiToken}
                  onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                />
              </div>
            </>
          )}
        </div>

        {/* Section 2: Social media credentials */}
        {formData.siteUrl && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-medium text-gray-900">
                Connect social media
              </h3>
              <span className="text-xs text-gray-400 font-normal ml-1">
                optional
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Connect the social platforms where you want to share posts 
              from <span className="font-medium text-gray-600">{formData.siteUrl}</span>
            </p>

            {/* Platform accordion cards */}
            {SOCIAL_PLATFORMS.map(platform => (
              <SocialPlatformCard
                key={platform.id}
                platform={platform}
                credentials={socialCredentials[platform.id]}
                onChange={(creds) => setSocialCredentials(prev => ({
                  ...prev,
                  [platform.id]: creds
                }))}
                onViewGuide={() => setGuidePlatform(platform.id)}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect Site"
            )}
          </button>
        </div>
      </div>

      {/* Setup Guide Modal */}
      {guidePlatform && SETUP_GUIDES[guidePlatform] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: PLATFORM_CONFIG[guidePlatform]?.bgColor }}>
                  <i className={`ti ${PLATFORM_CONFIG[guidePlatform]?.icon} text-base`} style={{ color: PLATFORM_CONFIG[guidePlatform]?.color }} />
                </div>
                {SETUP_GUIDES[guidePlatform].title}
              </h3>
              <button onClick={() => setGuidePlatform(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <ol className="space-y-5">
                {SETUP_GUIDES[guidePlatform].steps.map((step, idx) => (
                  <li key={idx} className="flex gap-4 text-sm text-gray-600">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium text-xs mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button 
                onClick={() => setGuidePlatform(null)}
                className="w-full bg-primary-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                Got it, close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Sites() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadSites = async () => {
    setIsLoading(true)
    try {
      const data = await fetchSites()
      if (data.success) {
        setSites(data.data)
      }
    } catch (error) {
      console.error('Error fetching sites:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSites()
  }, [])

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this site?')) return
    
    try {
      await deleteSite(id)
      loadSites()
    } catch (error) {
      console.error('Error disconnecting site:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Connected Sites</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Connect New Site
        </button>
      </div>

      {/* Sites Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-2 mb-4">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
              <div className="flex space-x-2">
                <div className="flex-1 h-8 bg-gray-200 rounded"></div>
                <div className="flex-1 h-8 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : sites.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Globe className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sites connected yet</h3>
          <p className="text-gray-600 mb-4">Connect your first site to start automating your blog content.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Connect New Site
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} onDisconnect={() => handleDisconnect(site.id)} />
          ))}
        </div>
      )}

      {/* Connect Site Modal */}
      <ConnectSiteModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onConnect={loadSites}
      />
    </div>
  )
}
