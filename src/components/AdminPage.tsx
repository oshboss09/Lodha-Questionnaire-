import { useState, useEffect, ChangeEvent, useRef } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
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
  Edit3,
  FileSpreadsheet,
  Upload
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
  const [uploadPreview, setUploadPreview] = useState<Omit<Question, "id">[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [isConfirmingBulk, setIsConfirmingBulk] = useState(false);

  const selectAllRef = useRef<HTMLInputElement>(null);

  const visibleIds = submissions.map(s => s.id).filter(Boolean) as string[];
  const selectedCount = selectedIds.filter(id => visibleIds.includes(id)).length;
  const isAllSelected = visibleIds.length > 0 && selectedCount === visibleIds.length;
  const isSomeSelected = selectedCount > 0 && selectedCount < visibleIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    if (selectedCount === 0) {
      setIsConfirmingBulk(false);
    }
  }, [selectedCount]);

  const handleSelectAllChange = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleIds);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id) 
        : [...prev, id]
    );
  };

  const deleteSelectedSubmissions = async () => {
    const idsToDelete = selectedIds.filter(id => visibleIds.includes(id));
    if (idsToDelete.length === 0) return;

    setBulkDeleting(true);
    try {
      const deletePromises = idsToDelete.map(id => {
        return deleteDoc(doc(db, "submissions", id));
      });
      await Promise.all(deletePromises);
      setSelectedIds([]);
      setIsConfirmingBulk(false);
    } catch (error: any) {
      console.error("Bulk deletion failed:", error);
      alert(`Error during bulk deletion: ${error.message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

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
    const headers = ["Participant", "Email", "Department", "Score", "Status", "Timestamp"];
    const rows = submissions.map(s => {
      const date = s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
      const ts = format(date, "dd-MMM-yyyy");
      const isComp = s.status?.toLowerCase() === "complete";
      return [
        s.fullName,
        s.email,
        s.department,
        `\t${s.score}/${s.totalQuestions}`,
        isComp ? "Complete" : "Incomplete",
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

  const downloadExcelTemplate = () => {
    try {
      const wsData = [
        ["Question", "Option A", "Option B", "Option C", "Option D", "Option E", "Correct Answer"],
        ["What is 2+2?", "3", "4", "5", "", "", "B"],
        ["Which planet is closest to the Sun?", "Venus", "Mercury", "Earth", "Mars", "", "B"],
        ["What is the capital of France?", "Berlin", "Rome", "Paris", "Madrid", "Amsterdam", "C"]
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Auto-size columns for premium styling
      const maxCols = [45, 20, 20, 20, 20, 20, 20];
      ws["!cols"] = maxCols.map(w => ({ wch: w }));
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Evaluation Template");
      
      XLSX.writeFile(wb, "lodha_questions_template.xlsx");
    } catch (error) {
      console.error("Template generation failed", error);
      alert("Failed to generate Excel template. Please try again.");
    }
  };

  const handleExcelUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (rawRows.length <= 1) {
          alert("The uploaded Excel details seem empty. Please ensure the Excel contains headers and questions.");
          return;
        }

        const headers = rawRows[0].map(h => h ? String(h).trim().toLowerCase() : "");
        const questionColIdx = Math.max(0, headers.findIndex(h => h.includes("question")));
        const correctColIdx = headers.findIndex(h => h.includes("correct"));

        const parsed: Omit<Question, "id">[] = [];
        
        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;
          
          const qText = row[questionColIdx] ? String(row[questionColIdx]).trim() : "";
          if (!qText) continue;

          // Collect options dynamically from columns between Question and Correct Answer keys
          const options: string[] = [];
          for (let j = 1; j < row.length; j++) {
            if (j === correctColIdx || j === questionColIdx) continue;
            const val = row[j] !== undefined && row[j] !== null ? String(row[j]).trim() : "";
            if (val !== "") {
              options.push(val);
            }
          }

          if (options.length < 2) {
            continue;
          }

          const correctSel = correctColIdx !== -1 && row[correctColIdx] !== undefined && row[correctColIdx] !== null 
            ? String(row[correctColIdx]).trim() 
            : "A";
          
          let correctIndex = 0;
          
          // 1. Try to find if correctSel matches exactly to one of the options (case-insensitive)
          const textMatchIndex = options.findIndex(opt => opt.toLowerCase() === correctSel.toLowerCase());
          if (textMatchIndex !== -1) {
            correctIndex = textMatchIndex;
          } else {
            // 2. Otherwise try matching as letter label A, B, C, D, E...
            const upperSel = correctSel.toUpperCase();
            if (upperSel.length === 1 && upperSel >= 'A' && upperSel <= 'Z') {
              const charCode = upperSel.charCodeAt(0) - 65; // 'A' is 65 -> 0, 'B' is 66 -> 1, etc.
              if (charCode >= 0 && charCode < options.length) {
                correctIndex = charCode;
              } else {
                correctIndex = 0;
              }
            } else if (!isNaN(Number(correctSel))) {
              // 3. Match 1-indexed number
              const num = parseInt(correctSel) - 1;
              if (num >= 0 && num < options.length) {
                correctIndex = num;
              } else {
                correctIndex = 0;
              }
            } else {
              correctIndex = 0;
            }
          }

          parsed.push({
            text: qText,
            options,
            correctAnswerIndex: correctIndex,
            order: parsed.length
          });
        }

        if (parsed.length === 0) {
          alert("Could not parse any valid questions. Please verify column headers: Question, Option A, Option B, Option C, Option D, Option E, Correct Answer.");
          return;
        }

        setUploadPreview(parsed);
      } catch (err: any) {
        console.error("Excel processing failed", err);
        alert(`Error parsing Excel sheets: ${err.message || err}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const commitImport = async () => {
    if (!uploadPreview || uploadPreview.length === 0) return;
    setIsImporting(true);
    
    try {
      const deletePromises = questions.map(q => {
        if (q.id) {
          return deleteDoc(doc(db, "questions", q.id));
        }
        return Promise.resolve();
      });
      await Promise.all(deletePromises);

      const addPromises = uploadPreview.map(async (q, index) => {
        const data = {
          text: q.text,
          options: q.options,
          correctAnswerIndex: q.correctAnswerIndex,
          order: index
        };
        return addDoc(collection(db, "questions"), data);
      });
      await Promise.all(addPromises);

      alert(`Successfully imported ${uploadPreview.length} questions. All existing questions replaced.`);
      setUploadPreview(null);
    } catch (error: any) {
      console.error("Bulk commit failed:", error);
      alert(`Bulk database import failed: ${error.message || error}`);
    } finally {
      setIsImporting(false);
    }
  };

  const saveQuestion = async () => {
    if (!editingQuestion.text || !editingQuestion.options) return;
    
    const cleanOptions = editingQuestion.options.map(o => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      alert("A question must have at least 2 non-empty answer options.");
      return;
    }

    const clampedIndex = Math.min(
      Math.max(0, editingQuestion.correctAnswerIndex ?? 0),
      cleanOptions.length - 1
    );

    const data = {
      text: editingQuestion.text,
      options: cleanOptions,
      correctAnswerIndex: clampedIndex,
      order: editingQuestion.order ?? questions.length
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
      alert(`Error deleting question: ${error.message}`);
    }
  };

  const saveConfig = async () => {
    const n = localConfig.questionsPerAssessment;
    if (n !== undefined) {
      if (!Number.isInteger(n) || n <= 0) {
        alert("Number of questions per assessment must be a positive integer.");
        return;
      }
      if (questions.length > 0 && n > questions.length) {
        alert(`Number of questions per assessment (${n}) cannot exceed the total number of active questions in the pool (${questions.length}).`);
        return;
      }
    }

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
      <div className="flex flex-col lg:flex-row justify-between lg:items-center bg-surface p-6 rounded border border-border-dark gap-6">
        <div>
          <h2 className="text-sm font-bold text-gold uppercase tracking-[2px]">{questions.length} Questions</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={addQuestion} className="lodha-btn lodha-btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Question
          </button>
        </div>
      </div>

      {/* Bulk Import Administration Section */}
      <div className="bg-surface/50 p-6 rounded border border-border-dark flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-gold uppercase tracking-[1.5px] flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-gold" /> Bulk Question Management
          </h3>
          <p className="text-[11px] text-[#888888]">
            Download the standardized Excel template. Fill it in and upload the questionnaire.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto shrink-0">
          <button 
            onClick={downloadExcelTemplate} 
            className="lodha-btn border border-gold/30 hover:border-gold/80 hover:bg-gold/5 text-gold flex items-center gap-2 text-[10px] uppercase font-bold"
          >
            <Download className="w-4 h-4" /> Download Template
          </button>
          
          <label className="lodha-btn border border-gold hover:bg-gold hover:text-black text-gold flex items-center gap-2 text-[10px] uppercase font-bold cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            Upload File
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              onChange={handleExcelUpload} 
              className="hidden" 
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-surface p-6 rounded border border-border-dark flex gap-6 items-start group hover:border-gold/30 transition-all">
            <div className="w-12 h-12 rounded bg-black flex items-center justify-center font-serif text-lg text-gold shrink-0 border border-border-dark">
              {(idx + 1).toString().padStart(2, '0')}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="text-[10px] text-[#888888] font-mono">
                  {q.options?.length || 0} Choices
                </span>
              </div>
              
              <h4 className="font-serif text-xl text-white mb-4 leading-relaxed">{q.text}</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                {q.options?.map((opt, oIdx) => (
                  <div 
                    key={oIdx} 
                    className={`p-2.5 rounded text-xs border ${q.correctAnswerIndex === oIdx ? 'bg-gold/5 border-gold/30 text-gold' : 'bg-black/20 border-border-dark/40 text-gray-400'}`}
                  >
                    <span className="font-mono text-[9px] uppercase opacity-75 mr-1.5">[{String.fromCharCode(65 + oIdx)}]</span>
                    {opt}
                    {q.correctAnswerIndex === oIdx && (
                      <span className="ml-1.5 text-[8px] uppercase font-bold text-gold tracking-widest pl-1.5 border-l border-gold/20">(Correct)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 shrink-0">
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
                    className="bg-gray-700 text-[#888888] px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all hover:bg-gray-600"
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
        <div className="flex gap-3">
          {isConfirmingBulk ? (
            <div className="flex items-center gap-2 bg-black/40 p-1 rounded border border-red-900/30">
              <button 
                onClick={deleteSelectedSubmissions} 
                disabled={bulkDeleting}
                className="bg-red-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase hover:bg-red-700 transition-all flex items-center gap-2"
              >
                {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm ({selectedCount})
              </button>
              <button 
                onClick={() => setIsConfirmingBulk(false)}
                disabled={bulkDeleting}
                className="bg-gray-700 text-white px-4 py-2 rounded text-[10px] font-bold uppercase hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsConfirmingBulk(true)} 
              disabled={selectedCount === 0}
              className={`lodha-btn flex items-center gap-2 transition-all text-[10px] uppercase font-bold ${
                selectedCount === 0 
                  ? "bg-red-950/20 text-red-500/40 border border-red-950/30 cursor-not-allowed opacity-50" 
                  : "bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/30"
              }`}
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({selectedCount})
            </button>
          )}
          <button onClick={downloadCSV} className="lodha-btn lodha-btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      <div className="bg-surface rounded border border-border-dark overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-black/40 border-b border-border-dark">
            <tr>
              <th className="p-4 w-12 text-center">
                <input 
                  type="checkbox" 
                  ref={selectAllRef}
                  checked={isAllSelected}
                  onChange={handleSelectAllChange}
                  className="w-4 h-4 accent-gold bg-black/40 border-border-dark rounded cursor-pointer"
                />
              </th>
              <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Participant</th>
              <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Email</th>
              <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Department</th>
              <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Score</th>
              <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Status</th>
              <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Timestamp</th>
              <th className="p-4 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-dark/50">
            {submissions.map((s) => {
              const isComp = s.status?.toLowerCase() === "complete";
              return (
                <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4 w-12 text-center">
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(s.id!)}
                      onChange={() => handleSelectRow(s.id!)}
                      className="w-4 h-4 accent-gold bg-black/40 border-border-dark rounded cursor-pointer"
                    />
                  </td>
                  <td className="p-4">
                    <div className="text-white font-serif italic text-sm">{s.fullName}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-[11px] text-[#888888] font-mono">{s.email}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-[#888888] text-xs uppercase tracking-[1px]">{s.department}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-serif text-lg text-white">{s.score}</span>
                      <span className="text-gold font-black text-lg">/</span>
                      <span className="text-[#888888] text-sm">{s.totalQuestions}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] uppercase font-bold tracking-[1px] px-2.5 py-1 rounded inline-block ${
                      isComp 
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}>
                      {isComp ? "Complete" : "Incomplete"}
                    </span>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-8">
      <div className="bg-surface p-10 rounded border border-border-dark space-y-10">
        <h3 className="text-sm font-bold text-gold uppercase tracking-[3px] flex items-center gap-3 border-b border-border-dark pb-4"><Layout className="w-5 h-5" /> System Attributes</h3>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Evaluation Latency (Seconds)</label>
            <input 
              type="number" 
              className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white font-mono"
              value={isNaN(localConfig.timerPerQuestion) ? "" : localConfig.timerPerQuestion}
              onChange={e => {
                const val = parseInt(e.target.value);
                setLocalConfig(prev => ({...prev, timerPerQuestion: isNaN(val) ? 0 : val}));
              }}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Font Colour</label>
            <div className="flex gap-4 items-center">
              <input 
                type="color" 
                className="w-12 h-12 rounded-full border-0 cursor-pointer p-0 overflow-hidden bg-transparent shrink-0"
                value={localConfig.themePrimary || "#c5a47e"}
                onChange={e => setLocalConfig(prev => ({...prev, themePrimary: e.target.value}))}
              />
              <input
                type="text"
                maxLength={7}
                className="p-3 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white font-mono text-sm w-full uppercase"
                placeholder="#HEXCODE"
                value={localConfig.themePrimary || "#c5a47e"}
                onChange={e => {
                  let val = e.target.value;
                  if (val && !val.startsWith("#") && /^[0-9A-Fa-f]{1,6}$/.test(val)) {
                    val = "#" + val;
                  }
                  setLocalConfig(prev => ({...prev, themePrimary: val}));
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface p-10 rounded border border-border-dark space-y-10">
        <h3 className="text-sm font-bold text-gold uppercase tracking-[3px] flex items-center gap-3 border-b border-border-dark pb-4">
          <BookOpen className="w-5 h-5" /> Assessment Settings
        </h3>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Number of questions per assessment</label>
            <input 
              type="number" 
              className={`w-full p-4 bg-black/40 border rounded outline-none text-white font-mono transition-all ${
                localConfig.questionsPerAssessment !== undefined && (localConfig.questionsPerAssessment <= 0 || localConfig.questionsPerAssessment > questions.length)
                  ? "border-red-500/70 focus:border-red-500"
                  : "border-border-dark focus:border-gold"
              }`}
              placeholder={`Pool size is ${questions.length}`}
              value={isNaN(localConfig.questionsPerAssessment ?? NaN) ? "" : localConfig.questionsPerAssessment}
              onChange={e => {
                const val = parseInt(e.target.value);
                setLocalConfig(prev => ({...prev, questionsPerAssessment: isNaN(val) ? undefined : val}));
              }}
            />
            {localConfig.questionsPerAssessment !== undefined && localConfig.questionsPerAssessment > questions.length && (
              <p className="text-red-500 text-[10px] uppercase font-bold mt-2">
                CRITICAL ERROR: Selected number ({localConfig.questionsPerAssessment}) exceeds the total number of active questions in the pool ({questions.length}).
              </p>
            )}
            {localConfig.questionsPerAssessment !== undefined && localConfig.questionsPerAssessment <= 0 && (
              <p className="text-red-500 text-[10px] uppercase font-bold mt-2">
                CRITICAL ERROR: Number of questions must be a positive integer greater than 0.
              </p>
            )}
            <p className="text-[10px] text-gray-500 mt-2 font-mono">
              Valid range: 1 to {questions.length} (total active questions in pool).
            </p>
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
                  value={isNaN(localConfig.excellentThreshold) ? "" : localConfig.excellentThreshold}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setLocalConfig(prev => ({...prev, excellentThreshold: isNaN(val) ? 0 : val}));
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Criteria Met (Pass) %</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white font-mono"
                  value={isNaN(localConfig.passThreshold) ? "" : localConfig.passThreshold}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setLocalConfig(prev => ({...prev, passThreshold: isNaN(val) ? 0 : val}));
                  }}
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
              <h1 className="text-3xl font-serif text-white tracking-[2px] uppercase">Admin Portal</h1>
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
                {editingQuestion.id ? 'Refine Question' : 'Create New Question'}
              </h3>
              <button 
                onClick={() => setEditingQuestion(null)}
                className="text-[#888888] hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] mb-3 block">Inquiry / Statement</label>
                  <textarea 
                    className="w-full p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-sm font-serif italic"
                    value={editingQuestion.text}
                    onChange={e => setEditingQuestion({...editingQuestion, text: e.target.value})}
                    placeholder="Enter the assessment inquiry..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-[#888888] uppercase tracking-[2px] block">Response Options</label>
                  <span className="text-[10px] text-gold font-mono">{editingQuestion.options?.length || 0} Dynamic Choices</span>
                </div>
                
                <div className="space-y-3">
                  {editingQuestion.options?.map((opt, idx) => (
                    <div key={idx} className="flex gap-4 items-center group">
                      <button 
                        type="button"
                        onClick={() => setEditingQuestion({...editingQuestion, correctAnswerIndex: idx})}
                        className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-all ${editingQuestion.correctAnswerIndex === idx ? 'bg-gold border-gold text-black font-bold' : 'border-border-dark text-[#888888] hover:border-gold/50'}`}
                        title="Mark as correct answer"
                      >
                        {editingQuestion.correctAnswerIndex === idx ? <Check className="w-5 h-5" /> : String.fromCharCode(65 + idx)}
                      </button>
                      <input 
                        className="flex-1 p-4 bg-black/40 border border-border-dark rounded focus:border-gold outline-none text-white text-sm"
                        value={opt}
                        onChange={e => {
                          const newOps = [...(editingQuestion.options || [])];
                          newOps[idx] = e.target.value;
                          setEditingQuestion({...editingQuestion, options: newOps});
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      />
                      {editingQuestion.options && editingQuestion.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newOps = (editingQuestion.options || []).filter((_, oIdx) => oIdx !== idx);
                            let newCorrectIndex = editingQuestion.correctAnswerIndex ?? 0;
                            if (newCorrectIndex === idx) {
                              newCorrectIndex = 0;
                            } else if (newCorrectIndex > idx) {
                              newCorrectIndex = newCorrectIndex - 1;
                            }
                            setEditingQuestion({
                              ...editingQuestion,
                              options: newOps,
                              correctAnswerIndex: newCorrectIndex
                            });
                          }}
                          className="p-3 text-[#ff4444] hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors border border-transparent hover:border-red-900/40"
                          title="Remove option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const currentOptions = editingQuestion.options || [];
                    setEditingQuestion({
                      ...editingQuestion,
                      options: [...currentOptions, ""]
                    });
                  }}
                  className="w-full py-3 bg-black/30 hover:bg-black/60 border border-dashed border-border-dark hover:border-gold/50 rounded-lg text-gold text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-4 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Answer Option
                </button>
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
                Save Question
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Excel Upload Preview Modal */}
      {uploadPreview && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface border border-border-dark rounded-xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300"
          >
            <div className="p-8 border-b border-border-dark flex justify-between items-center bg-black/20">
              <div>
                <h3 className="text-sm font-bold text-gold uppercase tracking-[3px]">
                  Confirm Bulk Sheet Upload
                </h3>
                <p className="text-xs text-[#888888] mt-1 font-sans">
                  Parsed {uploadPreview.length} questions from your file. Please preview before overwriting.
                </p>
              </div>
              <button 
                onClick={() => setUploadPreview(null)}
                className="text-[#888888] hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Critical warning message */}
              <div className="bg-red-950/20 border border-red-900/30 rounded p-4 text-xs text-red-400 font-sans tracking-[0.5px]">
                ⚠️ WARNING: Committing this upload will permanently DELETE all {questions.length} existing questions and replace them with the {uploadPreview.length} questions listed below. This action cannot be undone.
              </div>

              <div className="space-y-4">
                {uploadPreview.map((pq, idx) => (
                  <div key={idx} className="bg-black/30 border border-border-dark/60 p-5 rounded-lg flex gap-4 items-start text-left">
                    <span className="w-8 h-8 rounded bg-gold/10 border border-gold/20 text-gold flex items-center justify-center font-serif shrink-0">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <div className="flex-1 space-y-3">
                      <h4 className="font-serif text-base italic text-white leading-relaxed">{pq.text}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {pq.options.map((opt, oIdx) => (
                          <div 
                            key={oIdx} 
                            className={`p-2.5 rounded border ${pq.correctAnswerIndex === oIdx ? 'bg-gold/10 border-gold/40 text-gold font-medium' : 'bg-white/[0.02] border-border-dark/30 text-[#888888]'}`}
                          >
                            <span className="mr-1.5 opacity-60">[{String.fromCharCode(65 + oIdx)}]</span> {opt}
                            {pq.correctAnswerIndex === oIdx && <span className="ml-1.5 text-[9px] uppercase font-bold tracking-wider text-gold opacity-80">(Correct)</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-black/20 border-t border-border-dark flex justify-end gap-4">
              <button 
                onClick={() => setUploadPreview(null)}
                disabled={isImporting}
                className="px-8 py-3 rounded font-bold text-[10px] uppercase tracking-[2px] text-[#888888] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={commitImport}
                disabled={isImporting}
                className="lodha-btn lodha-btn-primary px-10 py-3 flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Committing Upload...
                  </>
                ) : (
                  'Proceed & Overwrite Questions'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </UnifiedBackground>
  );
}
