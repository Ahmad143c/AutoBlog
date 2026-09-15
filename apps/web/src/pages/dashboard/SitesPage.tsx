import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import type { Site, Platform, SiteStatus } from '@autoblog/shared'

const platformLabels: Record<Platform, string> = {
  WORDPRESS: 'WordPress',
  NEXTJS: 'Next.js',
}

const statusColors: Record<SiteStatus, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  ERROR: 'destructive',
}

export function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    platform: 'WORDPRESS' as Platform,
    username: '',
    appPassword: '',
  })

  useEffect(() => {
    fetchSites()
  }, [])

  const fetchSites = async () => {
    try {
      const { data } = await api.get('/api/sites')
      if (data.success) {
        setSites(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch sites:', error)
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await api.post('/api/sites/test', {
        url: formData.url,
        username: formData.username,
        appPassword: formData.appPassword,
      })
      setTestResult(data.success)
    } catch (error) {
      setTestResult(false)
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const { data } = await api.post('/api/sites', {
        name: formData.name,
        url: formData.url,
        platform: formData.platform,
        credentials: {
          username: formData.username,
          appPassword: formData.appPassword,
        },
      })
      if (data.success) {
        setSites([...sites, data.data])
        setDialogOpen(false)
        setFormData({
          name: '',
          url: '',
          platform: 'WORDPRESS' as Platform,
          username: '',
          appPassword: '',
        })
        setTestResult(null)
      }
    } catch (error) {
      console.error('Failed to create site:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this site?')) return
    
    try {
      await api.delete(`/api/sites/${id}`)
      setSites(sites.filter(s => s.id !== id))
    } catch (error) {
      console.error('Failed to delete site:', error)
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading sites...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sites</h1>
          <p className="text-muted-foreground">Manage your connected websites</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Connect Site
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Connect New Site</DialogTitle>
              <DialogDescription>
                Add your WordPress or Next.js site to publish content automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Site Name</Label>
                <Input
                  id="name"
                  placeholder="My Blog"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Site URL</Label>
                <Input
                  id="url"
                  placeholder="https://example.com"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(v) => setFormData({ ...formData, platform: v as Platform })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WORDPRESS">WordPress</SelectItem>
                    <SelectItem value="NEXTJS">Next.js</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="admin"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appPassword">Application Password</Label>
                <Input
                  id="appPassword"
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                  value={formData.appPassword}
                  onChange={(e) => setFormData({ ...formData, appPassword: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  For WordPress: Generate this in Users → Profile → Application Passwords
                </p>
              </div>
              {testResult !== null && (
                <div className={`flex items-center gap-2 text-sm ${testResult ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  {testResult ? 'Connection successful!' : 'Connection failed. Check your credentials.'}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={testing || !formData.url || !formData.username || !formData.appPassword}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name || !formData.url || !formData.username || !formData.appPassword}
              >
                Connect Site
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sites.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No sites connected yet. Click "Connect Site" to add your first website.
            </CardContent>
          </Card>
        ) : (
          sites.map((site) => (
            <Card key={site.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{site.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{site.url}</p>
                  </div>
                  <Badge variant={statusColors[site.status]}>
                    {site.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {platformLabels[site.platform]}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={site.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(site.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
