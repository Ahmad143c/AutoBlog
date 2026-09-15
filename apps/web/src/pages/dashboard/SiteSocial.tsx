import React, { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, CheckCircle, XCircle, Share2, Trash2, Plus, Edit, X } from "lucide-react"
import { api } from "@/lib/api"
import SocialPlatformCard from "@/components/sites/SocialPlatformCard"

interface SocialAccount {
  id: string
  platform: string
  accountName: string
  createdAt: string
  credentials?: Record<string, string>
}

interface SiteDetail {
  id: string
  name: string
  url: string
  platform: string
  status: string
  socialAccounts?: SocialAccount[]
}

const PLATFORM_CONFIG: Record<string, { icon: string; color: string; bgColor: string; label: string }> = {
  FACEBOOK:  { icon: "ti-brand-facebook",  color: "#185FA5", bgColor: "#E6F1FB", label: "Facebook" },
  INSTAGRAM: { icon: "ti-brand-instagram", color: "#993556", bgColor: "#FBEAF0", label: "Instagram" },
  LINKEDIN:  { icon: "ti-brand-linkedin",  color: "#0C447C", bgColor: "#E6F1FB", label: "LinkedIn" },
  TWITTER:   { icon: "ti-brand-x",         color: "#2C2C2A", bgColor: "#F1EFE8", label: "X (Twitter)" },
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
        key: "pageAccessToken",
        label: "User / Page Access Token",
        placeholder: "EAABs...",
        secret: true,
        help: "Paste your token here, then click 'Fetch from Token' on the Page ID field to auto-fill."
      },
      {
        key: "pageId",
        label: "Page ID",
        placeholder: "Auto-filled after fetching — or enter manually",
        help: "Click 'Fetch from Token' to auto-populate from your token."
      },
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
        key: "pageAccessToken",
        label: "Page Access Token",
        placeholder: "EAABs... (same as your Facebook Page token)",
        secret: true,
        help: "Use your Facebook Page Access Token. Then click 'Auto-detect' to fill your Instagram Account ID."
      },
      {
        key: "igAccountId",
        label: "Instagram Account ID",
        placeholder: "Auto-filled — or enter manually (e.g. 17841400000000000)",
        help: "Click 'Auto-detect' to fetch automatically from your linked Facebook page."
      },
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
      { key: "accessToken", label: "Access Token", placeholder: "AQV...", secret: true, help: "Generate from LinkedIn Developer OAuth Token Generator" },
      { key: "personUrn", label: "Person URN", placeholder: "urn:li:person:abc123", help: "Found in your LinkedIn profile URL or via /v2/userinfo" },
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
      { key: "apiKey", label: "API Key", placeholder: "xxxxxxxxxxxxxxxxx", secret: true },
      { key: "apiSecret", label: "API Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
      { key: "accessToken", label: "Access Token", placeholder: "000000000-xxxxxxxxxxxxxxxx", secret: true },
      { key: "accessTokenSecret", label: "Access Token Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
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
      { key: "accessToken", label: "Threads Access Token", placeholder: "TH...", secret: true, help: "Generate from Meta Developer Portal (Threads API)" },
      { key: "threadsUserId", label: "Threads User ID / Username", placeholder: "e.g. mythreadsbrand", help: "Your Threads User ID or Username" },
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
      { key: "accessToken", label: "OAuth Access Token", placeholder: "ya29...", secret: true, help: "Google OAuth 2.0 Access Token with YouTube Upload permissions" },
      { key: "channelId", label: "YouTube Channel ID", placeholder: "UCxxxxxxxxxxxxxxxxxxxxxx", help: "Your YouTube Channel ID" },
    ],
    helpUrl: "https://developers.google.com/youtube/v3",
    helpText: "YouTube API Console",
  },
]

export const SETUP_GUIDES: Record<string, { title: string, steps: React.ReactNode[] }> = {
  FACEBOOK: {
    title: "How to connect a Facebook Page",
    steps: [
      <><strong>Step 1 — Get your User Access Token:</strong> Go to the <a href="https://developers.facebook.com/tools/explorer" target="_blank" className="text-primary-600 underline font-medium">Meta Graph API Explorer</a>. In the <strong>Permissions</strong> box add <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">pages_show_list</code>, <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">pages_read_engagement</code>, and <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">pages_manage_posts</code>. Click <strong>Generate Access Token</strong>.</>,
      <><strong>Step 2 — Extend the token (optional but recommended):</strong> Click the <strong>info icon</strong> next to the token → <strong>Open in Access Token Tool</strong> → <strong>Extend Access Token</strong> to get a 60-day token.</>,
      <><strong>Step 3 — Auto-fill in AutoBlog:</strong> Paste the token into the <strong>User / Page Access Token</strong> field, then click <strong>Fetch from Token</strong> next to Page ID. Select your page from the list — AutoBlog will fill both the Page ID and a never-expiring Page Access Token automatically.</>,
      <><em>Note: If you see a development mode error, contact the AutoBlog team to be added as a tester.</em></>
    ]
  },
  INSTAGRAM: {
    title: "How to connect an Instagram Business Account",
    steps: [
      <><strong>Step 1 — Prepare your Instagram account:</strong> Ensure it is set to a <strong>Professional (Business/Creator) Account</strong> in the Instagram app settings, and link it to a Facebook Page.</>,
      <><strong>Step 2 — Get your Facebook Page Access Token:</strong> Follow the Facebook setup guide above to get a Page Access Token with <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">instagram_content_publish</code> and <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">instagram_basic</code> permissions added.</>,
      <><strong>Step 3 — Auto-fill in AutoBlog:</strong> Paste the Page Access Token into the <strong>Page Access Token</strong> field, then click <strong>Auto-detect</strong> next to Instagram Account ID. AutoBlog will query your linked Facebook pages and fill the ID automatically.</>,
      <><em>If auto-detect fails, run: </em><code className="bg-gray-100 px-1 rounded text-xs text-pink-600">curl "https://graph.facebook.com/v25.0/YOUR_PAGE_ID?fields=instagram_business_account&access_token=YOUR_TOKEN"</code> to get the ID manually.</>
    ]
  },
  LINKEDIN: {
    title: "How to connect LinkedIn",
    steps: [
      <>Go to the <a href="https://www.linkedin.com/developers/tools/oauth/token-generator" target="_blank" className="text-primary-600 underline font-medium">LinkedIn OAuth Token Generator</a>.</>,
      <>Create an app if you don't have one. When generating the token, request the <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">w_member_social</code> permission <strong>and</strong> a profile read permission (like <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">profile</code>, <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">r_liteprofile</code>, or <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">openid</code>).</>,
      <>Generate the Access Token and copy it.</>,
      <>Paste the Access Token into AutoBlog.</>,
      <>Click the <strong>Auto-detect</strong> button next to the Person URN field to automatically fetch your URN!</>
    ]
  },
  TWITTER: {
    title: "How to connect X (Twitter)",
    steps: [
      <>Go to the <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" className="text-primary-600 underline font-medium">X Developer Portal</a>.</>,
      <>Create a Project and an App. Note: You will need at least the $100/month Basic API plan to post via API.</>,
      <>Under the App's "Keys and Tokens" tab, generate your <strong>API Key</strong> and <strong>API Secret</strong>.</>,
      <>Generate your <strong>Access Token</strong> and <strong>Access Token Secret</strong> (make sure your App permissions are set to Read and Write!).</>,
      <>Paste all 4 keys into AutoBlog.</>
    ]
  },
  THREADS: {
    title: "How to connect Threads",
    steps: [
      <><strong>Step 1 — Create/Select a Meta App:</strong> Go to the <a href="https://developers.facebook.com" target="_blank" className="text-primary-600 underline font-medium">Meta Developer Portal</a>, create or select an app, and add the Threads Product API.</>,
      <><strong>Step 2 — Set permissions:</strong> Request the <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">threads_content_publish</code> and <code className="bg-gray-100 px-1 rounded text-xs text-pink-600">threads_basic</code> scopes for publishing posts.</>,
      <><strong>Step 3 — Generate Access Token:</strong> Complete OAuth integration or generate a long-lived user token, and copy it into AutoBlog.</>,
      <><strong>Step 4 — Enter User ID:</strong> Enter your Threads User ID or Username in the designated field to complete linking.</>
    ]
  },
  YOUTUBE: {
    title: "YouTube Channel Setup Guide",
    steps: [
      <>
        <strong>Step 1 — Enable YouTube Data API:</strong>
        <ol className="list-decimal pl-5 mt-1.5 space-y-1 text-gray-500">
          <li>Go to the <a href="https://console.cloud.google.com" target="_blank" className="text-primary-600 underline font-medium">Google Cloud Console</a>.</li>
          <li>Create a new project or select an existing one.</li>
          <li>Navigate to <strong>APIs & Services &gt; Library</strong>.</li>
          <li>Search for "YouTube Data API v3" and click <strong>Enable</strong>.</li>
        </ol>
      </>,
      <>
        <strong>Step 2 — Configure OAuth Consent Screen:</strong>
        <ol className="list-decimal pl-5 mt-1.5 space-y-1 text-gray-500">
          <li>Go to <strong>APIs & Services &gt; OAuth consent screen</strong>.</li>
          <li>Select <strong>External</strong> user type and click <strong>Create</strong>.</li>
          <li>Fill in the App name (e.g. "My YouTube Tool"), User support email, and Developer contact information, then click <strong>Save and Continue</strong>.</li>
          <li>Under <strong>Scopes</strong>, click <strong>Add or Remove Scopes</strong>. Add these scopes:
            <div className="my-1 space-y-1 font-mono text-xs text-pink-600 bg-gray-50 p-1.5 rounded border border-gray-100">
              <div>https://www.googleapis.com/auth/youtube</div>
              <div>https://www.googleapis.com/auth/youtube.upload</div>
            </div>
          </li>
          <li>Under <strong>Test users</strong>, click <strong>Add Users</strong> and enter the Google/YouTube email address you will use to sign in.</li>
          <li>Click <strong>Save and Continue</strong> then <strong>Back to Dashboard</strong>.</li>
        </ol>
      </>,
      <>
        <strong>Step 3 — Create OAuth 2.0 Credentials:</strong>
        <ol className="list-decimal pl-5 mt-1.5 space-y-1 text-gray-500">
          <li>Go to <strong>APIs & Services &gt; Credentials</strong>.</li>
          <li>Click <strong>+ Create Credentials &gt; OAuth client ID</strong>.</li>
          <li>Set Application type to <strong>Web application</strong> and enter a name (e.g., "YouTube App").</li>
          <li>Under <strong>Authorized redirect URIs</strong>, click <strong>Add URI</strong> and add:
            <code className="block bg-gray-50 p-1.5 rounded border border-gray-100 text-xs text-pink-600 font-mono mt-1">https://developers.google.com/oauthplayground</code>
          </li>
          <li>Click <strong>Create</strong> and copy both your <strong>Client ID</strong> and <strong>Client Secret</strong>.</li>
        </ol>
      </>,
      <>
        <strong>Step 4 — Generate Access Token via OAuth Playground:</strong>
        <ol className="list-decimal pl-5 mt-1.5 space-y-1 text-gray-500">
          <li>Go to the <a href="https://developers.google.com/oauthplayground" target="_blank" className="text-primary-600 underline font-medium">Google OAuth Playground</a>.</li>
          <li>Click the <strong>gear icon (⚙️)</strong> in the top right corner.</li>
          <li>Check <strong>Use your own OAuth credentials</strong>, paste your Client ID and Client Secret, and click <strong>Close</strong>.</li>
          <li>In Step 1 on the left side, paste this scope:
            <code className="block bg-gray-50 p-1.5 rounded border border-gray-100 text-xs text-pink-600 font-mono mt-1">https://www.googleapis.com/auth/youtube</code>
          </li>
          <li>Click <strong>Authorize APIs</strong>, sign in with your Google account, and select your YouTube channel.</li>
          <li>Bypass any "unverified app" warnings by clicking <strong>Advanced &gt; Go to app (unsafe)</strong>.</li>
          <li>Click <strong>Exchange authorization code for tokens</strong> and copy the generated <strong>Access Token</strong> (starts with <code className="text-pink-600 font-mono bg-gray-100 px-1 rounded text-xs">ya29...</code>).</li>
        </ol>
      </>,
      <>
        <strong>Step 5 — Find Your Channel ID:</strong>
        <ol className="list-decimal pl-5 mt-1.5 space-y-1 text-gray-500">
          <li>In the OAuth Playground, expand <strong>Step 3 (Configure request to API)</strong>.</li>
          <li>Set Request URI to:
            <code className="block bg-gray-50 p-1.5 rounded border border-gray-100 text-xs text-pink-600 font-mono mt-1">https://youtube.googleapis.com/youtube/v3/channels?part=snippet&amp;mine=true</code>
          </li>
          <li>Set the HTTP method to <strong>GET</strong>.</li>
          <li>Click <strong>Send the request</strong>.</li>
          <li>In the response body on the right, look for the <code className="text-pink-600 font-mono bg-gray-100 px-1 rounded text-xs">"id"</code> field (it starts with <code className="text-pink-600 font-mono bg-gray-100 px-1 rounded text-xs">UC...</code>) and copy it.</li>
        </ol>
      </>,
      <>
        <strong>Step 6 — Copy Your Credentials:</strong>
        <p className="mt-1 text-gray-500">Paste these values into AutoBlog's connection fields:</p>
        <ul className="list-disc pl-5 mt-1 space-y-0.5 text-gray-500">
          <li><strong>Channel ID</strong>: The <code className="text-pink-600 font-mono">UC...</code> ID from Step 5.</li>
          <li><strong>Access Token</strong>: The <code className="text-pink-600 font-mono">ya29...</code> token from Step 4.</li>
        </ul>
      </>,
      <>
        <strong>Step 7 — Verify Connection:</strong>
        <p className="mt-1 text-gray-500">Test that everything works by saving the credentials and clicking connection verification in the dashboard.</p>
      </>
    ]
  }
}

function getSocialAccountName(platform: string, creds: Record<string, string>): string {
  switch (platform) {
    case "FACEBOOK": return `Facebook Page ${creds.pageId || ""}`.trim()
    case "INSTAGRAM": return `Instagram ${creds.igAccountId || ""}`.trim()
    case "LINKEDIN": return creds.personUrn || "LinkedIn Account"
    case "TWITTER": return "X Account"
    case "THREADS": return `@${creds.threadsUserId || "Threads Account"}`
    case "YOUTUBE": return `YouTube Channel ${creds.channelId || ""}`.trim()
    default: return platform
  }
}

export default function SiteSocial() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [site, setSite] = useState<SiteDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingPlatforms, setEditingPlatforms] = useState<Set<string>>(new Set())
  const [guidePlatform, setGuidePlatform] = useState<string | null>(null)

  const [socialCredentials, setSocialCredentials] = useState<Record<string, Record<string, string>>>({})

  useEffect(() => {
    loadSite()
  }, [id])

  const loadSite = async () => {
    try {
      const res = await api.get(`/api/sites/${id}`)
      if (res.data.success) {
        setSite(res.data.data)
      }
    } catch (err) {
      console.error("Error loading site:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const connectedPlatforms = new Set(site?.socialAccounts?.map(a => a.platform) || [])

  const handleSaveNew = async () => {
    setIsSaving(true)
    setSaveResult(null)
    try {
      const platforms = Object.entries(socialCredentials)
        .filter(([_, creds]) => Object.values(creds).some(v => v?.trim()))
        .map(([platform, creds]) => ({
          platform,
          credentials: creds,
          accountName: getSocialAccountName(platform, creds),
        }))

      if (platforms.length === 0) {
        setSaveResult({ success: false, message: "Fill in at least one platform's credentials." })
        setIsSaving(false)
        return
      }

      const res = await api.post(`/api/sites/${id}/social`, { socialPlatforms: platforms })
      if (res.data.success) {
        setSaveResult({ success: true, message: "Social accounts saved!" })
        setSocialCredentials({})
        setEditingPlatforms(new Set())
        loadSite()
      } else {
        setSaveResult({ success: false, message: res.data.error || "Failed to save" })
      }
    } catch (err: any) {
      setSaveResult({ success: false, message: err?.response?.data?.error || "Failed to save social accounts" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async (accountId: string) => {
    if (!confirm("Remove this social account?")) return
    setRemovingId(accountId)
    try {
      await api.delete(`/api/sites/${id}/social/${accountId}`)
      loadSite()
    } catch (err) {
      console.error("Error removing social account:", err)
    } finally {
      setRemovingId(null)
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
        <Share2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
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
        <button onClick={() => navigate("/dashboard/sites")} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Media</h1>
          <p className="text-sm text-gray-500">Manage social accounts for <span className="font-medium text-gray-700">{site.name}</span></p>
        </div>
      </div>

      {/* Connected accounts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Share2 className="h-5 w-5 text-purple-600" />
          Connected Accounts
        </h2>

        {site.socialAccounts && site.socialAccounts.length > 0 ? (
          <div className="space-y-3">
            {site.socialAccounts.map(acc => {
              const cfg = PLATFORM_CONFIG[acc.platform]
              return (
                <div key={acc.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: cfg?.bgColor }}
                    >
                      <i className={`ti ${cfg?.icon}`} style={{ color: cfg?.color }} aria-hidden="true" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{cfg?.label || acc.platform}</span>
                      <p className="text-xs text-gray-500">{acc.accountName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Connected</span>
                    <button
                      onClick={() => {
                        setEditingPlatforms(prev => new Set(prev).add(acc.platform));
                        if (acc.credentials) {
                          setSocialCredentials(prev => ({
                            ...prev,
                            [acc.platform]: acc.credentials || {}
                          }));
                        }
                      }}
                      disabled={editingPlatforms.has(acc.platform)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50"
                      title="Edit Credentials"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(acc.id)}
                      disabled={removingId === acc.id}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove"
                    >
                      {removingId === acc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Share2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No social accounts connected yet</p>
          </div>
        )}
      </div>

      {/* Add new social accounts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary-600" />
          Connect New Account
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Fill in the credentials for the platforms you want to connect. Already connected platforms can be updated by removing and re-adding, or by clicking Edit above.
        </p>

        {SOCIAL_PLATFORMS.filter(p => !connectedPlatforms.has(p.id) || editingPlatforms.has(p.id)).map(platform => (
          <SocialPlatformCard
            key={platform.id}
            platform={platform}
            credentials={socialCredentials[platform.id]}
            onChange={creds =>
              setSocialCredentials(prev => ({ ...prev, [platform.id]: creds }))
            }
            onViewGuide={() => setGuidePlatform(platform.id)}
          />
        ))}

        {SOCIAL_PLATFORMS.filter(p => !connectedPlatforms.has(p.id) || editingPlatforms.has(p.id)).length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">All platforms are already connected!</p>
        )}

        {/* Save result */}
        {saveResult && (
          <div className={`flex items-center p-3 rounded-md text-sm mt-4 ${saveResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {saveResult.success ? <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" /> : <XCircle className="h-4 w-4 mr-2 flex-shrink-0" />}
            {saveResult.message}
          </div>
        )}

        <div className="flex space-x-3 mt-5">
          <button
            onClick={() => navigate("/dashboard/sites")}
            className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSaveNew}
            disabled={isSaving || Object.keys(socialCredentials).length === 0}
            className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Accounts"
            )}
          </button>
        </div>
      </div>

      {/* Setup Guide Modal */}
      {guidePlatform && SETUP_GUIDES[guidePlatform] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
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
