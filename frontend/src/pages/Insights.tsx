import { useState, useEffect } from 'react';
import {
  BarChart3, FileText, MessageSquare, TrendingUp,
  CheckCircle2, XCircle, HardDrive, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { getDashboardStats } from '../services/api';
import type { DashboardStats } from '../types';

function formatBytes(b: number) {
  if (b === 0) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

export default function Insights() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="flex gap-1"><div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" /></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Could not load analytics. Is the backend running?</p>
      </div>
    );
  }

  const successRate = stats.processing_success_rate;
  const failRate = 100 - successRate;

  const pieData = [
    { name: 'Success', value: successRate || 0 },
    { name: 'Failed', value: failRate || 0 },
  ].filter(d => d.value > 0);

  const overviewCards = [
    { label: 'Documents Uploaded', value: stats.total_documents, icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Successfully Indexed', value: stats.processed_documents, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Total Questions', value: stats.total_questions, icon: MessageSquare, color: 'text-violet-600 bg-violet-50' },
    { label: 'Conversations', value: stats.total_conversations, icon: Activity, color: 'text-sky-600 bg-sky-50' },
    { label: 'Total Messages', value: stats.total_messages, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
    { label: 'Storage Used', value: formatBytes(stats.storage_used_bytes), icon: HardDrive, color: 'text-rose-600 bg-rose-50' },
  ];

  // Build bar data from recent documents
  const barData = stats.recent_documents.map(doc => ({
    name: doc.original_filename.length > 12 ? doc.original_filename.substring(0, 12) + '...' : doc.original_filename,
    pages: doc.num_pages,
    chunks: doc.num_chunks,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-navy-800)] flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" /> Insights & Analytics
        </h2>
        <p className="text-sm text-gray-500 mt-1">Real-time metrics from your DocuMind AI usage</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {overviewCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className="text-xl font-bold text-[var(--color-navy-800)]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart: recent docs */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Recent Documents — Pages & Chunks</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="pages" fill="#6366f1" radius={[4, 4, 0, 0]} name="Pages" />
                <Bar dataKey="chunks" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Chunks" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-gray-400">
              No document data yet
            </div>
          )}
        </div>

        {/* Pie chart: processing success rate */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Processing Success Rate</h3>
          {stats.total_documents > 0 ? (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={idx === 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    formatter={(v: number) => `${v.toFixed(1)}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-gray-400">
              No processing data yet
            </div>
          )}
          <div className="flex justify-center gap-6 mt-2 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500" /> Success ({successRate.toFixed(1)}%)
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" /> Failed ({failRate.toFixed(1)}%)
            </div>
          </div>
        </div>
      </div>

      {/* Most used documents */}
      {stats.recent_documents.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Document Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4">Document</th>
                  <th className="pb-2 pr-4">Pages</th>
                  <th className="pb-2 pr-4">Chunks</th>
                  <th className="pb-2 pr-4">Characters</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recent_documents.map(doc => (
                  <tr key={doc.id}>
                    <td className="py-2.5 pr-4 font-medium truncate max-w-[200px]">{doc.original_filename}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{doc.num_pages}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{doc.num_chunks}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{doc.text_length.toLocaleString()}</td>
                    <td className="py-2.5">
                      <span className={`status-badge status-${doc.processing_status}`}>
                        {doc.processing_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
