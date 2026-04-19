import { useState, useEffect } from "react";
import { format } from "date-fns";
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
  LogOut
} from "lucide-react";

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
    if (confirm("Are you sure?")) {
      try {
        await deleteDoc(doc(db, "questions", id));
      } catch (error) {
        handleFirestoreError(error, 'delete', `questions/${id}`);
      }
    }
  };

  const saveConfig = async () => {
    try {
      await setDoc(doc(db, "config", "global"), localConfig);
      alert("Configuration saved!");
    } catch (error) {
      handleFirestoreError(error, 'write', 'config/global');
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

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <div>
            <h1 className="text-3xl font-serif text-white tracking-[2px] uppercase">Lodha Control</h1>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-[#888888] text-[11px] uppercase tracking-[1px]">Assessment Infrastructure</p>
              <div className="h-3 w-px bg-border-dark"></div>
              <button 
                onClick={onLogout}
                className="text-[10px] text-red-900 uppercase tracking-[1px] font-bold flex items-center gap-2 hover:text-red-700 transition-colors"
              >
                <LogOut className="w-3 h-3" /> Logout
              </button>
            </div>
          </div>
          <div className="flex bg-surface rounded p-1 border border-border-dark">
            <button 
              onClick={() => setActiveTab('questions')}
              className={`flex items-center gap-2 px-6 py-2 rounded font-bold text-[11px] uppercase tracking-[1px] transition-all ${activeTab === 'questions' ? 'bg-gold text-black shadow' : 'text-[#888888]'}`}
            >
              <BookOpen className="w-4 h-4" /> Questions
            </button>
            <button 
              onClick={() => setActiveTab('submissions')}
              className={`flex items-center gap-2 px-6 py-2 rounded font-bold text-[11px] uppercase tracking-[1px] transition-all ${activeTab === 'submissions' ? 'bg-gold text-black shadow' : 'text-[#888888]'}`}
            >
              <FileText className="w-4 h-4" /> Results
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-6 py-2 rounded font-bold text-[11px] uppercase tracking-[1px] transition-all ${activeTab === 'settings' ? 'bg-gold text-black shadow' : 'text-[#888888]'}`}
            >
              <SettingsIcon className="w-4 h-4" /> Settings
            </button>
          </div>
        </header>

        {activeTab === 'questions' ? (
          // ... existing questions tab logic ...
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-surface p-6 rounded border border-border-dark">
              <h2 className="text-sm font-bold text-gold uppercase tracking-[2px]">{questions.length} Active Records</h2>
              <button 
                onClick={addQuestion}
                className="lodha-btn lodha-btn-primary flex items-center gap-2"
              >
                <Plus className="w-5 h-5" /> New Record
              </button>
            </div>

            {editingQuestion && (
              <div className="bg-surface p-8 rounded border border-gold/30 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex justify-between mb-8 border-b border-border-dark pb-4">
                  <h3 className="font-serif italic text-xl text-white">{editingQuestion.id ? 'Modify Record' : 'Create Record'}</h3>
                  <button onClick={() => setEditingQuestion(null)} className="text-[#888888] hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-gold tracking-[2px] mb-1 block">Question Descriptor</label>
                    <textarea 
                      className="w-full p-6 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-[#e0e0e0] font-serif italic text-lg"
                      value={editingQuestion.text}
                      onChange={e => setEditingQuestion({...editingQuestion, text: e.target.value})}
                      placeholder="Input the inquiry..."
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {editingQuestion.options?.map((opt, idx) => (
                      <div key={idx} className="flex gap-4 items-center">
                        <button 
                          onClick={() => setEditingQuestion({...editingQuestion, correctAnswerIndex: idx})}
                          className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all shrink-0 ${editingQuestion.correctAnswerIndex === idx ? 'bg-gold border-gold text-black' : 'border-border-dark text-[#888888]'}`}
                        >
                          {editingQuestion.correctAnswerIndex === idx ? <Check className="w-5 h-5" /> : idx + 1}
                        </button>
                        <input 
                          className="flex-1 p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-[#e0e0e0]"
                          value={opt}
                          onChange={e => {
                            const newOpts = [...editingQuestion.options!];
                            newOpts[idx] = e.target.value;
                            setEditingQuestion({...editingQuestion, options: newOpts});
                          }}
                          placeholder={`Option ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-4 mt-8 pt-8 border-t border-border-dark">
                    <button onClick={() => setEditingQuestion(null)} className="px-6 py-2 text-[11px] font-bold text-[#888888] uppercase tracking-[1px]">Discard</button>
                    <button onClick={saveQuestion} className="lodha-btn lodha-btn-primary">Apply Changes</button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-surface p-6 rounded border border-border-dark flex gap-6 items-start group hover:border-gold/30 transition-all">
                  <div className="w-12 h-12 rounded bg-black flex items-center justify-center font-serif text-lg text-gold shrink-0 border border-border-dark">
                    {(idx + 1).toString().padStart(2, '0')}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-serif text-xl text-white mb-4 leading-relaxed">{q.text}</h4>
                    <div className="flex flex-wrap gap-2">
                       {q.options.map((opt, optIdx) => (
                         <span key={optIdx} className={`px-4 py-1 rounded text-[10px] font-bold tracking-[1px] uppercase ${optIdx === q.correctAnswerIndex ? 'bg-gold/10 text-gold border border-gold/20' : 'bg-black/40 text-[#555555] border border-border-dark'}`}>
                           {opt}
                         </span>
                       ))}
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingQuestion(q)}
                      className="p-3 text-gold hover:bg-gold/5 rounded"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => deleteQuestion(q.id!)}
                      className="p-3 text-red-900 hover:bg-red-950/20 rounded"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'submissions' ? (
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded border border-border-dark flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-bold text-gold uppercase tracking-[2px]">{submissions.length} Total Assessments</h2>
                <div className="text-[10px] text-[#888888] uppercase tracking-[1px]">Real-time evaluation records</div>
              </div>
              <button 
                onClick={downloadCSV}
                disabled={submissions.length === 0}
                className={`lodha-btn lodha-btn-primary flex items-center gap-2 ${submissions.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>

            <div className="bg-surface rounded border border-border-dark overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/40 border-b border-border-dark">
                    <th className="p-4 text-[10px] font-bold text-gold uppercase tracking-[2px]">Participant</th>
                    <th className="p-4 text-[10px] font-bold text-gold uppercase tracking-[2px]">Department</th>
                    <th className="p-4 text-[10px] font-bold text-gold uppercase tracking-[2px]">Score</th>
                    <th className="p-4 text-[10px] font-bold text-gold uppercase tracking-[2px]">Timestamp</th>
                    <th className="p-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark/50">
                  {submissions.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4">
                        <div className="text-white font-serif italic">{s.fullName}</div>
                        <div className="text-[10px] text-[#888888] uppercase tracking-[1px]">{s.email}</div>
                      </td>
                      <td className="p-4 text-[11px] text-[#e0e0e0] uppercase tracking-[1px] font-bold">{s.department}</td>
                      <td className="p-4 text-lg font-serif">
                        <span className={`
                          ${(s.score / s.totalQuestions) >= 0.7 ? 'text-green-500' : 'text-amber-500'}
                        `}>
                          {s.score}
                        </span>
                        <span className="text-[#555555]"> / {s.totalQuestions}</span>
                      </td>
                      <td className="p-4 text-[11px] text-[#888888] font-mono">
                        {format(s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.timestamp), "dd-MMM-yyyy")}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={async () => {
                            if (confirm("Permanently delete this record?")) {
                              await deleteDoc(doc(db, "submissions", s.id!));
                            }
                          }}
                          className="p-2 text-red-900 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-950/20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {submissions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <div className="text-[#555555] font-serif italic text-lg">No assessment records found.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
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
                      onChange={e => setLocalConfig({...localConfig, timerPerQuestion: parseInt(e.target.value)})}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Aesthetic Signature (Color)</label>
                    <div className="flex gap-6 items-center">
                      <div className="relative">
                        <input 
                          type="color" 
                          className="w-14 h-14 rounded-full border-0 cursor-pointer p-0 overflow-hidden bg-transparent"
                          value={localConfig.themePrimary}
                          onChange={e => setLocalConfig({...localConfig, themePrimary: e.target.value})}
                        />
                      </div>
                      <span className="font-mono text-[14px] text-gold uppercase tracking-[1px]">{localConfig.themePrimary}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Atmospheric Media URL</label>
                    <input 
                      className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-sm"
                      value={localConfig.backgroundUrl}
                      onChange={e => setLocalConfig({...localConfig, backgroundUrl: e.target.value})}
                      placeholder="IMAGE SOURCE URL"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-surface p-10 rounded border border-border-dark h-fit flex flex-col justify-between h-full">
                <div className="space-y-10">
                  <h3 className="text-sm font-bold text-gold uppercase tracking-[3px] flex items-center gap-3 border-b border-border-dark pb-4"><LinkIcon className="w-5 h-5" /> Data Transmissions</h3>
                  
                  <div className="space-y-8">
                    <div>
                      <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">External Records Webhook</label>
                      <textarea 
                        className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-[#888888] text-xs h-32 leading-relaxed"
                        value={localConfig.googleSheetsWebhookUrl}
                        onChange={e => setLocalConfig({...localConfig, googleSheetsWebhookUrl: e.target.value})}
                        placeholder="HTTPS ENDPOINT URL"
                      />
                      <p className="mt-4 text-[10px] text-[#555555] uppercase tracking-[1px] leading-relaxed">
                        Integration active: Participant data will be synchronized with the specified endpoint upon evaluation closure.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t border-border-dark">
                  <button 
                    onClick={saveConfig}
                    className="w-full lodha-btn lodha-btn-primary flex items-center justify-center gap-3"
                  >
                    <Save className="w-5 h-5" /> Commit Configuration
                  </button>
                </div>
              </div>
            </div>

            {/* Performance Configuration Section */}
            <div className="bg-surface p-10 rounded border border-border-dark">
              <div className="flex items-center justify-between border-b border-border-dark pb-6 mb-10">
                <h3 className="text-sm font-bold text-gold uppercase tracking-[3px] flex items-center gap-3">
                  <BarChart3 className="w-5 h-5" /> Performance Criteria & Feedback
                </h3>
              </div>

              <div className="grid lg:grid-cols-3 gap-12">
                {/* Thresholds */}
                <div className="space-y-8">
                  <h4 className="text-[11px] font-bold text-gold uppercase tracking-[2px] border-l-2 border-gold pl-3">Assessment Thresholds</h4>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Commendable (Excellent) %</label>
                      <input 
                        type="number" 
                        className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white font-mono"
                        value={localConfig.excellentThreshold}
                        onChange={e => setLocalConfig({...localConfig, excellentThreshold: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Criteria Met (Pass) %</label>
                      <input 
                        type="number" 
                        className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white font-mono"
                        value={localConfig.passThreshold}
                        onChange={e => setLocalConfig({...localConfig, passThreshold: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                {/* Feedback Configuration */}
                <div className="lg:col-span-2 grid md:grid-cols-2 gap-8">
                  <div className="space-y-8">
                    <h4 className="text-[11px] font-bold text-gold uppercase tracking-[2px] border-l-2 border-gold pl-3">Excellent Feedback</h4>
                    <div className="space-y-4">
                      <input 
                        className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-sm"
                        value={localConfig.excellentTitle}
                        onChange={e => setLocalConfig({...localConfig, excellentTitle: e.target.value})}
                        placeholder="Excellent Title"
                      />
                      <textarea 
                        className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-[#888888] text-xs h-24"
                        value={localConfig.excellentDesc}
                        onChange={e => setLocalConfig({...localConfig, excellentDesc: e.target.value})}
                        placeholder="Excellent Description"
                      />
                    </div>

                    <h4 className="text-[11px] font-bold text-[#888888] uppercase tracking-[2px] border-l-2 border-[#888888] pl-3">Pass Feedback</h4>
                    <div className="space-y-4">
                      <input 
                        className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-sm"
                        value={localConfig.passTitle}
                        onChange={e => setLocalConfig({...localConfig, passTitle: e.target.value})}
                        placeholder="Pass Title"
                      />
                      <textarea 
                        className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-[#888888] text-xs h-24"
                        value={localConfig.passDesc}
                        onChange={e => setLocalConfig({...localConfig, passDesc: e.target.value})}
                        placeholder="Pass Description"
                      />
                    </div>
                  </div>

                  <div className="space-y-8">
                    <h4 className="text-[11px] font-bold text-red-900 uppercase tracking-[2px] border-l-2 border-red-900 pl-3">Criteria Not Met Feedback</h4>
                    <div className="space-y-4">
                      <input 
                        className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-sm"
                        value={localConfig.failTitle}
                        onChange={e => setLocalConfig({...localConfig, failTitle: e.target.value})}
                        placeholder="Fail Title"
                      />
                      <textarea 
                        className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-[#888888] text-xs h-24"
                        value={localConfig.failDesc}
                        onChange={e => setLocalConfig({...localConfig, failDesc: e.target.value})}
                        placeholder="Fail Description"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
