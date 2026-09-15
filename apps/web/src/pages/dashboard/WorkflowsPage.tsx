import { useEffect, useState } from 'react'
import { Plus, Trash2, Pause, Play, Clock, PlayCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { CreateWorkflowModal } from '@/components/workflows/CreateWorkflowModal'
import type { Workflow, Site } from '@autoblog/shared'



export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchWorkflows()
    fetchSites()
  }, [])

  const fetchWorkflows = async () => {
    try {
      const { data } = await api.get('/api/workflows')
      if (data.success) {
        setWorkflows(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSites = async () => {
    try {
      const { data } = await api.get('/api/sites')
      if (data.success) {
        setSites(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch sites:', error)
    }
  }

  const formatSchedule = (schedule: string) => {
    try {
      const parts = schedule.split(' ')
      if (parts.length === 5) {
        const minute = parts[0].padStart(2, '0')
        const hour = parts[1].padStart(2, '0')
        const dayOfWeek = parts[4]
        const timeStr = `${hour}:${minute}`
        
        if (dayOfWeek === '*') {
          return `Daily at ${timeStr}`
        }
        
        const days = dayOfWeek.split(',').map(d => {
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          return dayNames[parseInt(d)]
        })
        
        return `${days.join(', ')} at ${timeStr}`
      }
    } catch {
      // ignore
    }
    return schedule
  }

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/api/workflows/${id}/toggle`)
      fetchWorkflows()
    } catch (error) {
      console.error('Failed to toggle workflow:', error)
    }
  }

  const handleRunNow = async (id: string) => {
    setRunningId(id)
    try {
      const { data } = await api.post('/api/webhooks/run', { workflowId: id }, {
        headers: {
          'x-autoblog-secret': 'your-webhook-secret-here'
        }
      })
      if (data.success) {
        alert('Workflow triggered successfully!')
        fetchWorkflows()
      } else {
        alert('Failed: ' + data.error)
      }
    } catch (error: any) {
      alert('Error: ' + (error.response?.data?.error || error.message))
    } finally {
      setRunningId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return
    
    try {
      await api.delete(`/api/workflows/${id}`)
      setWorkflows(workflows.filter(w => w.id !== id))
    } catch (error) {
      console.error('Failed to delete workflow:', error)
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading workflows...</div>
  }

  return (
    <div className="space-y-6">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      <CreateWorkflowModal 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        onWorkflowCreated={fetchWorkflows}
        sites={sites}
      />

      <Card>
        <CardHeader>
          <CardTitle>Active Workflows</CardTitle>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No workflows yet. Create your first automation to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{workflow.name}</h3>
                      <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                        {workflow.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {workflow.site?.name} • {workflow.topic}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatSchedule(workflow.schedule)}</span>
                      {workflow.lastRunAt && (
                        <>
                          <span>•</span>
                          <span>Last run: {new Date(workflow.lastRunAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {workflow.keywords.map((keyword) => (
                        <Badge key={keyword} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunNow(workflow.id)}
                      disabled={runningId === workflow.id}
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                      title="Run manually now"
                    >
                      {runningId === workflow.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(workflow.id)}
                    >
                      {workflow.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(workflow.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
