"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Types
type Task = {
  id: number;
  input_data: string;
  status: string;
  result: string | null;
  created_at: string;
  max_execution_time: number;
  is_cancelled: boolean;
  owner_id: number;
  task_type: string;
  simulated_duration: number;
};

// API Helper
const API_URL = "http://localhost:8080";

export default function Home() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [inputData, setInputData] = useState("");
  const [maxTime, setMaxTime] = useState(30);
  const [duration, setDuration] = useState(5);
  const [replicas, setReplicas] = useState(1);
  const [taskType, setTaskType] = useState("text_processing");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [quota, setQuota] = useState({ quota: 100, used: 0, available: 100 });
  const [usageHistory, setUsageHistory] = useState<number[]>([]);
  const [usageVelocity, setUsageVelocity] = useState(0);
  const [activeTab, setActiveTab] = useState<'mission_control' | 'account' | 'admin'>('mission_control');
  const [isAdmin, setIsAdmin] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Filters & Sorting
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [sortOrder, setSortOrder] = useState("Newest");

  // Profile Update State
  const [newUsername, setNewUsername] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    active: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  });

  // Derived state for filtered tasks
  const filteredTasks = tasks.filter(t => {
    const statusMatch = filterStatus === "All" ||
      (filterStatus === "Active" ? (t.status === 'Pending' || t.status === 'Processing') : t.status === filterStatus);
    const typeMatch = filterType === "All" || t.task_type === filterType;
    return statusMatch && typeMatch;
  }).sort((a, b) => {
    if (sortOrder === "Newest") return b.id - a.id;
    return a.id - b.id;
  });

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("username");
    const storedAdmin = localStorage.getItem("is_admin") === "true";
    if (!storedToken) {
      router.push("/login");
    } else {
      setToken(storedToken);
      setUsername(storedUser || "Commander");
      setIsAdmin(storedAdmin);
    }
  }, [router]);

  const fetchTasks = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/tasks?limit=100`, { // Fetch more for stats
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);

        // Compute Stats
        const s = { active: 0, completed: 0, failed: 0, cancelled: 0 };
        data.forEach((t: Task) => {
          if (t.status === 'Processing' || t.status === 'Pending') s.active++;
          else if (t.status === 'Completed') s.completed++;
          else if (t.status === 'Failed') s.failed++;
          else if (t.status === 'Cancelled') s.cancelled++;
        });
        setStats(s);

      } else if (res.status === 401) {
        router.push("/login");
      }
    } catch (err) {
      console.error("Fetch tasks failed", err);
    }
  };

  const fetchQuota = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/users/me/quota`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQuota(prev => {
          setUsageVelocity(data.used - prev.used);
          return data;
        });
        setUsageHistory(prev => {
          const newHistory = [...prev, data.used];
          return newHistory.slice(-30); // Keep last 30 points
        });
      } else if (res.status === 401) {
        router.push("/login");
      }
    } catch (err) {
      console.error("Fetch quota failed", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTasks();
      fetchQuota();
      const interval = setInterval(() => {
        fetchTasks();
        fetchQuota();
      }, 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputData.trim() || !token) {
      alert("Please enter task instructions.");
      return;
    }

    // Capture values before any potential state changes
    const currentInput = inputData;
    const currentMaxTime = maxTime;
    const currentDuration = duration;
    const currentType = taskType;

    const previews: Task[] = [];
    for (let i = 0; i < replicas; i++) {
      previews.push({
        id: Date.now() + i, // Temp ID
        input_data: currentInput + (replicas > 1 ? ` (Replica #${i + 1})` : ""),
        status: "Pending",
        result: null,
        created_at: new Date().toISOString(),
        max_execution_time: currentMaxTime,
        is_cancelled: false,
        owner_id: 0,
        task_type: currentType,
        simulated_duration: currentDuration
      });
    }

    // Optimistic Update: Add to list immediately
    setTasks(prev => [...previews, ...prev]);
    setInputData("");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          input_data: currentInput,
          max_execution_time: currentMaxTime,
          task_type: currentType,
          simulated_duration: currentDuration,
          replicas: replicas
        }),
      });

      if (res.ok) {
        fetchTasks(); // Replace optimistic preview with real data
        fetchQuota();
      } else {
        const errorData = await res.json().catch(() => ({ detail: "Unknown error" }));
        alert(`Submission failed: ${errorData.detail || res.statusText}`);
        fetchTasks(); // Rollback
      }
    } catch {
      alert("Network error: Could not reach the API.");
      fetchTasks();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (e: React.MouseEvent, taskId: number) => {
    e.stopPropagation();
    if (!token) return;
    try {
      await fetch(`${API_URL}/tasks/${taskId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTasks(); // Immediate update
    } catch (err) {
      console.error("Cancel failed", err);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Are you sure you want to delete ALL tasks? This cannot be undone.")) return;
    if (!token) return;
    try {
      await fetch(`${API_URL}/tasks`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTasks();
    } catch (err) {
      console.error("Delete all failed", err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !token) return;
    setIsUpdatingProfile(true);
    try {
      const res = await fetch(`${API_URL}/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newUsername }),
      });
      if (res.ok) {
        localStorage.setItem("username", newUsername);
        setUsername(newUsername);
        setIsEditing(false);
        setNewUsername("");
      } else {
        const data = await res.json();
        alert(data.detail || "Update failed");
      }
    } catch (err) {
      console.error("Profile update failed", err);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const fetchAllUsers = async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error("Fetch users failed", err);
    }
  };

  const handleGlobalReset = async () => {
    if (!confirm("☢️ GLOBAL RESET:\nThis will PERMANENTLY delete ALL tasks for ALL users. Proceed?")) return;
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/reset-system`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTasks();
        fetchQuota();
        fetchAllUsers();
      }
    } catch (err) {
      console.error("Global reset failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKillAll = async () => {
    if (!confirm("🚨 EMERGENCY HALT:\nAre you sure you want to terminate ALL active and pending tasks?")) return;
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/tasks/kill-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTasks();
        fetchQuota();
      }
    } catch (err) {
      console.error("Kill all failed", err);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("is_admin");
    router.push("/login");
  };

  useEffect(() => {
    if (activeTab === 'admin') {
      fetchAllUsers();
    }
  }, [activeTab, token, isAdmin]); // Added token and isAdmin to dependencies

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image_gen': return '🖼️';
      case 'video_gen': return '🎥';
      case 'code_analysis': return '💻';
      default: return '📝';
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 flex pb-20 md:pb-0 font-sans selection:bg-indigo-500/30">
      {/* Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTask(null)}>
          <div className="glass w-full max-w-lg p-8 rounded-3xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-black/40 flex items-center justify-center text-3xl">
                  {getTypeIcon(selectedTask.task_type)}
                </div>
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    Task Details
                    <span className="text-xs font-mono text-gray-500">#{selectedTask.id}</span>
                  </h3>
                  <p className="text-xs text-indigo-400 font-mono uppercase tracking-widest">{selectedTask.task_type}</p>
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-gray-500 hover:text-white transition text-2xl">×</button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Current Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${selectedTask.status === 'Completed' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <p className="text-sm font-bold">{selectedTask.status}</p>
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Workload (Simulated)</p>
                  <p className="text-sm font-bold">{selectedTask.simulated_duration}s</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Max Timeout</p>
                  <p className="text-sm font-bold">{selectedTask.max_execution_time}s</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-500 uppercase mb-2">Input Payload</p>
                <div className="p-4 bg-black/40 rounded-xl font-mono text-xs border border-white/5 text-gray-300 break-all">
                  {selectedTask.input_data}
                </div>
              </div>

              {selectedTask.result && (
                <div>
                  <p className="text-[10px] text-green-400 uppercase mb-2 font-bold focus-within:ring-0">Result Output</p>
                  <pre className="p-4 bg-green-500/5 rounded-xl font-mono text-xs border border-green-500/10 text-green-200 whitespace-pre-wrap">
                    {selectedTask.result}
                  </pre>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-white/5">
                <p className="text-[10px] text-gray-500 font-mono">
                  Timestamp: {new Date(selectedTask.created_at).toLocaleString()}
                </p>
                {selectedTask.status === 'Processing' && !selectedTask.is_cancelled && (
                  <button
                    onClick={(e) => { handleCancel(e, selectedTask.id); setSelectedTask(null); }}
                    className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition"
                  >
                    HALT EXECUTION
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Sidebar */}
      <aside className="w-20 md:w-64 bg-black/40 border-r border-white/5 flex flex-col items-center md:items-stretch p-4 backdrop-blur-xl z-50">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-xl">🛰️</span>
          </div>
          <span className="hidden md:block font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            RESILIENT<span className="text-indigo-400">TASK</span>
          </span>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            { id: 'mission_control', label: 'Mission Control', icon: '📡' },
            { id: 'account', label: 'Account Profile', icon: '👤' },
            { id: 'admin', label: 'Admin Console', icon: '🛡️', adminOnly: true }
          ].filter(tab => !tab.adminOnly || isAdmin).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${activeTab === tab.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'}`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="hidden md:block font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="pt-4 border-t border-white/5 space-y-4">
          <div className="hidden md:block px-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Operator</p>
            <p className="text-sm font-bold truncate text-gray-300">{username}</p>
          </div>
          <button
            onClick={logout}
            className="w-full p-3 rounded-xl flex items-center gap-3 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
          >
            <span className="text-xl">🚪</span>
            <span className="hidden md:block font-medium">Abort Mission</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">/</span>
            <span className="text-sm font-medium text-gray-300 capitalize">{activeTab.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] text-gray-500 uppercase tracking-tighter">Cluster Connectivity Optimal</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {activeTab === 'mission_control' && (
            <div className="max-w-7xl mx-auto">
              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Active Jobs', val: stats.active, color: 'text-blue-300' },
                  { label: 'Completed', val: stats.completed, color: 'text-green-300' },
                  { label: 'Cancelled', val: stats.cancelled, color: 'text-red-300' },
                  { label: 'Failed', val: stats.failed, color: 'text-orange-300' }
                ].map(s => (
                  <div key={s.label} className="glass p-4 rounded-xl flex flex-col border border-white/5">
                    <span className={`text-[10px] ${s.color} uppercase tracking-wider mb-1 font-bold`}>{s.label}</span>
                    <span className="text-3xl font-bold text-white">{s.val}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Command Deck & Dispatch */}
                <div className="flex flex-col gap-6">
                  {/* Resource Command Deck */}
                  <div className={`glass p-6 rounded-2xl relative overflow-hidden transition-all duration-500 ${quota.used / quota.quota > 0.9 ? 'ring-2 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse' :
                    quota.used / quota.quota > 0.7 ? 'ring-1 ring-orange-400' : ''}`}>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-bold flex items-center gap-2">🛡️ Resource Command Deck</h2>
                      <div className="flex gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${usageVelocity > 0 ? 'bg-indigo-400 animate-ping' : 'bg-gray-600'}`}></span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-tighter font-mono">Live Pulse</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Live Trend Graph */}
                      <div className="h-24 w-full bg-black/30 rounded-xl overflow-hidden relative border border-white/5">
                        <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                          <path
                            d={`M ${usageHistory.map((val, i) => `${(i / Math.max(1, usageHistory.length - 1)) * 300},${100 - (val / quota.quota) * 100}`).join(' L ')}`}
                            fill="none"
                            stroke={quota.used / quota.quota > 0.9 ? '#ef4444' : '#6366f1'}
                            strokeWidth="2"
                            className="transition-all duration-500"
                          />
                          <path
                            d={`M 0,100 L ${usageHistory.map((val, i) => `${(i / Math.max(1, usageHistory.length - 1)) * 300},${100 - (val / quota.quota) * 100}`).join(' L ')} L 300,100 Z`}
                            fill={quota.used / quota.quota > 0.9 ? 'url(#grad-red)' : 'url(#grad-indigo)'}
                            className="transition-all duration-500"
                          />
                          <defs>
                            <linearGradient id="grad-indigo" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" style={{ stopColor: '#6366f1', stopOpacity: 0.2 }} />
                              <stop offset="100%" style={{ stopColor: '#6366f1', stopOpacity: 0 }} />
                            </linearGradient>
                            <linearGradient id="grad-red" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" style={{ stopColor: '#ef4444', stopOpacity: 0.2 }} />
                              <stop offset="100%" style={{ stopColor: '#ef4444', stopOpacity: 0 }} />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute top-2 left-2 text-[9px] text-gray-400 uppercase font-mono">Usage Trend (30s)</div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-gray-400 uppercase tracking-widest font-bold">Task Quota Usage</span>
                          <span className={quota.used / quota.quota > 0.9 ? 'text-red-500 font-bold animate-bounce' : quota.used / quota.quota > 0.7 ? 'text-orange-400' : 'text-indigo-400 font-bold'}>
                            {quota.used} / {quota.quota}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${quota.used / quota.quota > 0.9 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                              quota.used / quota.quota > 0.7 ? 'bg-orange-400' :
                                'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, (quota.used / quota.quota) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 font-mono">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 transition hover:bg-white/10">
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest">Available</p>
                          <p className="text-xl font-bold text-gray-200">{quota.available}</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 transition hover:bg-white/10">
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest">Velocity</p>
                          <p className={`text-xl font-bold ${usageVelocity > 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                            +{usageVelocity}<span className="text-[10px] text-gray-600 font-normal ml-1">/min</span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleKillAll}
                        className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 font-bold transition-all flex items-center justify-center gap-2 group mt-4 overflow-hidden relative"
                      >
                        <span className="group-hover:animate-ping">🚨</span> EMERGENCY HALT
                      </button>
                    </div>
                  </div>

                  {/* Dispatch Job Form */}
                  <div className="glass p-6 rounded-2xl border border-white/5">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">🚀 Dispatch Job Sequence</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-tighter">Job Type Selection</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['text_processing', 'image_gen', 'video_gen', 'code_analysis'].map(t => (
                            <button
                              key={t} type="button" onClick={() => setTaskType(t)}
                              className={`p-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1
                                ${taskType === t ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-lg' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'}`}
                            >
                              <span className="text-xl">{getTypeIcon(t)}</span>
                              <span className="capitalize">{t.replace('_', ' ')}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Simulated Workload (sec)</label>
                            <span className="text-xs font-mono text-indigo-400 font-bold">{duration}s</span>
                          </div>
                          <input
                            type="range" min="1" max="900" value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-indigo-500/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Task Replicas (Batch)</label>
                            <span className="text-xs font-mono text-indigo-400 font-bold">{replicas}x</span>
                          </div>
                          <input
                            type="range" min="1" max="100" value={replicas}
                            onChange={(e) => setReplicas(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-indigo-500/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Max Allowed Time (Timeout)</label>
                            <span className="text-xs font-mono text-indigo-400 font-bold">{maxTime}s</span>
                          </div>
                          <input
                            type="range" min="10" max="900" value={maxTime}
                            onChange={(e) => setMaxTime(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-indigo-500/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">Input Instructions</label>
                          <textarea
                            value={inputData}
                            onChange={(e) => setInputData(e.target.value)}
                            className="w-full p-4 rounded-xl glass-input min-h-[100px] text-sm font-mono"
                            placeholder="Describe the task parameters..."
                          />
                        </div>
                      </div>

                      <button
                        type="submit" disabled={loading}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-xl shadow-indigo-500/20 transition-all disabled:opacity-50"
                      >
                        {loading ? 'Initializing Sequence...' : 'Dispatch Request System'}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Right: Task Monitor */}
                <div className="lg:col-span-2 flex flex-col h-[800px]">
                  <div className="glass flex-1 rounded-2xl overflow-hidden flex flex-col border border-white/5">
                    <div className="p-4 border-b border-white/5 bg-white/5 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <h2 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Live Orbit Feed
                        </h2>
                      </div>

                      {/* Filters Toolbar */}
                      <div className="flex gap-2 text-xs">
                        <select
                          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-gray-300 outline-none focus:border-indigo-500/50"
                        >
                          {['All', 'Active', 'Completed', 'Failed', 'Cancelled'].map(s => <option key={s} value={s} className="bg-gray-800">{s} Status</option>)}
                        </select>
                        <select
                          value={filterType} onChange={e => setFilterType(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-gray-300 outline-none focus:border-indigo-500/50"
                        >
                          <option value="All" className="bg-gray-800">All Job Types</option>
                          {['text_processing', 'image_gen', 'video_gen', 'code_analysis'].map(t => <option key={t} value={t} className="bg-gray-800">{t.replace('_', ' ')}</option>)}
                        </select>
                        <select
                          value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-gray-300 outline-none focus:border-indigo-500/50 ml-auto"
                        >
                          <option value="Newest" className="bg-gray-800">Newest First</option>
                          <option value="Oldest" className="bg-gray-800">Oldest First</option>
                        </select>
                      </div>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar p-3 space-y-2 flex-1">
                      {filteredTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4 opacity-40">
                          <span className="text-5xl">🛰️</span>
                          <p className="text-sm font-bold">Orbit is currently clear of matching signals.</p>
                        </div>
                      )}
                      {filteredTasks.map((task) => (
                        <div
                          key={task.id} onClick={() => setSelectedTask(task)}
                          className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-white/10 transition-all cursor-pointer group flex items-center justify-between shadow-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-black/40 border border-white/5 transition-all
                              ${task.status === 'Processing' ? 'animate-pulse border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : ''}`}>
                              {getTypeIcon(task.task_type)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-gray-600">#{task.id}</span>
                                <span className="text-sm font-bold text-gray-200">{task.task_type.replace('_', ' ')}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className={`w-2 h-2 rounded-full 
                                  ${task.status === 'Completed' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                                    task.status === 'Processing' ? 'bg-blue-500 animate-pulse' :
                                      task.status === 'Failed' ? 'bg-orange-500' :
                                        task.status === 'Cancelled' ? 'bg-red-500' :
                                          'bg-yellow-500'}`} />
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{task.status}</span>
                                <span className="text-[10px] text-gray-600 font-mono pl-2 border-l border-white/10">{task.simulated_duration}s duration</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all text-xl pr-2">›</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="glass p-12 rounded-[2rem] border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-5xl shadow-2xl shadow-indigo-500/40 relative">
                    👤
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#050505] rounded-2xl flex items-center justify-center border border-white/5">
                      <span className="text-lg">✅</span>
                    </div>
                  </div>
                  <div className="text-center md:text-left">
                    <h1 className="text-5xl font-bold text-white mb-2">{username}</h1>
                    <div className="flex items-center gap-3 justify-center md:justify-start">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${isAdmin ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'}`}>
                        {isAdmin ? 'System Administrator' : 'Standard Operator'}
                      </span>
                      <span className="text-gray-600 font-mono text-xs">Registry ID: 0x{username.length}...{username.charCodeAt(0).toString(16)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                  {[
                    { label: 'Network Reach', val: stats.active + stats.completed + stats.failed + stats.cancelled, suffix: 'Tasks', color: 'text-indigo-400' },
                    { label: 'Assigned Quota', val: quota.quota, suffix: 'Units', color: 'text-purple-400' },
                    { label: 'Uptime Score', val: '99.9%', suffix: 'SLA', color: 'text-green-400' }
                  ].map(stat => (
                    <div key={stat.label} className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">{stat.label}</p>
                      <p className={`text-3xl font-bold ${stat.color}`}>{stat.val} <span className="text-xs text-gray-600 font-normal">{stat.suffix}</span></p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass p-8 rounded-3xl border border-white/5 h-full">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">👤 Protocol Identity</h3>
                  <div className="space-y-6">
                    {!isEditing ? (
                      <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 font-bold">Network Alias</p>
                          <p className="text-lg font-bold text-white">{username}</p>
                        </div>
                        <button
                          onClick={() => { setIsEditing(true); setNewUsername(username); }}
                          className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs rounded-lg border border-indigo-500/20 transition font-bold"
                        >
                          Modify ID
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-xl border border-indigo-500/30">
                          <label className="text-[10px] text-indigo-400 uppercase tracking-widest mb-2 block font-bold">New Network Alias</label>
                          <input
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-xl font-bold text-white placeholder:text-gray-700"
                            placeholder="Enter new alias..."
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isUpdatingProfile}
                            className="flex-1 py-3 bg-indigo-500 text-white text-xs rounded-xl font-bold hover:bg-indigo-600 transition"
                          >
                            {isUpdatingProfile ? "Syncing..." : "Commit Change"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-6 py-3 bg-white/5 text-gray-400 text-xs rounded-xl font-bold hover:bg-white/10 transition"
                          >
                            Abort
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 opacity-50 grayscale">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 font-bold">Encrypted Password</p>
                        <p className="text-sm font-mono text-gray-400">••••••••••••••••</p>
                      </div>
                      <span className="text-[10px] text-gray-600 font-bold italic">LOCKED</span>
                    </div>
                  </div>
                </div>

                <div className="glass p-8 rounded-3xl border border-white/5 h-full">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-red-400">🛡️ Data Sanctuary</h3>
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Purge your historical mission records from the local registry. This action is irreversible and affects only your personal dispatch logs.
                    </p>
                    <button
                      onClick={handleDeleteAll}
                      className="w-full py-4 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/10 rounded-2xl transition-all font-bold text-xs uppercase tracking-[0.2em] shadow-lg shadow-red-500/5"
                    >
                      Purge Personal History
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass p-8 rounded-3xl border border-white/5 opacity-70">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">🛡️ Security Protocols</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                    <div>
                      <p className="text-sm font-bold text-gray-200">JWT Authentication</p>
                      <p className="text-xs text-gray-500">Secure session management active</p>
                    </div>
                    <span className="text-green-500 font-bold text-xs uppercase tracking-widest">Active</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all opacity-50">
                    <div>
                      <p className="text-sm font-bold text-gray-200">2FA / Biometric</p>
                      <p className="text-xs text-gray-500">Not configured for this region</p>
                    </div>
                    <button className="text-[10px] text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-lg uppercase font-bold">Configure</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Active Fleets', val: allUsers.length, icon: '👥', color: 'border-indigo-500/20' },
                  { label: 'Global Load', val: allUsers.reduce((acc, u) => acc + u.tasks_dispatched, 0), icon: '📡', color: 'border-blue-500/20' },
                  { label: 'Admin Tokens', val: allUsers.filter(u => u.is_admin).length, icon: '🔑', color: 'border-purple-500/20' },
                  { label: 'Quota Cap', val: allUsers.reduce((acc, u) => acc + u.task_quota, 0), icon: '🔋', color: 'border-green-500/20' }
                ].map(stat => (
                  <div key={stat.label} className={`glass p-6 rounded-2xl border ${stat.color} flex flex-col`}>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">{stat.label}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-3xl font-bold text-white">{stat.val}</p>
                      <span className="text-2xl opacity-40">{stat.icon}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="glass p-1 rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold">User Registry Management</h3>
                    <p className="text-xs text-gray-500 mt-1">Global audit of all network operators and dispatch counts.</p>
                  </div>
                  <button
                    onClick={handleGlobalReset}
                    className="w-full md:w-auto px-6 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-500/10"
                  >
                    ☢️ Global Protocol Format
                  </button>
                </div>

                <div className="overflow-x-auto p-4">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-500 text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                        <th className="pb-6 pl-4 font-black">Operator Alias</th>
                        <th className="pb-6 font-black">Authorization Tier</th>
                        <th className="pb-6 font-black">Historical Dispatches</th>
                        <th className="pb-6 font-black">Resource Allocation</th>
                        <th className="pb-6 font-black">Network Index</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {allUsers.map(u => (
                        <tr key={u.id} className="text-sm group hover:bg-white/5 transition-all">
                          <td className="py-5 pl-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/5">👤</div>
                            <span className="font-bold text-gray-200">{u.username}</span>
                          </td>
                          <td className="py-5">
                            <span className={`px-2.5 py-1 rounded inline-flex items-center gap-1.5 text-[9px] font-black tracking-widest ${u.is_admin ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-500/20 text-gray-400'}`}>
                              <span className={`w-1 h-1 rounded-full ${u.is_admin ? 'bg-indigo-400' : 'bg-gray-500'}`}></span>
                              {u.is_admin ? 'ADMIN LEVEL' : 'OPERATOR'}
                            </span>
                          </td>
                          <td className="py-5 font-mono text-gray-400">{u.tasks_dispatched} jobs</td>
                          <td className="py-5">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-gray-400">{u.task_quota}</span>
                              <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500/50" style={{ width: `${Math.min(100, (u.tasks_dispatched / u.task_quota) * 100)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-5 font-mono text-[10px] text-gray-600">ID_0x{u.id.toString(16).padStart(4, '0')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
