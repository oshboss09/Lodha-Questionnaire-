import { useState, useEffect } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { UserDetails, GlobalConfig, Question, Submission } from "../types";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  setDoc
} from "firebase/firestore";
import { db, handleFirestoreError } from "../lib/firebase";
import { 
  Plus, 
  Trash2, 
  Save, 
  Settings as SettingsIcon, 
  BookOpen, 
  Check, 
  X,
  Layout,
  Link as LinkIcon,
  BarChart3,
  FileText,
  Download,
  LogOut,
  Loader2,
  Edit3
} from "lucide-react";
import UnifiedBackground from "./UnifiedBackground";

interface Props {
  config: GlobalConfig;
  onLogout: () => void;
}

export default function AdminPage({ config, onLogout }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'submissions' | 'settings'>('questions');
  const [localConfig, setLocalConfig] = useState<GlobalConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "questions"), orderBy("order"));
    const unsub = onSnapshot(q, (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    }, (error) => {
      handleFirestoreError(error, 'list', 'questions');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const s = query(collection(db, "submissions"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(s, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    }, (error) => {
      handleFirestoreError(error, 'list', 'submissions');
    });
    return () => unsub();
  }, []);

  const downloadCSV = () => {
    const headers = ["Participant", "Department", "Score", "Timestamp"];
    const rows = submissions.map(s => {
      const date = s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
      const ts = format(date, "dd-MMM-yyyy");
      return [
        s.fullName,
        s.department,
        `\t${s.score}/${s.totalQuestions}`,
        ts
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `lodha_results_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const saveQuestion = async () => {
    if (!editingQuestion.text || !editingQuestion.options || editingQuestion.options.length < 2) return;
    
    const data = {
      text: editingQuestion.text,
      options: editingQuestion.options,
      correctAnswerIndex: editingQuestion.correctAnswerIndex ?? 0,
      order: editingQuestion.order ?? questions.length,
    };

    try {
      if (editingQuestion.id) {
        await updateDoc(doc(db, "questions", editingQuestion.id), data);
      } else {
        await addDoc(collection(db, "questions"), data);
      }
      setEditingQuestion(null);
    } catch (error) {
      handleFirestoreError(error, editingQuestion.id ? 'update' : 'create', 'questions');
    }
  };

  const deleteQuestion = async (id: string) => {
    try {
      await deleteDoc(doc(db, "questions", id));
      setConfirmingDeleteId(null);
    } catch (error: any) {
      console.error("Delete question failed:", error);
      alert(`Error deleting record: ${error.message}`);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "config", "global"), localConfig);
      alert("Lodha System Attributes Globally Committed.");
    } catch (error) {
      handleFirestoreError(error, 'write', 'config/global');
    } finally {
      setIsSaving(false);
    }
  };

  const addQuestion = () => {
    setEditingQuestion({
      text: "",
      options: ["", "", "", ""],
      correctAnswerIndex: 0,
      order: questions.length
    });
  };

  const deleteSubmission = async (id: string) => {
    if (!id) {
      console.error("No ID provided for deletion");
      return;
    }
    
    try {
      const docRef = doc(db, "submissions", id);
      await deleteDoc(docRef);
      setConfirmingDeleteId(null);
    } catch (error: any) {
      console.error("Critical error during deletion:", error);
      alert(`Failed to delete assessment: ${error.message}`);
    }
  };

  const renderQuestionsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface p-6 rounded border border-border-dark">
        <h2 className="text-sm font-bold text-gold uppercase tracking-[2px]">{questions.length} Active Records</h2>
        <button onClick={addQuestion} className="lodha-btn lodha-btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" /> New Record
        </button>
      </div>
      <div className="grid gap-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-surface p-6 rounded border border-border-dark flex gap-6 items-start group hover:border-gold/30 transition-all">
            <div className="w-12 h-12 rounded bg-black flex items-center justify-center font-serif text-lg text-gold shrink-0 border border-border-dark">
              {(idx + 1).toString().padStart(2, '0')}
            </div>
            <div className="flex-1">
              <h4 className="font-serif text-xl text-white mb-4 leading-relaxed">{q.text}</h4>
            </div>
            <div className="flex gap-2">
              {confirmingDeleteId === q.id ? (
                <div className="flex items-center gap-2 bg-black/40 p-1 rounded border border-red-900/30">
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id!); }}
                    className="bg-red-600 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }}
                    className="bg-gray-700 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setEditingQuestion(q)} 
                    className="p-3 text-gold hover:bg-gold/5 rounded"
                    title="Edit Question"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setConfirmingDeleteId(q.id!)} 
                    className="p-3 text-red-900 hover:bg-red-950/20 rounded"
                    title="Delete Question"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSubmissionsTab = () => (
    <div className="space-y-6">
      <div className="bg-surface p-6 rounded border border-border-dark flex justify-between items-center">
        <h2 className="text-sm font-bold text-gold uppercase tracking-[2px]">{submissions.length} Total Assessments</h2>
        <button onClick={downloadCSV} className="lodha-btn lodha-btn-primary flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
      <div className="bg-surface rounded border border-border-dark overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-black/40 border-b border-border-dark">
            <tr>
              <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Participant</th>
              <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Department</th>
              <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Score</th>
              <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Timestamp</th>
              <th className="p-4 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-dark/50">
            {submissions.map((s) => (
              <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="p-4">
                  <div className="text-white font-serif italic text-sm">{s.fullName}</div>
                  <div className="text-[10px] text-[#888888] font-mono mt-0.5">{s.email}</div>
                </td>
                <td className="p-4">
                  <span className="text-[#888888] text-xs uppercase tracking-[1px]">{s.department}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-lg text-white">{s.score}</span>
                    <span className="text-[#444444] text-sm">/ {s.totalQuestions}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-[#888888] text-xs font-mono">
                    {s.timestamp?.toDate ? format(s.timestamp.toDate(), "MMM dd, yyyy HH:mm") : "Pending..."}
                  </div>
                </td>
                <td className="p-4 text-right">
                  {confirmingDeleteId === s.id ? (
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        onClick={(e) => { e.stopPropagation(); deleteSubmission(s.id!); }}
                        className="bg-red-600 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase"
                      >
                        Confirm
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }}
                        className="bg-gray-700 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (s.id) setConfirmingDeleteId(s.id);
                      }} 
                      className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-md font-bold text-[10px] tracking-wider uppercase transition-all border border-red-600/30"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-surface p-10 rounded border border-border-dark space-y-10">
          <h3 className="text-sm font-bold text-gold uppercase tracking-[3px] flex items-center gap-3 border-b border-border-dark pb-4"><Layout className="w-5 h-5" /> System Attributes</h3>
          
          <div className="space-y-8">
            <div>
              <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Evaluation Latency (Seconds)</label>
              <input 
                type="number" 
                className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white font-mono"
                value={localConfig.timerPerQuestion}
                onChange={e => setLocalConfig(prev => ({...prev, timerPerQuestion: parseInt(e.target.value)}))}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Aesthetic Signature (Color)</label>
              <div className="flex gap-6 items-center">
                <input 
                  type="color" 
                  className="w-14 h-14 rounded-full border-0 cursor-pointer p-0 overflow-hidden bg-transparent"
                  value={localConfig.themePrimary}
                  onChange={e => setLocalConfig(prev => ({...prev, themePrimary: e.target.value}))}
                />
                <span className="font-mono text-[14px] text-gold uppercase tracking-[1px]">{localConfig.themePrimary}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface p-10 rounded border border-border-dark h-full">
          <h3 className="text-sm font-bold text-gold uppercase tracking-[3px] flex items-center gap-3 border-b border-border-dark pb-4"><LinkIcon className="w-5 h-5" /> Data Transmissions</h3>
          <div className="space-y-8 mt-10">
            <div>
              <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Webhook URL</label>
              <textarea 
                className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-[#888888] text-xs h-32 leading-relaxed"
                value={localConfig.googleSheetsWebhookUrl}
                onChange={e => setLocalConfig(prev => ({...prev, googleSheetsWebhookUrl: e.target.value}))}
                placeholder="HTTPS ENDPOINT URL"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface p-10 rounded border border-border-dark">
        <h3 className="text-sm font-bold text-gold uppercase tracking-[3px] flex items-center gap-3 border-b border-border-dark pb-6 mb-10">
          <BarChart3 className="w-5 h-5" /> Performance Criteria & Feedback
        </h3>
        <div className="grid lg:grid-cols-3 gap-12">
          <div className="space-y-8">
            <h4 className="text-[11px] font-bold text-gold uppercase tracking-[2px] border-l-2 border-gold pl-3">Assessment Thresholds</h4>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Commendable (Excellent) %</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white font-mono"
                  value={localConfig.excellentThreshold}
                  onChange={e => setLocalConfig(prev => ({...prev, excellentThreshold: parseInt(e.target.value)}))}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Criteria Met (Pass) %</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white font-mono"
                  value={localConfig.passThreshold}
                  onChange={e => setLocalConfig(prev => ({...prev, passThreshold: parseInt(e.target.value)}))}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 grid md:grid-cols-2 gap-8">
            <div className="space-y-8">
              <h4 className="text-[11px] font-bold text-gold uppercase tracking-[2px] border-l-2 border-gold pl-3">Excellent Feedback</h4>
              <input 
                className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-sm"
                value={localConfig.excellentTitle}
                onChange={e => setLocalConfig(prev => ({...prev, excellentTitle: e.target.value}))}
                placeholder="Title"
              />
              <textarea 
                className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-[#888888] text-xs h-24"
                value={localConfig.excellentDesc}
                onChange={e => setLocalConfig(prev => ({...prev, excellentDesc: e.target.value}))}
                placeholder="Description"
              />
            </div>
            <div className="space-y-8">
              <h4 className="text-[11px] font-bold text-gold uppercase tracking-[2px] border-l-2 border-gold pl-3">Pass Feedback</h4>
              <input 
                className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-sm"
                value={localConfig.passTitle}
                onChange={e => setLocalConfig(prev => ({...prev, passTitle: e.target.value}))}
                placeholder="Title"
              />
              <textarea 
                className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-[#888888] text-xs h-24"
                value={localConfig.passDesc}
                onChange={e => setLocalConfig(prev => ({...prev, passDesc: e.target.value}))}
                placeholder="Description"
              />
            </div>
            <div className="space-y-8 md:col-span-2">
              <h4 className="text-[11px] font-bold text-red-900 uppercase tracking-[2px] border-l-2 border-red-900 pl-3">Criteria Not Met Feedback</h4>
              <input 
                className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-sm"
                value={localConfig.failTitle}
                onChange={e => setLocalConfig(prev => ({...prev, failTitle: e.target.value}))}
                placeholder="Title"
              />
              <textarea 
                className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-[#888888] text-xs h-24"
                value={localConfig.failDesc}
                onChange={e => setLocalConfig(prev => ({...prev, failDesc: e.target.value}))}
                placeholder="Description"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface p-6 rounded border border-border-dark flex items-center justify-center gap-6">
        <button 
          onClick={saveConfig}
          disabled={isSaving}
          className="lodha-btn lodha-btn-primary flex items-center justify-center gap-3 px-10 py-4 min-w-[240px]"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  return (
    <UnifiedBackground>
      <div className="flex-1 p-4 md:p-8 overflow-y-auto min-h-screen">
        <div className="max-w-5xl mx-auto space-y-12">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface/40 backdrop-blur-md p-6 rounded border border-border-dark">
            <div>
              <h1 className="text-3xl font-serif text-white tracking-[2px] uppercase">Lodha Control</h1>
              <button 
                onClick={onLogout}
                className="text-[10px] text-red-900 uppercase tracking-[1px] font-bold flex items-center gap-2 mt-2 hover:opacity-80"
              >
                <LogOut className="w-3 h-3" /> Logout
              </button>
            </div>
            <div className="flex bg-surface rounded p-1 border border-border-dark">
              {(['questions', 'submissions', 'settings'] as const).map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`px-6 py-2 rounded font-bold text-[10px] uppercase tracking-[1px] transition-all ${activeTab === tab ? 'bg-gold text-black shadow' : 'text-[#888888] hover:bg-white/5'}`}
                 >
                   {tab}
                 </button>
              ))}
            </div>
          </header>

          <main className="animate-in fade-in duration-500">
            {activeTab === 'questions' && renderQuestionsTab()}
            {activeTab === 'submissions' && renderSubmissionsTab()}
            {activeTab === 'settings' && renderSettingsTab()}
          </main>
        </div>
      </div>

      {/* Question Editor Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface border border-border-dark rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-border-dark flex justify-between items-center bg-black/20">
              <h3 className="text-sm font-bold text-gold uppercase tracking-[3px]">
                {editingQuestion.id ? 'Refine Record' : 'Create New Record'}
              </h3>
              <button 
                onClick={() => setEditingQuestion(null)}
                className="text-[#888888] hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Inquiry / Statement</label>
                <textarea 
                  className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-lg font-serif italic"
                  value={editingQuestion.text}
                  onChange={e => setEditingQuestion({...editingQuestion, text: e.target.value})}
                  placeholder="Enter the assessment inquiry..."
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] block">Response Options</label>
                {editingQuestion.options?.map((opt, idx) => (
                  <div key={idx} className="flex gap-4 items-center group">
                    <button 
                      onClick={() => setEditingQuestion({...editingQuestion, correctAnswerIndex: idx})}
                      className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-all ${editingQuestion.correctAnswerIndex === idx ? 'bg-gold border-gold text-black' : 'border-border-dark text-[#444444] hover:border-gold/50'}`}
                    >
                      {editingQuestion.correctAnswerIndex === idx ? <Check className="w-5 h-5" /> : (idx + 1)}
                    </button>
                    <input 
                      className="flex-1 p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-sm"
                      value={opt}
                      onChange={e => {
                        const newOps = [...(editingQuestion.options || [])];
                        newOps[idx] = e.target.value;
                        setEditingQuestion({...editingQuestion, options: newOps});
                      }}
                      placeholder={`Option ${idx + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-black/20 border-t border-border-dark flex justify-end gap-4">
              <button 
                onClick={() => setEditingQuestion(null)}
                className="px-8 py-3 rounded font-bold text-[10px] uppercase tracking-[2px] text-[#888888] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={saveQuestion}
                className="lodha-btn lodha-btn-primary px-10 py-3"
              >
                Save Record
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </UnifiedBackground>
  );
}
