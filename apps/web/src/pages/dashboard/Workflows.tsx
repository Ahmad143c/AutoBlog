import { useState, useEffect, Fragment } from "react"
import { Plus, Pause, Play, Trash2, Clock, ChevronDown, ChevronRight } from "lucide-react"
import { BASE_URL, fetchWorkflows, toggleWorkflow, deleteWorkflow, fetchSites } from "@/lib/api"
import { CreateWorkflowModal } from "@/components/workflows/CreateWorkflowModal"
import WorkflowExpandedPanel from "@/components/workflows/WorkflowExpandedPanel"


// The legacy inline CreateWorkflowModal has been removed and replaced by the component in @/components/workflows/CreateWorkflowModal

export default function Workflows() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [workflows, setWorkflows] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null)
  const [toast, setToast] = useState<{msg:string,type:"success"|"error"}|null>(null)

  function showToast(msg: string, type: "success"|"error" = "success") {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadWorkflows = async () => {
    setIsLoading(true)
    try {
      const data = await fetchWorkflows()
      if (data.success) {
        setWorkflows(data.data)
      }
    } catch (error) {
      console.error('Error fetching workflows:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSites = async () => {
    try {
      const data = await fetchSites()
      if (data.success) {
        setSites(data.data)
      }
    } catch (error) {
      console.error('Error fetching sites:', error)
    }
  }

  useEffect(() => {
    loadWorkflows()
    loadSites()
  }, [])

  const handleToggleWorkflow = async (id: string) => {
    try {
      await toggleWorkflow(id)
      loadWorkflows()
    } catch (error) {
      console.error('Error toggling workflow:', error)
    }
  }

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return
    
    try {
      await deleteWorkflow(id)
      loadWorkflows()
    } catch (error) {
      console.error('Error deleting workflow:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Automation Workflows</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </button>
      </div>

      {/* Workflows List */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows yet</h3>
          <p className="text-gray-600 mb-4">Create one to start auto-publishing.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8 px-4 py-3"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Site
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workflows.map((workflow) => {
                  const scheduleData = typeof workflow.scheduleData === "string"
                    ? JSON.parse(workflow.scheduleData || "{}")
                    : workflow.scheduleData || {}
                  const isManual = scheduleData?.mode === "manual"

                  return (
                    <Fragment key={workflow.id}>
                      <tr className="hover:bg-gray-50 border-b border-gray-50">
                        <td className="pl-4 pr-2 py-3 w-8">
                          <button
                            onClick={() =>
                              setExpandedWorkflowId(
                                expandedWorkflowId === workflow.id ? null : workflow.id
                              )
                            }
                            className="text-gray-400 hover:text-purple-600 transition-colors"
                          >
                            {expandedWorkflowId === workflow.id
                              ? <ChevronDown className="w-4 h-4" />
                              : <ChevronRight className="w-4 h-4" />
                            }
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{workflow.name}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isManual
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}>
                              {isManual ? "Manual" : "AI Auto"}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">{workflow.topic}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">{workflow.site?.name || 'Unknown'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">{workflow.schedule}</div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleWorkflow(workflow.id)}
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                              workflow.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {workflow.isActive ? (
                              <>
                                <Play className="h-3 w-3 mr-1" />
                                Active
                              </>
                            ) : (
                              <>
                                <Pause className="h-3 w-3 mr-1" />
                                Paused
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleToggleWorkflow(workflow.id)}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              {workflow.isActive ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteWorkflow(workflow.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedWorkflowId === workflow.id && (
                        <tr className="border-b border-gray-100">
                          <td colSpan={6} className="p-0">
                            <WorkflowExpandedPanel
                              workflow={workflow}
                              onClose={() => setExpandedWorkflowId(null)}
                              onSave={async (updatedScheduleData, updatedWordCount) => {
                                // Save to backend
                                const token = localStorage.getItem('auth_token')
                                const res = await fetch(
                                  `${BASE_URL}/api/workflows/${workflow.id}`,
                                  {
                                    method: "PUT",
                                    headers: {
                                      "Content-Type": "application/json",
                                      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                    },
                                    body: JSON.stringify({ 
                                      scheduleData: updatedScheduleData,
                                      wordCount: updatedWordCount
                                    }),
                                  }
                                )
                                const data = await res.json()
                                if (data.success) {
                                  // Update local workflows list
                                  setWorkflows(prev =>
                                    prev.map(w =>
                                      w.id === workflow.id
                                        ? { ...w, scheduleData: updatedScheduleData, wordCount: updatedWordCount }
                                        : w
                                    )
                                  )
                                  setExpandedWorkflowId(null)
                                  showToast("Workflow updated successfully!")
                                } else {
                                  showToast("Failed to save: " + data.error, "error")
                                }
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Workflow Modal */}
      <CreateWorkflowModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onWorkflowCreated={loadWorkflows}
        sites={sites}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg
                         text-sm font-medium text-white ${
          toast.type === "success" ? "bg-green-600" : "bg-red-600"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
