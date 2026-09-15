import { useState, useEffect } from "react"
import { User, Link, Key, CreditCard, Trash2, Brain, Eye, EyeOff, CheckCircle, AlertCircle, Info, ExternalLink } from "lucide-react"
import { fetchSites, api } from "@/lib/api"

export default function Settings() {
  const [activeSection, setActiveSection] = useState("profile")
  const [user, setUser] = useState({ name: "", email: "", plan: "FREE" })
  const [sites, setSites] = useState<any[]>([])
  const [profileForm, setProfileForm] = useState({ name: "" })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [groqKeyInfo, setGroqKeyInfo] = useState<{ hasKey: boolean; maskedKey: string | null }>({
    hasKey: false,
    maskedKey: null,
  })
  const [newApiKey, setNewApiKey] = useState("")
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [keyStatus, setKeyStatus] = useState<"idle" | "testing" | "saving" | "removing">("idle")
  const [keyMessage, setKeyMessage] = useState<{
    text: string
    type: "success" | "error" | "info"
  } | null>(null)

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      // Fetch user profile
      const userRes = await api.get('/api/auth/me')
      if (userRes.data.success) {
        setUser(userRes.data.data)
        setProfileForm({ name: userRes.data.data.name || '' })
      }

      // Fetch connected sites
      const sitesRes = await fetchSites()
      if (sitesRes.success) {
        setSites(sitesRes.data)
      }

      try {
        const keyRes = await api.get('/api/settings/groq-key')
        if (keyRes.data.success) {
          setGroqKeyInfo(keyRes.data.data)
        }
      } catch (error) {
        console.error('Error loading Groq API key info:', error)
        setKeyMessage({
          text: 'Could not load Groq API key status. You can still update or replace the key below.',
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      // Update user profile (this endpoint might need to be implemented in backend)
      await api.patch('/api/auth/me', { name: profileForm.name })
      setUser({ ...user, name: profileForm.name })
      setMessage({ type: 'success', text: 'Profile updated successfully' })
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage({ type: 'error', text: 'Failed to update profile' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnectSite = async (siteId: string) => {
    if (!confirm('Are you sure you want to disconnect this site?')) return
    try {
      await api.delete(`/api/sites/${siteId}`)
      setSites(sites.filter(s => s.id !== siteId))
      setMessage({ type: 'success', text: 'Site disconnected successfully' })
    } catch (error) {
      console.error('Error disconnecting site:', error)
      setMessage({ type: 'error', text: 'Failed to disconnect site' })
    }
  }

  const handleDeleteAccount = async () => {
    const confirmation = prompt('Type "DELETE" to confirm account deletion. This action cannot be undone.')
    if (confirmation !== 'DELETE') return
    try {
      await api.delete('/api/auth/me')
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    } catch (error) {
      console.error('Error deleting account:', error)
      setMessage({ type: 'error', text: 'Failed to delete account' })
    }
  }

  const handleTestKey = async () => {
    if (!newApiKey.trim()) return
    setKeyStatus("testing")
    setKeyMessage(null)

    try {
      const res = await api.post('/api/settings/groq-key/test', {
        apiKey: newApiKey.trim(),
      })

      setKeyMessage({
        text: res.data.data?.message || res.data.error || 'Key test completed.',
        type: res.data.data?.valid ? "success" : "error",
      })
    } catch (error: any) {
      setKeyMessage({
        text: error.response?.data?.error || 'Failed to test Groq API key',
        type: "error",
      })
    } finally {
      setKeyStatus("idle")
    }
  }

  const handleSaveKey = async () => {
    if (!newApiKey.trim()) return
    setKeyStatus("saving")
    setKeyMessage(null)

    try {
      const res = await api.put('/api/settings/groq-key', {
        apiKey: newApiKey.trim(),
      })

      if (res.data.success) {
        setGroqKeyInfo({ hasKey: true, maskedKey: res.data.data.maskedKey })
        setNewApiKey("")
        setShowKeyInput(false)
        setKeyMessage({ text: res.data.data.message, type: "success" })
      } else {
        setKeyMessage({ text: res.data.error || 'Failed to save Groq API key', type: "error" })
      }
    } catch (error: any) {
      setKeyMessage({
        text: error.response?.data?.error || 'Failed to save Groq API key',
        type: "error",
      })
    } finally {
      setKeyStatus("idle")
    }
  }

  const handleRemoveKey = async () => {
    if (!confirm("Remove your Groq API key? The system key will be used instead.")) return
    setKeyStatus("removing")
    setKeyMessage(null)

    try {
      const res = await api.delete('/api/settings/groq-key')

      if (res.data.success) {
        setGroqKeyInfo({ hasKey: false, maskedKey: null })
        setShowKeyInput(false)
        setNewApiKey("")
        setKeyMessage({ text: res.data.data.message, type: "info" })
      }
    } catch (error: any) {
      setKeyMessage({
        text: error.response?.data?.error || 'Failed to remove Groq API key',
        type: "error",
      })
    } finally {
      setKeyStatus("idle")
    }
  }

  const sections = [
    { id: "profile", name: "Profile", icon: User },
    { id: "accounts", name: "Connected Accounts", icon: Link },
    { id: "api", name: "API Keys", icon: Key },
    { id: "billing", name: "Plan & Billing", icon: CreditCard },
    { id: "danger", name: "Danger Zone", icon: Trash2 }
  ]

  const renderContent = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div className="space-y-6">
            {message && (
              <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {message.text}
              </div>
            )}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )

      case "accounts":
        return (
          <div className="space-y-6">
            {message && (
              <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {message.text}
              </div>
            )}
            <h3 className="text-lg font-medium text-gray-900 mb-4">Connected Accounts</h3>
            {sites.length === 0 ? (
              <div className="bg-white p-8 border border-gray-200 rounded-lg text-center">
                <p className="text-gray-500">No sites connected yet.</p>
                <button
                  onClick={() => window.location.href = '/dashboard/sites'}
                  className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                >
                  Connect Your First Site
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {sites.map((site) => (
                  <div key={site.id} className="bg-white p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{site.name}</h4>
                        <p className="text-sm text-gray-600">{site.platform}</p>
                        <p className="text-xs text-gray-500">
                          Connected on {new Date(site.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDisconnectSite(site.id)}
                        className="px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case "api":
        return (
          <div className="space-y-6">
            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <h2 className="text-base font-medium text-gray-900 mb-1">API keys</h2>
              <p className="text-sm text-gray-500 mb-6">
                Add your own Groq API key to use your personal quota. If not set, the AutoBlog system key is used.
              </p>

              <div className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Groq AI</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Powers blog content generation with LLaMA models
                      </p>
                    </div>
                  </div>

                  {groqKeyInfo.hasKey ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full flex-shrink-0">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Your key active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full flex-shrink-0">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      System key
                    </span>
                  )}
                </div>

                {groqKeyInfo.hasKey && groqKeyInfo.maskedKey && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      <Key className="w-4 h-4 text-gray-400" />
                      <code className="text-sm text-gray-600 font-mono">
                        {showKey ? groqKeyInfo.maskedKey : "gsk_********...****"}
                      </code>
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="ml-auto text-gray-400 hover:text-gray-600"
                        aria-label={showKey ? "Hide key" : "Show key"}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setShowKeyInput(true)
                        setKeyMessage(null)
                      }}
                      className="text-xs text-purple-600 border border-purple-200 px-3 py-2 rounded-lg hover:bg-purple-50 font-medium"
                    >
                      Update
                    </button>
                    <button
                      onClick={handleRemoveKey}
                      disabled={keyStatus === "removing"}
                      className="text-xs text-red-500 border border-red-100 px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-40"
                    >
                      {keyStatus === "removing" ? "Removing..." : "Remove"}
                    </button>
                  </div>
                )}

                {(!groqKeyInfo.hasKey || showKeyInput) && (
                  <div className="mt-3">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showKey ? "text" : "password"}
                          value={newApiKey}
                          onChange={(e) => {
                            setNewApiKey(e.target.value)
                            setKeyMessage(null)
                          }}
                          placeholder="gsk_..."
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                        />
                        <button
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          aria-label={showKey ? "Hide" : "Show"}
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        onClick={handleTestKey}
                        disabled={!newApiKey.trim() || keyStatus !== "idle"}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        {keyStatus === "testing" ? "Testing..." : "Test"}
                      </button>
                      <button
                        onClick={handleSaveKey}
                        disabled={!newApiKey.trim() || keyStatus !== "idle"}
                        className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 font-medium"
                      >
                        {keyStatus === "saving" ? "Saving..." : "Save"}
                      </button>
                      {showKeyInput && (
                        <button
                          onClick={() => {
                            setShowKeyInput(false)
                            setNewApiKey("")
                            setKeyMessage(null)
                          }}
                          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {keyMessage && (
                      <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${keyMessage.type === "success"
                          ? "bg-green-50 text-green-700"
                          : keyMessage.type === "error"
                            ? "bg-red-50 text-red-600"
                            : "bg-blue-50 text-blue-600"
                        }`}>
                        {keyMessage.type === "success" ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : keyMessage.type === "error" ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : (
                          <Info className="w-4 h-4" />
                        )}
                        {keyMessage.text}
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      Get your free key at{" "}
                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-purple-600 hover:underline"
                      >
                        console.groq.com/keys
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {" "}keys start with <code className="font-mono">gsk_</code>.
                    </p>
                  </div>
                )}

                {!groqKeyInfo.hasKey && !showKeyInput && (
                  <div className="mt-3 flex gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                      AutoBlog's shared system key is being used. Add your own key for dedicated quota and higher rate limits.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case "billing":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Plan & Billing</h3>
            <div className="bg-white p-6 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium text-gray-900">Current Plan</h4>
                  <p className="text-sm text-gray-600 capitalize">{user.plan} Plan</p>
                </div>
                <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-primary-100 text-primary-800">
                  Active
                </span>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                {user.plan === 'FREE' ? (
                  <>
                    <p>• 5 posts per month</p>
                    <p>• Up to 3 connected sites</p>
                    <p>• Basic AI generation</p>
                    <p>• Standard support</p>
                  </>
                ) : (
                  <>
                    <p>• Unlimited posts per month</p>
                    <p>• Up to 10 connected sites</p>
                    <p>• Advanced AI generation</p>
                    <p>• Priority support</p>
                    <p>• n8n workflows</p>
                  </>
                )}
              </div>
              {user.plan === 'FREE' && (
                <button className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors">
                  Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        )

      case "danger":
        return (
          <div className="space-y-6">
            {message && (
              <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {message.text}
              </div>
            )}
            <h3 className="text-lg font-medium text-gray-900 mb-4">Danger Zone</h3>
            <div className="bg-white p-6 border border-red-200 rounded-lg">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">Delete Account</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-md">
                  <p className="text-sm text-red-800">
                    <strong>Warning:</strong> This will delete all your sites, posts, workflows, and settings. There is no way to recover this data.
                  </p>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {isLoading ? (
        <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex space-x-6">
          {/* Sidebar */}
          <div className="w-64">
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === section.id
                        ? "bg-primary-100 text-primary-700"
                        : "text-gray-600 hover:bg-gray-100"
                      }`}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {section.name}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  )
}
