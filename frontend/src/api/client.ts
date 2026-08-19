const API_BASE = "http://localhost:8000/api";

export interface TraceStep {
  node: string;
  agent_name?: string;
  action_summary?: string;
  timestamp?: string;
  status?: string;
  output: Record<string, any>;
  duration_ms?: number;
  fallback_used?: boolean;
}

export interface ComplaintAuditLogResponse {
  complaint_id: number;
  total_steps: number;
  total_duration_ms: number;
  created_at: string;
  trace: TraceStep[];
}

export interface ResolutionStep {
  id: number;
  complaint_id: number;
  step_text: string;
  owner: string;
  status: string;
  completed_at?: string;
}

export interface ComplaintTimelineEntry {
  id: number;
  complaint_id: number;
  actor: string;
  message: string;
  visible_to_citizen: boolean;
  created_at: string;
}

export interface ResolutionDraftResult {
  step_id: number;
  status: string;
  draft_citizen_message?: string;
  all_steps_done: boolean;
  draft_closure_message?: string;
}

export interface CitizenComplaintDetail {
  id: number;
  category?: string;
  urgency?: string;
  status: string;
  summary?: string;
  department_recommended?: string;
  created_at: string;
  citizen_location?: string;
  steps_summary: { id: number; title: string; status: string; completed_at?: string }[];
  timeline: ComplaintTimelineEntry[];
  audit_log?: TraceStep[];
}

export interface OfficerQueueItem {
  id: number;
  category?: string;
  urgency?: string;
  status: string;
  department_recommended?: string;
  created_at: string;
  summary?: string;
  citizen_location?: string;
  department_confidence?: number;
  total_steps: number;
  completed_steps: number;
}

export interface Complaint {
  id: number;
  created_at: string;
  updated_at: string;
  raw_input_type: string;
  transcript: string;
  citizen_id?: string;
  citizen_location?: string;
  category?: string;
  urgency?: string;
  sentiment?: string;
  summary?: string;
  department_recommended?: string;
  department_confidence?: number;
  is_duplicate_of?: number;
  duplicate_confidence?: number;
  status: string;
  reasoning_trace?: TraceStep[];
  resolution_steps?: ResolutionStep[];
  department_contact_info?: { contact: string; email?: string; sla_hours: number };
  draft_department_message?: string;
  draft_citizen_ack?: string;
}

export interface ComplaintListItem {
  id: number;
  category?: string;
  urgency?: string;
  status: string;
  department_recommended?: string;
  created_at: string;
  transcript_excerpt: string;
  citizen_location?: string;
  is_duplicate_of?: number;
  summary?: string;
}

export interface AnalyticsSummary {
  total: number;
  by_category: Record<string, number>;
  by_urgency: Record<string, number>;
  by_status: Record<string, number>;
  avg_resolution_hours?: number;
  trend_last_14_days: { date: string; count: number }[];
}

export interface HotspotItem {
  location: string;
  category: string;
  count: number;
}

export interface ChatbotResponse {
  answer: string;
}

export interface AutonomousResolutionResponse {
  complaint_id: number;
  status: string;
  steps_completed: number;
  trace_added: number;
  closure_message?: string;
  dispatch_info?: Record<string, any>;
}

export interface AutonomousStepResolutionResponse {
  step_id: number;
  status: string;
  complaint_status: string;
  all_steps_done: boolean;
  citizen_update?: string;
}

// --- API Functions ---

export async function analyzeComplaint(
  data: {
    transcript: string;
    citizen_location: string;
    citizen_id: string;
  },
  autoResolve: boolean = false
): Promise<Complaint> {
  const url = autoResolve
    ? `${API_BASE}/complaints/analyze?auto_resolve=true`
    : `${API_BASE}/complaints/analyze`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function analyzeAudioComplaint(
  file: File,
  citizenLocation: string,
  citizenId: string,
  autoResolve: boolean = false
): Promise<Complaint> {
  const form = new FormData();
  form.append("file", file);
  form.append("citizen_location", citizenLocation);
  form.append("citizen_id", citizenId);
  if (autoResolve) {
    form.append("auto_resolve", "true");
  }

  const res = await fetch(`${API_BASE}/complaints/analyze-audio`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function autoResolveComplaint(id: number): Promise<AutonomousResolutionResponse> {
  const res = await fetch(`${API_BASE}/complaints/${id}/auto-resolve`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function autoResolveStep(
  complaintId: number,
  stepId: number
): Promise<AutonomousStepResolutionResponse> {
  const res = await fetch(`${API_BASE}/complaints/${complaintId}/auto-resolve-step/${stepId}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listComplaints(filters?: {
  status?: string;
  category?: string;
  urgency?: string;
  department?: string;
}): Promise<ComplaintListItem[]> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
  }
  const url = `${API_BASE}/complaints/?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getComplaint(id: number): Promise<Complaint> {
  const res = await fetch(`${API_BASE}/complaints/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getComplaintAuditLog(id: number): Promise<ComplaintAuditLogResponse> {
  const res = await fetch(`${API_BASE}/complaints/${id}/audit-log`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateComplaintStatus(
  id: number,
  status: string
): Promise<Complaint> {
  const res = await fetch(`${API_BASE}/complaints/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getResolutionSteps(complaintId: number): Promise<ResolutionStep[]> {
  const res = await fetch(`${API_BASE}/complaints/${complaintId}/resolution-steps`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateResolutionStep(
  stepId: number,
  status: 'pending' | 'done'
): Promise<ResolutionDraftResult> {
  const res = await fetch(`${API_BASE}/complaints/resolution-steps/${stepId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTimeline(
  complaintId: number,
  citizenView: boolean = false
): Promise<ComplaintTimelineEntry[]> {
  const res = await fetch(`${API_BASE}/complaints/${complaintId}/timeline?citizen_view=${citizenView}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendTimelineEntry(
  complaintId: number,
  message: string,
  visibleToCitizen: boolean = true
): Promise<ComplaintTimelineEntry> {
  const res = await fetch(`${API_BASE}/complaints/${complaintId}/timeline/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, visible_to_citizen: visibleToCitizen }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCitizenComplaints(citizenId?: string): Promise<ComplaintListItem[]> {
  const url = citizenId ? `${API_BASE}/citizen/complaints?citizen_id=${encodeURIComponent(citizenId)}` : `${API_BASE}/citizen/complaints`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCitizenComplaintDetail(id: number): Promise<CitizenComplaintDetail> {
  const res = await fetch(`${API_BASE}/citizen/complaints/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendCitizenFollowup(
  id: number,
  message: string
): Promise<ComplaintTimelineEntry> {
  const res = await fetch(`${API_BASE}/citizen/complaints/${id}/followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getOfficerQueue(
  filter: 'needs_review' | 'my_active' | 'resolved' | 'all' = 'my_active'
): Promise<OfficerQueueItem[]> {
  const res = await fetch(`${API_BASE}/officer/queue?filter=${filter}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE}/analytics/summary`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getHotspots(): Promise<HotspotItem[]> {
  const res = await fetch(`${API_BASE}/analytics/hotspots`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function chatbotQuery(data: {
  query: string;
  complaint_id?: number;
  citizen_id?: string;
}): Promise<ChatbotResponse> {
  const res = await fetch(`${API_BASE}/chatbot/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function transcribeChunk(
  blob: Blob
): Promise<{ text: string; error?: string }> {
  const form = new FormData();
  form.append("audio", blob, "chunk.webm");

  try {
    const res = await fetch(`${API_BASE}/complaints/transcribe-chunk`, {
      method: "POST",
      body: form,
    });
    return res.json();
  } catch {
    return { text: "", error: "network_error" };
  }
}

