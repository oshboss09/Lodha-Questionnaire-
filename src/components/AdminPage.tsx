import { useState, useEffect, ChangeEvent, useRef } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { UserDetails, GlobalConfig, Question, Submission, EligibleParticipant } from "../types";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  setDoc,
  serverTimestamp
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
  Upload,
  UserCheck,
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Percent,
  TrendingDown,
  PieChart,
  Sliders
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
  const [activeTab, setActiveTab] = useState<'questions' | 'submissions' | 'eligible_participants' | 'analytics' | 'settings'>('questions');

  // Analytics Dashboard states
  const [passCutoff, setPassCutoff] = useState<number>(60);
  const [analyticsSearch, setAnalyticsSearch] = useState("");
  const [analyticsDeptFilter, setAnalyticsDeptFilter] = useState("ALL");
  const [analyticsStatusFilter, setAnalyticsStatusFilter] = useState("ALL");
  const [analyticsPassFilter, setAnalyticsPassFilter] = useState("ALL");
  const [analyticsPartSort, setAnalyticsPartSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'percentage', dir: 'desc' });
  const [analyticsQSort, setAnalyticsQSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'accuracy', dir: 'asc' });
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

  // Eligible Participants states
  const [eligibleParticipants, setEligibleParticipants] = useState<EligibleParticipant[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [isAddingEligible, setIsAddingEligible] = useState(false);
  const [confirmingEligibleDeleteId, setConfirmingEligibleDeleteId] = useState<string | null>(null);

  const [selectedEligibleIds, setSelectedEligibleIds] = useState<string[]>([]);
  const [bulkEligibleDeleting, setBulkEligibleDeleting] = useState(false);
  const [isConfirmingEligibleBulk, setIsConfirmingEligibleBulk] = useState(false);

  const selectAllEligibleRef = useRef<HTMLInputElement>(null);

  const visibleEligibleIds = eligibleParticipants.map(ep => ep.id).filter(Boolean) as string[];
  const selectedEligibleCount = selectedEligibleIds.filter(id => visibleEligibleIds.includes(id)).length;
  const isAllEligibleSelected = visibleEligibleIds.length > 0 && selectedEligibleCount === visibleEligibleIds.length;
  const isSomeEligibleSelected = selectedEligibleCount > 0 && selectedEligibleCount < visibleEligibleIds.length;

  useEffect(() => {
    if (selectAllEligibleRef.current) {
      selectAllEligibleRef.current.indeterminate = isSomeEligibleSelected;
    }
  }, [isSomeEligibleSelected]);

  useEffect(() => {
    if (selectedEligibleCount === 0) {
      setIsConfirmingEligibleBulk(false);
    }
  }, [selectedEligibleCount]);

  const handleSelectAllEligibleChange = () => {
    if (isAllEligibleSelected) {
      setSelectedEligibleIds([]);
    } else {
      setSelectedEligibleIds(visibleEligibleIds);
    }
  };

  const handleSelectEligibleRow = (id: string) => {
    setSelectedEligibleIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id) 
        : [...prev, id]
    );
  };

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

  useEffect(() => {
    const epQuery = query(collection(db, "eligible_participants"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(epQuery, (snapshot) => {
      setEligibleParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EligibleParticipant)));
    }, (error) => {
      handleFirestoreError(error, 'list', 'eligible_participants');
    });
    return () => unsub();
  }, []);

  const handleAddEligibleParticipants = async () => {
    if (!bulkInput.trim()) return;
    setIsAddingEligible(true);
    setInvalidEmails([]);
    
    const parts = bulkInput.split(/[\n,;\t]+/);
    const validToAdd: string[] = [];
    const invalid: string[] = [];
    
    // Normal email checking regex with @lodhagroup.com domain requirement
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    parts.forEach(part => {
      const email = part.trim().toLowerCase();
      if (!email) return;
      
      if (emailRegex.test(email) && email.endsWith("@lodhagroup.com")) {
        if (!validToAdd.includes(email)) {
          validToAdd.push(email);
        }
      } else {
        if (!invalid.includes(part.trim())) {
          invalid.push(part.trim());
        }
      }
    });

    if (invalid.length > 0) {
      setInvalidEmails(invalid);
    }

    if (validToAdd.length > 0) {
      try {
        const batchPromises = validToAdd.map(async (email) => {
          const docRef = doc(db, "eligible_participants", email);
          try {
            await setDoc(docRef, {
              email,
              createdAt: serverTimestamp()
            });
          } catch (err: any) {
            handleFirestoreError(err, 'create', `eligible_participants/${email}`);
          }
        });
        await Promise.all(batchPromises);
        setBulkInput("");
        alert(`Successfully added ${validToAdd.length} eligible participants.`);
      } catch (error: any) {
        console.error("Error adding eligible participants:", error);
        alert(`Failed to add eligible participants: ${error.message}`);
      }
    }
    setIsAddingEligible(false);
  };

  const deleteEligibleParticipant = async (id: string) => {
    if (!id) return;
    try {
      try {
        await deleteDoc(doc(db, "eligible_participants", id));
      } catch (err: any) {
        handleFirestoreError(err, 'delete', `eligible_participants/${id}`);
      }
      setConfirmingEligibleDeleteId(null);
    } catch (error: any) {
      console.error("Delete eligible participant failed:", error);
      alert(`Error deleting: ${error.message}`);
    }
  };

  const deleteSelectedEligibleParticipants = async () => {
    const idsToDelete = selectedEligibleIds.filter(id => visibleEligibleIds.includes(id));
    if (idsToDelete.length === 0) return;

    setBulkEligibleDeleting(true);
    try {
      const deletePromises = idsToDelete.map(async (id) => {
        try {
          await deleteDoc(doc(db, "eligible_participants", id));
        } catch (err: any) {
          handleFirestoreError(err, 'delete', `eligible_participants/${id}`);
        }
      });
      await Promise.all(deletePromises);
      setSelectedEligibleIds([]);
      setIsConfirmingEligibleBulk(false);
      alert(`Successfully deleted ${idsToDelete.length} eligible participants.`);
    } catch (error: any) {
      console.error("Bulk eligible deletion failed:", error);
      alert(`Error during bulk deletion: ${error.message}`);
    } finally {
      setBulkEligibleDeleting(false);
    }
  };

  const downloadEligibleCSV = () => {
    const headers = ["Email", "Date Added"];
    const rows = eligibleParticipants.map(ep => {
      const date = ep.createdAt?.toDate ? ep.createdAt.toDate() : new Date(ep.createdAt);
      const ts = format(date, "dd-MMM-yyyy HH:mm");
      return [
        ep.email,
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
    link.setAttribute("download", `eligible_participants_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  const downloadAnalyticsExcelReport = () => {
    if (submissions.length === 0) {
      alert("No assessment submissions available to export.");
      return;
    }

    const sortedQuestions = [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const headers = [
      "Participant Name",
      "Email",
      "Department",
      "Status",
      "Question No",
      "Question Text",
      "Shown",
      "Answer Given",
      "Result"
    ];

    const rows: string[][] = [];

    submissions.forEach(s => {
      const pName = s.fullName || "";
      const email = s.email || "";
      const dept = s.department || "";
      const isComp = s.status?.toLowerCase() === "complete";
      const statusText = isComp ? "Complete" : "Incomplete";

      sortedQuestions.forEach((q, idx) => {
        const qNum = `Q${idx + 1}`;
        const qText = q.text ? q.text.replace(/\r?\n/g, " ").trim() : `Question ${idx + 1}`;

        let hasKey = false;
        let selIdx: number | undefined = undefined;

        if (s.responses) {
          if (q.id && q.id in s.responses) {
            hasKey = true;
            selIdx = s.responses[q.id];
          } else if (idx.toString() in s.responses) {
            hasKey = true;
            selIdx = s.responses[idx.toString()];
          } else if (String(idx) in s.responses) {
            hasKey = true;
            selIdx = s.responses[String(idx)];
          }
        }

        let shown = "No";
        let answerGiven = "Not Showed";
        let result = "Not Showed";

        if (!hasKey) {
          shown = "No";
          answerGiven = "Not Showed";
          result = "Not Showed";
        } else if (selIdx === undefined || selIdx === null || isNaN(Number(selIdx)) || Number(selIdx) < 0) {
          shown = "Yes";
          answerGiven = "Not Answered";
          result = "Incorrect";
        } else {
          shown = "Yes";
          const numIdx = Number(selIdx);
          answerGiven = q.options && q.options[numIdx] !== undefined 
            ? q.options[numIdx].replace(/\r?\n/g, " ").trim() 
            : `Option ${numIdx + 1}`;
          const isCorrect = numIdx === q.correctAnswerIndex;
          result = isCorrect ? "Correct" : "Incorrect";
        }

        rows.push([
          pName,
          email,
          dept,
          statusText,
          qNum,
          qText,
          shown,
          answerGiven,
          result
        ]);
      });
    });

    const aoaData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

    const colWidths = headers.map((header, colIdx) => {
      let maxLen = header.length;
      const sampleRows = rows.length > 500 ? rows.slice(0, 500) : rows;
      sampleRows.forEach(row => {
        const cellValue = String(row[colIdx] || "");
        if (cellValue.length > maxLen) {
          maxLen = cellValue.length;
        }
      });
      return { wch: Math.min(Math.max(maxLen + 3, 12), 60) };
    });

    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics Report");

    const dateStr = format(new Date(), "yyyy-MM-dd");
    const fileName = `Analytics_Report_${dateStr}.xlsx`;
    XLSX.writeFile(workbook, fileName);
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
          <button onClick={downloadCSV} className="lodha-btn border border-gold/40 text-gold hover:bg-gold/10 flex items-center gap-2">
            <Download className="w-4 h-4" /> Summary CSV
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

  const renderEligibleParticipantsTab = () => (
    <div className="space-y-6">
      {/* Bulk Paste Area */}
      <div className="bg-surface p-6 rounded border border-border-dark space-y-4">
        <h3 className="text-sm font-bold text-gold uppercase tracking-[2px] flex items-center gap-2">
          <Plus className="w-4 h-4" /> Bulk Add Eligible Participants
        </h3>
        <p className="text-[11px] text-[#888888]">
          Paste email addresses from spreadsheets or docs. Supports space, tab, comma, semicolon or newline separators. All emails will be stored in lowercase. Only emails ending with @lodhagroup.com are permitted
        </p>
        <textarea
          className="w-full bg-black/40 p-4 rounded border border-border-dark focus:border-gold outline-none text-white text-sm font-mono placeholder:text-gray-700"
          placeholder="Enter one or more emails e.g. jaya.thakur3@lodhagroup.com , sharon.moses@lodhagroup.com"
          rows={5}
          value={bulkInput}
          onChange={(e) => setBulkInput(e.target.value)}
        />
        
        {invalidEmails.length > 0 && (
          <div className="bg-red-950/20 border border-red-900/30 rounded p-4 text-xs text-red-500 space-y-2">
            <span className="font-bold uppercase tracking-[0.5px] flex items-center gap-2">
              <X className="w-4 h-4" /> Invalid entries (ignored):
            </span>
            <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
              {invalidEmails.map((email, idx) => (
                <li key={idx}>
                  {email} <span className="opacity-70 text-[9px] uppercase font-bold text-red-400">— Must be valid format and end with @lodhagroup.com</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <button 
            onClick={handleAddEligibleParticipants}
            disabled={isAddingEligible || !bulkInput.trim()}
            className="lodha-btn lodha-btn-primary flex items-center gap-2"
          >
            {isAddingEligible ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Participants
          </button>
        </div>
      </div>

      {/* Toolbar & List Table */}
      <div className="space-y-6">
        <div className="bg-surface p-6 rounded border border-border-dark flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-sm font-bold text-gold uppercase tracking-[2px] flex items-center gap-2">
            <UserCheck className="w-4 h-4" /> {eligibleParticipants.length} Eligible Participants
          </h2>
          <div className="flex flex-wrap gap-3">
            {isConfirmingEligibleBulk ? (
              <div className="flex items-center gap-2 bg-black/40 p-1 rounded border border-red-900/30">
                <button 
                  onClick={deleteSelectedEligibleParticipants} 
                  disabled={bulkEligibleDeleting}
                  className="bg-red-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase hover:bg-red-700 transition-all flex items-center gap-1.5"
                >
                  {bulkEligibleDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirm ({selectedEligibleCount})
                </button>
                <button 
                  onClick={() => setIsConfirmingEligibleBulk(false)}
                  disabled={bulkEligibleDeleting}
                  className="bg-gray-700 text-white px-4 py-2 rounded text-[10px] font-bold uppercase hover:bg-gray-600 transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsConfirmingEligibleBulk(true)} 
                disabled={selectedEligibleCount === 0}
                className={`lodha-btn flex items-center gap-2 transition-all text-[10px] uppercase font-bold ${
                  selectedEligibleCount === 0 
                    ? "bg-red-950/20 text-red-500/40 border border-red-950/30 cursor-not-allowed opacity-50" 
                    : "bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/30"
                }`}
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedEligibleCount})
              </button>
            )}
            <button onClick={downloadEligibleCSV} className="lodha-btn lodha-btn-primary flex items-center gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        <div className="bg-surface rounded border border-border-dark overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-border-dark/60 bg-black/20">
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    ref={selectAllEligibleRef}
                    checked={isAllEligibleSelected}
                    onChange={handleSelectAllEligibleChange}
                    className="w-4 h-4 accent-gold bg-black/40 border-border-dark rounded cursor-pointer"
                  />
                </th>
                <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Email address</th>
                <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px]">Date Added</th>
                <th className="p-4 text-[11px] font-bold text-gold uppercase tracking-[1px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark/50">
              {eligibleParticipants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[#888888] text-xs uppercase tracking-[1.5px] font-medium font-mono">
                    No eligible participants configured yet. Add them in bulk above.
                  </td>
                </tr>
              ) : (
                eligibleParticipants.map((ep) => {
                  return (
                    <tr key={ep.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4 w-12 text-center">
                        <input 
                          type="checkbox"
                          checked={selectedEligibleIds.includes(ep.id!)}
                          onChange={() => handleSelectEligibleRow(ep.id!)}
                          className="w-4 h-4 accent-gold bg-black/40 border-border-dark rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-4">
                        <div className="text-white font-mono text-sm">{ep.email}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-[#888888] text-xs font-mono">
                          {ep.createdAt?.toDate ? format(ep.createdAt.toDate(), "dd-MMM-yyyy HH:mm") : ep.createdAt ? format(new Date(ep.createdAt), "dd-MMM-yyyy HH:mm") : "N/A"}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {confirmingEligibleDeleteId === ep.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteEligibleParticipant(ep.id!); }}
                              className="bg-red-600 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setConfirmingEligibleDeleteId(null); }}
                              className="bg-gray-700 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (ep.id) setConfirmingEligibleDeleteId(ep.id);
                            }} 
                            className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-md font-bold text-[10px] tracking-wider uppercase transition-all border border-red-600/30"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAnalyticsTab = () => {
    const totalSubmissionsCount = submissions.length;
    const completedSubmissionsCount = submissions.filter(s => s.status?.toLowerCase() === "complete").length;
    const incompleteSubmissionsCount = totalSubmissionsCount - completedSubmissionsCount;

    // Average score and percentage
    let totalScoreSum = 0;
    let totalMaxScoreSum = 0;
    let totalPctSum = 0;

    submissions.forEach(s => {
      const totalQ = s.totalQuestions || questions.length || 1;
      const scoreNum = typeof s.score === "number" ? s.score : 0;
      const pct = (scoreNum / totalQ) * 100;
      totalScoreSum += scoreNum;
      totalMaxScoreSum += totalQ;
      totalPctSum += pct;
    });

    const avgScoreNum = totalSubmissionsCount ? (totalScoreSum / totalSubmissionsCount) : 0;
    const avgMaxQNum = totalSubmissionsCount ? (totalMaxScoreSum / totalSubmissionsCount) : (questions.length || 1);
    const avgPct = totalSubmissionsCount ? (totalPctSum / totalSubmissionsCount) : 0;

    // Pass / Fail counts based on passCutoff
    let passCount = 0;
    let failCount = 0;

    submissions.forEach(s => {
      const totalQ = s.totalQuestions || questions.length || 1;
      const scoreNum = typeof s.score === "number" ? s.score : 0;
      const pct = (scoreNum / totalQ) * 100;
      if (pct >= passCutoff) {
        passCount++;
      } else {
        failCount++;
      }
    });

    // Score distribution across bands: 0–20%, 21–40%, 41–60%, 61–80%, 81–100%
    const bands = [
      { label: "0–20%", count: 0 },
      { label: "21–40%", count: 0 },
      { label: "41–60%", count: 0 },
      { label: "61–80%", count: 0 },
      { label: "81–100%", count: 0 },
    ];

    submissions.forEach(s => {
      const totalQ = s.totalQuestions || questions.length || 1;
      const scoreNum = typeof s.score === "number" ? s.score : 0;
      const pct = (scoreNum / totalQ) * 100;

      if (pct <= 20) bands[0].count++;
      else if (pct <= 40) bands[1].count++;
      else if (pct <= 60) bands[2].count++;
      else if (pct <= 80) bands[3].count++;
      else bands[4].count++;
    });

    // Duplicate email check for data quality flag
    const emailCounts: Record<string, number> = {};
    submissions.forEach(s => {
      const em = (s.email || "").trim().toLowerCase();
      if (em) {
        emailCounts[em] = (emailCounts[em] || 0) + 1;
      }
    });
    const duplicateEmails = Object.entries(emailCounts)
      .filter(([_, count]) => count > 1)
      .map(([email, count]) => ({ email, count }));

    // Questions sorted by order
    const sortedQuestions = [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Question stats
    const questionStatsList = sortedQuestions.map((q, idx) => {
      const qNum = idx + 1;
      const qText = q.text ? q.text.replace(/\r?\n/g, " ").trim() : `Question ${qNum}`;
      
      let timesShown = 0;
      let correct = 0;
      let incorrect = 0;
      let notAnswered = 0;

      submissions.forEach(s => {
        let hasKey = false;
        let selIdx: number | undefined = undefined;

        if (s.responses) {
          if (q.id && q.id in s.responses) {
            hasKey = true;
            selIdx = s.responses[q.id];
          } else if (idx.toString() in s.responses) {
            hasKey = true;
            selIdx = s.responses[idx.toString()];
          } else if (String(idx) in s.responses) {
            hasKey = true;
            selIdx = s.responses[String(idx)];
          }
        }

        if (hasKey) {
          timesShown++;
          if (selIdx === undefined || selIdx === null || isNaN(Number(selIdx)) || Number(selIdx) < 0) {
            notAnswered++;
          } else {
            const numIdx = Number(selIdx);
            if (numIdx === q.correctAnswerIndex) {
              correct++;
            } else {
              incorrect++;
            }
          }
        }
      });

      const accuracy = timesShown > 0 ? (correct / timesShown) * 100 : 0;

      return {
        q,
        qIndex: idx,
        qNum: `Q${qNum}`,
        qText,
        timesShown,
        correct,
        incorrect,
        notAnswered,
        accuracy
      };
    });

    // Bottom 5 questions by accuracy
    const bottom5Questions = [...questionStatsList]
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    // Filterable departments list
    const departmentsList = Array.from(
      new Set(submissions.map(s => s.department).filter(Boolean))
    ).sort() as string[];

    // Participant Summary rows
    const participantRows = submissions.map(s => {
      const totalQ = s.totalQuestions || questions.length || 1;
      const scoreNum = typeof s.score === "number" ? s.score : 0;
      const pct = Math.round((scoreNum / totalQ) * 100);
      const isPass = pct >= passCutoff;
      const statusText = s.status?.toLowerCase() === "complete" ? "Complete" : "Incomplete";

      const date = s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
      const formattedDate = isNaN(date.getTime()) ? "" : format(date, "dd-MMM-yyyy HH:mm");

      return {
        id: s.id,
        fullName: s.fullName || "Unnamed",
        email: s.email || "-",
        department: s.department || "N/A",
        scoreStr: `${scoreNum} / ${totalQ}`,
        scoreNum,
        totalQ,
        pct,
        passFail: isPass ? "Pass" : "Fail",
        status: statusText,
        submissionDate: formattedDate,
        rawDate: isNaN(date.getTime()) ? 0 : date.getTime()
      };
    });

    // Filtered participants
    const filteredParticipants = participantRows.filter(p => {
      if (analyticsSearch.trim()) {
        const q = analyticsSearch.toLowerCase();
        const matchName = p.fullName.toLowerCase().includes(q);
        const matchEmail = p.email.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      if (analyticsStatusFilter !== "ALL" && p.status !== analyticsStatusFilter) {
        return false;
      }
      if (analyticsPassFilter !== "ALL" && p.passFail !== analyticsPassFilter) {
        return false;
      }
      return true;
    });

    // Sorted participants
    const sortedParticipants = [...filteredParticipants].sort((a, b) => {
      const dir = analyticsPartSort.dir === 'asc' ? 1 : -1;
      switch (analyticsPartSort.field) {
        case 'fullName': return a.fullName.localeCompare(b.fullName) * dir;
        case 'email': return a.email.localeCompare(b.email) * dir;
        case 'score': return (a.scoreNum - b.scoreNum) * dir;
        case 'percentage': return (a.pct - b.pct) * dir;
        case 'passFail': return a.passFail.localeCompare(b.passFail) * dir;
        case 'status': return a.status.localeCompare(b.status) * dir;
        case 'submissionDate': return (a.rawDate - b.rawDate) * dir;
        default: return 0;
      }
    });

    // Sorted Question Analysis
    const sortedQuestionAnalysis = [...questionStatsList].sort((a, b) => {
      const dir = analyticsQSort.dir === 'asc' ? 1 : -1;
      switch (analyticsQSort.field) {
        case 'qNum': return (a.qIndex - b.qIndex) * dir;
        case 'qText': return a.qText.localeCompare(b.qText) * dir;
        case 'timesShown': return (a.timesShown - b.timesShown) * dir;
        case 'correct': return (a.correct - b.correct) * dir;
        case 'incorrect': return (a.incorrect - b.incorrect) * dir;
        case 'notAnswered': return (a.notAnswered - b.notAnswered) * dir;
        case 'accuracy': return (a.accuracy - b.accuracy) * dir;
        default: return 0;
      }
    });

    const togglePartSort = (field: string) => {
      if (analyticsPartSort.field === field) {
        setAnalyticsPartSort({ field, dir: analyticsPartSort.dir === 'asc' ? 'desc' : 'asc' });
      } else {
        setAnalyticsPartSort({ field, dir: 'asc' });
      }
    };

    const toggleQSort = (field: string) => {
      if (analyticsQSort.field === field) {
        setAnalyticsQSort({ field, dir: analyticsQSort.dir === 'asc' ? 'desc' : 'asc' });
      } else {
        setAnalyticsQSort({ field, dir: 'asc' });
      }
    };

    return (
      <div className="space-y-10">
        {/* Header Bar */}
        <div className="bg-surface p-6 rounded border border-border-dark flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold text-gold uppercase tracking-[2px] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gold" />
              Analytics Dashboard
            </h2>
            <p className="text-xs text-[#888888] mt-1">
              Live performance metrics derived automatically from assessment submissions
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-black/40 border border-border-dark px-3 py-1.5 rounded">
              <label className="text-[11px] font-bold text-[#888888] uppercase tracking-wider">Pass Cutoff (%):</label>
              <input 
                type="number"
                min="0"
                max="100"
                value={passCutoff}
                onChange={e => setPassCutoff(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="w-14 bg-black/60 border border-gold/40 rounded px-2 py-1 text-xs text-gold font-bold text-center outline-none focus:border-gold"
              />
            </div>
            <button 
              onClick={downloadAnalyticsExcelReport}
              className="lodha-btn lodha-btn-primary flex items-center gap-2 text-xs uppercase font-bold tracking-wider"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download Excel Report
            </button>
          </div>
        </div>

        {/* SECTION 1: Summary Cards & Charts */}
        <div className="space-y-6">
          <h3 className="text-xs font-bold text-gold uppercase tracking-[1.5px] border-b border-border-dark pb-2">
            Section 1 — Key Performance Metrics
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Participants */}
            <div className="bg-surface/60 p-5 rounded border border-border-dark/80 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Total Participants</span>
                <Users className="w-4 h-4 text-gold/70" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold font-mono text-white">{totalSubmissionsCount}</span>
                <p className="text-[10px] text-[#888888] mt-1">Submissions recorded</p>
              </div>
            </div>

            {/* Complete vs Incomplete */}
            <div className="bg-surface/60 p-5 rounded border border-border-dark/80 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Completion Status</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-emerald-400">{completedSubmissionsCount}</span>
                  <span className="text-xs text-[#888888]">/ {totalSubmissionsCount} Complete</span>
                </div>
                <p className="text-[10px] text-amber-400/80 mt-1">{incompleteSubmissionsCount} Incomplete assessments</p>
              </div>
            </div>

            {/* Average Score */}
            <div className="bg-surface/60 p-5 rounded border border-border-dark/80 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Average Score</span>
                <PieChart className="w-4 h-4 text-gold" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold font-mono text-gold">
                  {avgScoreNum.toFixed(1)} <span className="text-sm font-sans text-[#888888]">/ {Math.round(avgMaxQNum)}</span>
                </span>
                <p className="text-[10px] text-gold/80 mt-1">Avg Accuracy: {avgPct.toFixed(1)}%</p>
              </div>
            </div>

            {/* Pass vs Fail */}
            <div className="bg-surface/60 p-5 rounded border border-border-dark/80 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Pass / Fail (Cutoff: {passCutoff}%)</span>
                <TrendingDown className="w-4 h-4 text-gold/70" />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-mono text-emerald-400">{passCount}</span>
                  <span className="text-[10px] text-emerald-400/80 block">Passed</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold font-mono text-red-400">{failCount}</span>
                  <span className="text-[10px] text-red-400/80 block">Failed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Score Distribution Chart - Full Width */}
          <div className="bg-surface/50 p-6 rounded border border-border-dark space-y-4">
            <h4 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gold" /> Score Distribution Across Bands
            </h4>
            <div className="space-y-3 pt-2">
              {bands.map((b, idx) => {
                const bandPct = totalSubmissionsCount ? Math.round((b.count / totalSubmissionsCount) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-[#888888]">
                      <span className="text-white font-medium">{b.label}</span>
                      <span>{b.count} participants ({bandPct}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-border-dark/60">
                      <div 
                        className="h-full bg-gradient-to-r from-gold/60 to-gold transition-all duration-500 rounded-full"
                        style={{ width: `${Math.max(bandPct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom 5 Questions Table */}
          <div className="bg-surface/50 p-6 rounded border border-border-dark space-y-4">
            <h4 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" /> Bottom 5 Questions by Accuracy (Biggest Knowledge Gaps)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-dark text-[#888888] uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Q#</th>
                    <th className="py-2.5 px-3">Question Text</th>
                    <th className="py-2.5 px-3 text-center">Times Shown</th>
                    <th className="py-2.5 px-3 text-right">Accuracy %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark/40">
                  {bottom5Questions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-[#888888]">No question data available.</td>
                    </tr>
                  ) : (
                    bottom5Questions.map((qStat, qIdx) => (
                      <tr key={qIdx} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-mono text-gold font-bold align-top">{qStat.qNum}</td>
                        <td className="py-2.5 px-3 text-white whitespace-normal font-serif italic leading-relaxed">{qStat.qText}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-[#888888] align-top">{qStat.timesShown}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold align-top">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${
                            qStat.accuracy >= 75 
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' 
                              : qStat.accuracy >= 50 
                              ? 'bg-gold/10 text-gold border border-gold/30' 
                              : 'bg-red-950/40 text-red-400 border border-red-800/40'
                          }`}>
                            {qStat.accuracy.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SECTION 2: Question Analysis */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border-dark pb-2">
            <div>
              <h3 className="text-xs font-bold text-gold uppercase tracking-[1.5px]">
                Section 2 — Comprehensive Question Analysis
              </h3>
              <p className="text-[11px] text-[#888888] mt-0.5">
                Accuracy % is computed strictly among participants who were actually presented that question.
              </p>
            </div>
            <span className="text-[11px] text-[#888888] font-mono">
              {questions.length} total test questions
            </span>
          </div>

          <div className="bg-surface rounded border border-border-dark overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-black/40 border-b border-border-dark text-[#888888] uppercase text-[10px] tracking-wider">
                  <th onClick={() => toggleQSort('qNum')} className="py-3 px-3 cursor-pointer hover:text-gold transition-colors select-none">
                    Q# <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                  </th>
                  <th onClick={() => toggleQSort('qText')} className="py-3 px-3 cursor-pointer hover:text-gold transition-colors select-none">
                    Question Inquiry <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                  </th>
                  <th onClick={() => toggleQSort('timesShown')} className="py-3 px-3 text-center cursor-pointer hover:text-gold transition-colors select-none">
                    Shown <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                  </th>
                  <th onClick={() => toggleQSort('correct')} className="py-3 px-3 text-center cursor-pointer hover:text-gold transition-colors select-none">
                    Correct <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                  </th>
                  <th onClick={() => toggleQSort('incorrect')} className="py-3 px-3 text-center cursor-pointer hover:text-gold transition-colors select-none">
                    Incorrect <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                  </th>
                  <th onClick={() => toggleQSort('notAnswered')} className="py-3 px-3 text-center cursor-pointer hover:text-gold transition-colors select-none">
                    Skipped <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                  </th>
                  <th onClick={() => toggleQSort('accuracy')} className="py-3 px-3 text-right cursor-pointer hover:text-gold transition-colors select-none">
                    Accuracy % <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark/40">
                {sortedQuestionAnalysis.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#888888]">
                      No questions configured in the system.
                    </td>
                  </tr>
                ) : (
                  sortedQuestionAnalysis.map((qs, qIdx) => (
                    <tr key={qIdx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 font-mono text-gold font-bold align-top">{qs.qNum}</td>
                      <td className="py-3 px-3 text-white whitespace-normal font-serif italic leading-relaxed">{qs.qText}</td>
                      <td className="py-3 px-3 text-center font-mono text-white font-bold align-top">{qs.timesShown}</td>
                      <td className="py-3 px-3 text-center font-mono text-emerald-400 font-bold align-top">{qs.correct}</td>
                      <td className="py-3 px-3 text-center font-mono text-red-400 align-top">{qs.incorrect}</td>
                      <td className="py-3 px-3 text-center font-mono text-amber-400 align-top">{qs.notAnswered}</td>
                      <td className="py-3 px-3 text-right align-top">
                        <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-mono font-bold border ${
                          qs.accuracy >= 75 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50' 
                            : qs.accuracy >= 50 
                            ? 'bg-gold/10 text-gold border-gold/30' 
                            : 'bg-red-950/40 text-red-400 border-red-800/50'
                        }`}>
                          {qs.accuracy.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: Participant Summary */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border-dark pb-2">
            <h3 className="text-xs font-bold text-gold uppercase tracking-[1.5px]">
              Section 3 — Participant Performance Summary
            </h3>
            <span className="text-[11px] text-[#888888] font-mono">
              Showing {sortedParticipants.length} of {submissions.length} records
            </span>
          </div>

          {/* Filters Bar */}
          <div className="bg-surface/60 p-4 rounded border border-border-dark grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#888888] absolute left-3 top-3" />
              <input 
                type="text"
                value={analyticsSearch}
                onChange={e => setAnalyticsSearch(e.target.value)}
                placeholder="Search name or email..."
                className="w-full bg-black/40 border border-border-dark rounded pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-600 outline-none focus:border-gold"
              />
            </div>

            {/* Status Filter */}
            <select
              value={analyticsStatusFilter}
              onChange={e => setAnalyticsStatusFilter(e.target.value)}
              className="bg-black/40 border border-border-dark rounded px-3 py-2 text-xs text-white outline-none focus:border-gold"
            >
              <option value="ALL">All Statuses</option>
              <option value="Complete">Complete</option>
              <option value="Incomplete">Incomplete</option>
            </select>

            {/* Pass/Fail Filter */}
            <select
              value={analyticsPassFilter}
              onChange={e => setAnalyticsPassFilter(e.target.value)}
              className="bg-black/40 border border-border-dark rounded px-3 py-2 text-xs text-white outline-none focus:border-gold"
            >
              <option value="ALL">All Results (Pass & Fail)</option>
              <option value="Pass">Pass Only</option>
              <option value="Fail">Fail Only</option>
            </select>
          </div>

          {/* Participant Table */}
          <div className="bg-surface rounded border border-border-dark overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-black/40 border-b border-border-dark text-[#888888] uppercase text-[10px] tracking-wider">
                  <th onClick={() => togglePartSort('fullName')} className="py-3 px-4 cursor-pointer hover:text-gold transition-colors select-none">
                    Participant <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-60" />
                  </th>
                  <th onClick={() => togglePartSort('score')} className="py-3 px-4 text-center cursor-pointer hover:text-gold transition-colors select-none">
                    Score <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-60" />
                  </th>
                  <th onClick={() => togglePartSort('percentage')} className="py-3 px-4 text-center cursor-pointer hover:text-gold transition-colors select-none">
                    Percentage <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-60" />
                  </th>
                  <th onClick={() => togglePartSort('passFail')} className="py-3 px-4 text-center cursor-pointer hover:text-gold transition-colors select-none">
                    Result <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-60" />
                  </th>
                  <th onClick={() => togglePartSort('status')} className="py-3 px-4 text-center cursor-pointer hover:text-gold transition-colors select-none">
                    Status <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-60" />
                  </th>
                  <th onClick={() => togglePartSort('submissionDate')} className="py-3 px-4 text-right cursor-pointer hover:text-gold transition-colors select-none">
                    Date <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-60" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark/40">
                {sortedParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#888888]">
                      No participant submissions match the current filters.
                    </td>
                  </tr>
                ) : (
                  sortedParticipants.map((p, pIdx) => (
                    <tr key={pIdx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{p.fullName}</div>
                        <div className="text-[10px] text-[#888888] font-mono">{p.email}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-white font-bold">{p.scoreStr}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold font-mono border ${
                          p.pct >= 80 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50' 
                            : p.pct >= 60 
                            ? 'bg-gold/10 text-gold border-gold/30' 
                            : 'bg-red-950/40 text-red-400 border-red-800/50'
                        }`}>
                          {p.pct}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          p.passFail === 'Pass' 
                            ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40' 
                            : 'bg-red-600/20 text-red-400 border-red-500/40'
                        }`}>
                          {p.passFail}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          p.status === 'Complete' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#888888] text-[11px]">
                        {p.submissionDate}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <UnifiedBackground>
      <div className="flex-1 p-4 md:p-8 overflow-y-auto min-h-screen">
        <div className="max-w-5xl mx-auto space-y-12">
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-surface/40 backdrop-blur-md p-6 rounded border border-border-dark">
            <div>
              <h1 className="text-3xl font-serif text-white tracking-[2px] uppercase">Admin Portal</h1>
              <button 
                onClick={onLogout}
                className="text-[10px] text-red-900 uppercase tracking-[1px] font-bold flex items-center gap-2 mt-2 hover:opacity-80"
              >
                <LogOut className="w-3 h-3" /> Logout
              </button>
            </div>
            <div className="flex bg-surface rounded p-1 border border-border-dark flex-wrap gap-1 leading-none">
              {([
                { id: 'questions', name: 'questions' },
                { id: 'submissions', name: 'submissions' },
                { id: 'eligible_participants', name: 'Eligible Participants' },
                { id: 'analytics', name: 'Analytics Dashboard' },
                { id: 'settings', name: 'settings' }
              ] as const).map(tab => (
                 <button 
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={`px-4 py-2.5 rounded font-bold text-[10px] uppercase tracking-[1px] transition-all ${activeTab === tab.id ? 'bg-gold text-black shadow' : 'text-[#888888] hover:bg-white/5'}`}
                 >
                   {tab.name}
                 </button>
              ))}
            </div>
          </header>
 
          <main className="animate-in fade-in duration-500">
            {activeTab === 'questions' && renderQuestionsTab()}
            {activeTab === 'submissions' && renderSubmissionsTab()}
            {activeTab === 'eligible_participants' && renderEligibleParticipantsTab()}
            {activeTab === 'analytics' && renderAnalyticsTab()}
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
