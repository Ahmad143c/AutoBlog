import { useEffect, useState } from 'react'
import { FileText, Globe, Workflow, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

interface Stats {
  totalSites: number
  totalPosts: number
  activeWorkflows: number
  successRate: number
}

const statCards = [
  {
    title: 'Total Sites',
    icon: Globe,
    key: 'totalSites' as const,
    description: 'Connected websites',
  },
  {
    title: 'Total Posts',
    icon: FileText,
    key: 'totalPosts' as const,
    description: 'Published articles',
  },
  {
    title: 'Active Workflows',
    icon: Workflow,
    key: 'activeWorkflows' as const,
    description: 'Automation running',
  },
  {
    title: 'Success Rate',
    icon: TrendingUp,
    key: 'successRate' as const,
    description: 'Publish success %',
    format: (val: number) => `${val}%`,
  },
]

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/api/dashboard/stats')
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your content overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  card.format ? card.format(stats?.[card.key] || 0) : stats?.[card.key] || 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Get started with these common tasks:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <a href="/dashboard/sites" className="text-primary hover:underline">
                  Connect a new site
                </a>
              </li>
              <li className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <a href="/dashboard/posts" className="text-primary hover:underline">
                  Generate a new post
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-primary" />
                <a href="/dashboard/workflows" className="text-primary hover:underline">
                  Set up automated workflows
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              New to AutoBlog? Follow these steps:
            </p>
            <ol className="mt-2 space-y-2 text-sm list-decimal list-inside">
              <li>Connect your WordPress or Next.js site</li>
              <li>Create your first AI-generated post</li>
              <li>Set up automated workflows for recurring content</li>
              <li>Monitor your publishing success rate</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
