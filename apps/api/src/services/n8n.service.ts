import axios from 'axios';
import crypto from 'crypto';

const getEnvVars = () => ({
  N8N_URL: process.env.N8N_URL || 'http://localhost:5678',
  N8N_API_KEY: process.env.N8N_API_KEY || '',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',
  BACKEND_URL: process.env.BACKEND_URL || 'http://host.docker.internal:3001'
});

interface CreateWorkflowParams {
  workflowName: string;
  cronExpression: string;
  payload: {
    workflowId: string;
    userId: string;
    siteId: string;
    topic: string;
    keywords: string[];
    tone: string;
    wordCount: number;
  };
}

export async function createWorkflowInN8n({ 
  workflowName, 
  cronExpression, 
  payload 
}: CreateWorkflowParams): Promise<string> {
  const workflow = {
    name: workflowName,
    nodes: [
      {
        id: crypto.randomUUID(),
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1.1,
        position: [250, 300],
        parameters: {
          rule: {
            interval: [
              {
                field: 'cronExpression',
                expression: cronExpression,
              },
            ],
          },
        },
      },
      {
        id: crypto.randomUUID(),
        name: 'Generate and Publish',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [500, 300],
        parameters: {
          method: 'POST',
          url: `${getEnvVars().BACKEND_URL}/api/webhooks/run`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              {
                name: 'x-autoblog-secret',
                value: getEnvVars().WEBHOOK_SECRET,
              },
              {
                name: 'Content-Type',
                value: 'application/json',
              },
            ],
          },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: JSON.stringify(payload),
        },
      },
    ],
    connections: {
      'Schedule Trigger': {
        main: [[{ node: 'Generate and Publish', type: 'main', index: 0 }]],
      },
    },
    settings: {
      executionOrder: 'v1',
    },
  };

  const env = getEnvVars();
  const res = await axios.post(
    `${env.N8N_URL}/api/v1/workflows`,
    workflow,
    {
      headers: {
        'X-N8N-API-KEY': env.N8N_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );
  
  // Activate the workflow
  if (res.data.id) {
    await toggleWorkflow(res.data.id, true);
  }
  
  return res.data.id;
}

export async function toggleWorkflow(n8nWorkflowId: string, active: boolean): Promise<void> {
  const env = getEnvVars();
  const action = active ? 'activate' : 'deactivate';
  await axios.post(
    `${env.N8N_URL}/api/v1/workflows/${n8nWorkflowId}/${action}`,
    {},
    {
      headers: {
        'X-N8N-API-KEY': env.N8N_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );
}

export async function deleteWorkflowFromN8n(n8nWorkflowId: string): Promise<void> {
  const env = getEnvVars();
  await axios.delete(
    `${env.N8N_URL}/api/v1/workflows/${n8nWorkflowId}`,
    {
      headers: {
        'X-N8N-API-KEY': env.N8N_API_KEY,
      },
    }
  );
}

export function generateCronExpression(schedule: {
  type: 'daily' | 'weekly' | 'custom';
  time: string;
  days?: number[];
  customExpression?: string;
}): string {
  const [hours, minutes] = schedule.time.split(':').map(Number);
  
  if (schedule.type === 'custom' && schedule.customExpression) {
    return schedule.customExpression;
  }
  
  if (schedule.type === 'daily') {
    return `${minutes} ${hours} * * *`;
  }
  
  if (schedule.type === 'weekly' && schedule.days) {
    const daysStr = schedule.days.join(',');
    return `${minutes} ${hours} * * ${daysStr}`;
  }
  
  return '0 9 * * 1,3,5'; // Default: Mon, Wed, Fri at 9 AM
}

export function formatSchedule(schedule: string): string {
  try {
    const parts = schedule.split(' ');
    if (parts.length === 5) {
      const minute = parts[0];
      const hour = parts[1];
      const dayOfWeek = parts[4];
      
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      
      if (dayOfWeek === '*') {
        return `Daily at ${time}`;
      }
      
      const days = dayOfWeek.split(',').map(d => {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return dayNames[parseInt(d)];
      });
      
      return `Weekly on ${days.join(', ')} at ${time}`;
    }
  } catch {
    // Fall through
  }
  
  return schedule;
}
