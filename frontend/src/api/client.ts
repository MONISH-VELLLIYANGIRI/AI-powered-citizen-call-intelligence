const API_BASE = "http://localhost:8000/api";

export interface TraceStep {
  node: string;
  output: Record<string, any>;
  duration_ms?: number;
  fallback_used?: boolean;
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

// --- API Functions ---

export async function analyzeComplaint(data: {
  transcript: string;
  citizen_location?: string;
  citizen_id?: string;
}): Promise<Complaint> {
  const res = await fetch(`${API_BASE}/complaints/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function analyzeAudioComplaint(
  file: File,
  citizenLocation?: string,
  citizenId?: string
): Promise<Complaint> {
  const form = new FormData();
  form.append("file", file);
  if (citizenLocation) form.append("citizen_location", citizenLocation);
  if (citizenId) form.append("citizen_id", citizenId);

  const res = await fetch(`${API_BASE}/complaints/analyze-audio`, {
    method: "POST",
    body: form,
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
