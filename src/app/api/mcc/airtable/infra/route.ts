import { NextRequest, NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN ?? ''
const ROADMAP_BASE = 'appyDgbuyTYErM1NN'
const PAYMENT_CONTROL_BASE = 'appVSVooX0MbBoQ3g'

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

interface AirtableResponse {
  records: AirtableRecord[]
  offset?: string
}

async function airtableFetch(baseId: string, table: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = []
  let offset: string | undefined

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`)
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${table}`)
    const data: AirtableResponse = await res.json()
    allRecords.push(...data.records)
    offset = data.offset
  } while (offset)

  return allRecords
}

interface TaskItem {
  name: string
  direction: string
  status: string
  priority: string
  assignee: string
}

interface ServiceItem {
  name: string
  cost: number
  billingCycle: string
  daysLeft: number
  isOverdue: boolean
}

function mapTask(record: AirtableRecord): TaskItem {
  const f = record.fields
  // Assignee may be an array of collaborator objects or strings
  let assignee = 'Unassigned'
  const rawAssignee = f['Assignee'] ?? f['assignee'] ?? f['Responsible']
  if (rawAssignee && typeof rawAssignee === 'object' && !Array.isArray(rawAssignee)) {
    const obj = rawAssignee as Record<string, unknown>
    assignee = String(obj.name ?? obj.email ?? 'Unknown')
  } else if (Array.isArray(rawAssignee) && rawAssignee.length > 0) {
    const first = rawAssignee[0]
    assignee = typeof first === 'object' && first !== null
      ? String((first as Record<string, unknown>).name ?? (first as Record<string, unknown>).email ?? 'Unknown')
      : String(first)
  } else if (typeof rawAssignee === 'string') {
    assignee = rawAssignee
  }

  return {
    name: String(f['Task Name'] ?? f['Name'] ?? f['Task'] ?? f['name'] ?? ''),
    direction: String(f['Direction'] ?? f['direction'] ?? f['Category'] ?? ''),
    status: String(f['Status'] ?? f['status'] ?? ''),
    priority: String(f['Priority'] ?? f['priority'] ?? ''),
    assignee,
  }
}

function mapService(record: AirtableRecord): ServiceItem {
  const f = record.fields
  // Airtable fields: "BW Name", "Вартість підписки", "Тип підписки", "Days Left", "End Date"
  const costStr = String(f['Вартість підписки'] ?? f['Cost'] ?? f['Monthly Cost'] ?? '0')
  const cost = parseFloat(costStr.replace(/[^0-9.,\-]/g, '').replace(',', '.')) || 0
  const billingCycle = String(f['Тип підписки'] ?? f['Billing Cycle'] ?? 'Місячна')

  const rawDaysLeft = f['Days Left']
  let daysLeft = typeof rawDaysLeft === 'number' ? rawDaysLeft : 0
  if (!rawDaysLeft) {
    const endDate = f['End Date']
    if (endDate && typeof endDate === 'string') {
      const diff = new Date(endDate).getTime() - Date.now()
      daysLeft = Math.ceil(diff / 86400000)
    }
  }
  const isOverdue = daysLeft < 0

  return {
    name: String(f['BW Name'] ?? f['Name'] ?? f['Service'] ?? ''),
    cost,
    billingCycle,
    daysLeft,
    isOverdue,
  }
}

export async function GET(_request: NextRequest) {
  try {
    // Fetch tasks and services in parallel
    const [taskRecords, serviceRecords] = await Promise.all([
      airtableFetch(ROADMAP_BASE, 'Tasks'),
      airtableFetch(PAYMENT_CONTROL_BASE, 'Services'),
    ])

    const tasks = taskRecords.map(mapTask).filter(t => t.name)
    const services = serviceRecords.map(mapService).filter(s => s.name)

    // Compute summary
    const tasksByStatus: Record<string, number> = {}
    const tasksByDirection: Record<string, number> = {}
    for (const t of tasks) {
      const status = t.status || 'No Status'
      const direction = t.direction || 'No Direction'
      tasksByStatus[status] = (tasksByStatus[status] ?? 0) + 1
      tasksByDirection[direction] = (tasksByDirection[direction] ?? 0) + 1
    }

    const totalMonthlyCost = services.reduce((sum, s) => {
      // Normalize to monthly cost
      const cycle = s.billingCycle.toLowerCase()
      if (cycle.includes('year') || cycle.includes('annual')) return sum + s.cost / 12
      if (cycle.includes('quarter')) return sum + s.cost / 3
      if (cycle.includes('week')) return sum + s.cost * 4.33
      return sum + s.cost
    }, 0)

    const overdueServices = services.filter(s => s.isOverdue).length

    const summary = {
      tasksByStatus,
      tasksByDirection,
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
      overdueServices,
      totalTasks: tasks.length,
      totalServices: services.length,
    }

    return NextResponse.json({ tasks, services, summary, source: 'airtable_api' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[airtable/infra] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
