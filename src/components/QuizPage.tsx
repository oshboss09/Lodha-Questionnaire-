import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserDetails, GlobalConfig, Question } from "../types";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError } from "../lib/firebase";
import { Clock, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import UnifiedBackground from "./UnifiedBackground";

interface Props {
  user: UserDetails;
  config: GlobalConfig;
}

export default function QuizPage({ user, config }: Props) {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(config.timerPerQuestion);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasSubmitted = useRef(false);

  // Maintain a block ref to share freshest state with event listeners (avoiding closures)
  const stateRef = useRef({
    questions,
    currentIndex,
    selectedOption,
    responses,
    user,
    config,
  });

  useEffect(() => {
    stateRef.current = {
      questions,
      currentIndex,
      selectedOption,
      responses,
      user,
      config,
    };
  }, [questions, currentIndex, selectedOption, responses, user, config]);

  const [showSuspiciousModal, setShowSuspiciousModal] = useState(false);
  const isFocusLost = useRef(false);

  const handleDismissSuspiciousModal = () => {
    setShowSuspiciousModal(false);
    navigate("/", { state: { prefill: user, disabled: true } });
  };

  // Handle focus loss handling & partial submission (Requirement 3 - Revised)
  const performFocusLossSnapshot = useCallback(async () => {
    if (isFocusLost.current || hasSubmitted.current) return;
    isFocusLost.current = true;
    setShowSuspiciousModal(true);

    const { 
      questions: currentQuestions, 
      currentIndex: index, 
      selectedOption: currentSel, 
      responses: currentResponses, 
      user: currentUser, 
      config: currentConfig 
    } = stateRef.current;

    if (currentQuestions.length === 0) return;

    try {
      const finalResponses = { ...currentResponses };
      const currentQuestion = currentQuestions[index];
      if (currentQuestion && currentSel !== null) {
        finalResponses[currentQuestion.id!] = currentSel;
      }

      let score = 0;
      currentQuestions.forEach(q => {
        if (finalResponses[q.id!] === q.correctAnswerIndex) {
          score++;
        }
      });

      const submission = {
        ...currentUser,
        score,
        totalQuestions: currentQuestions.length,
        responses: finalResponses,
        timestamp: serverTimestamp(),
        auto_submitted: true,
        status: "Incomplete",
      };

      await addDoc(collection(db, "submissions"), submission);

      if (currentConfig.googleSheetsWebhookUrl) {
        await fetch("/api/submit-to-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            webhookUrl: currentConfig.googleSheetsWebhookUrl,
            data: {
              ...currentUser,
              score,
              totalQuestions: currentQuestions.length,
              timestamp: new Date().toISOString(),
              auto_submitted: true,
              status: "Incomplete",
            }
          })
        });
      }
    } catch (e) {
      console.error("Focus loss snapshot recording failed:", e);
    }
  }, [navigate, user]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        performFocusLossSnapshot();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [performFocusLossSnapshot]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    async function fetchQuestions() {
      const q = query(
        collection(db, "questions"), 
        orderBy("order")
      );
      try {
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        
        // Shuffle questions randomly
        const shuffled = [...data];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // Select exactly N questions (Requirement 5)
        const n = config.questionsPerAssessment && config.questionsPerAssessment > 0
          ? Math.min(config.questionsPerAssessment, shuffled.length)
          : shuffled.length;

        setQuestions(shuffled.slice(0, n));
      } catch (error) {
        handleFirestoreError(error, 'list', 'questions');
      } finally {
        setIsLoading(false);
      }
    }
    fetchQuestions();
  }, [config.timerPerQuestion, config.questionsPerAssessment]);

  const handleNext = useCallback(async () => {
    const currentQuestion = questions[currentIndex];
    const newResponses = { ...responses, [currentQuestion.id!]: selectedOption ?? -1 };
    setResponses(newResponses);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setTimeLeft(config.timerPerQuestion);
    } else {
      await submitResults(newResponses);
    }
  }, [currentIndex, questions, selectedOption, responses, config.timerPerQuestion]);

  useEffect(() => {
    if (isLoading || isSubmitting || questions.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleNext();
          return config.timerPerQuestion;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, isLoading, isSubmitting, handleNext, config.timerPerQuestion, questions.length]);

  const submitResults = async (finalResponses: Record<string, number>) => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setIsSubmitting(true);

    let score = 0;
    questions.forEach(q => {
      if (finalResponses[q.id!] === q.correctAnswerIndex) {
        score++;
      }
    });

    if (isFocusLost.current) {
      // SILENTLY IGNORE writing to the database!
      // Navigate normally, pretending everything is fine
      setIsSubmitting(false);
      navigate("/results", { state: { score, total: questions.length } });
      return;
    }

    const submission = {
      ...user,
      score,
      totalQuestions: questions.length,
      responses: finalResponses,
      timestamp: serverTimestamp(),
      auto_submitted: false,
      status: "Complete",
    };

    try {
      await addDoc(collection(db, "submissions"), submission);
      
      // Trigger Google Sheets Webhook via Backend API
      if (config.googleSheetsWebhookUrl) {
        await fetch("/api/submit-to-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookUrl: config.googleSheetsWebhookUrl,
            data: {
              ...user,
              score,
              totalQuestions: questions.length,
              timestamp: new Date().toISOString(),
              auto_submitted: false,
              status: "Complete",
            }
          })
        });
      }

      navigate("/results", { state: { score, total: questions.length } });
    } catch (e) {
      console.error("Submission failed", e);
      handleFirestoreError(e, 'create', 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="text-xl font-medium">Preparing your assessment...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Questions Found</h2>
          <p className="text-gray-600">Please ask the admin to add questions.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <UnifiedBackground>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-[64px] bg-surface/80 backdrop-blur-md border-b border-border-dark flex items-center justify-between px-8 shrink-0">
          <div className="font-serif text-xl tracking-[2px] text-gold uppercase">Lodha</div>
          <div className="flex items-center gap-2.5 bg-gold/10 border border-gold/40 px-3 py-1.5 rounded">
            <span className="text-[11px] uppercase tracking-[1px] text-gold font-medium">Time Remaining</span>
            <span className="font-mono text-lg font-bold text-gold">
              {Math.floor(Math.max(0, timeLeft) / 60).toString().padStart(2, '0')}:
              {(Math.max(0, timeLeft) % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </header>

        {/* Main Container */}
        <main className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-[260px] bg-surface/40 backdrop-blur-sm border-r border-border-dark p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] text-[#888888] uppercase tracking-[1px]">Participant</div>
              <div className="font-serif text-base italic text-white">{user.fullName}</div>
              <div className="text-[11px] text-[#888888] uppercase tracking-[1px] opacity-70">{user.department}</div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="text-[11px] text-[#888888] uppercase tracking-[1px]">Question Navigator</div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: questions.length }).map((_, idx) => (
                  <div 
                    key={idx}
                    className={`nav-dot ${idx === currentIndex ? 'active' : ''} ${idx < currentIndex ? 'completed' : ''}`}
                  >
                    {(idx + 1).toString().padStart(2, '0')}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Content Area */}
          <section className="flex-1 p-8 md:p-12 overflow-y-auto relative flex items-center">
            <div className="max-w-3xl w-full mx-auto my-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="font-serif text-2xl md:text-3xl text-white mb-6 leading-[1.35] text-shadow">
                    {currentQuestion.text}
                  </h2>

                  <div className="flex flex-col gap-3">
                    {(currentQuestion.options || []).filter(o => o && o.trim() !== "").map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedOption(idx)}
                        className={`
                          w-full text-left p-3.5 px-5 rounded-lg border flex items-center gap-3.5 transition-all duration-200
                          ${selectedOption === idx 
                            ? 'border-gold bg-gold/10 backdrop-blur-md' 
                            : 'border-border-dark bg-surface/20 hover:border-gold/50 hover:bg-white/[0.05]'}
                        `}
                      >
                        <div className={`
                          w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0
                          ${selectedOption === idx ? 'border-gold bg-gold' : 'border-border-dark'}
                        `}>
                          {selectedOption === idx && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                        </div>
                        <span className="text-[15px] text-[#e0e0e0] font-normal leading-relaxed">{option}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="h-[80px] bg-surface/80 backdrop-blur-md border-t border-border-dark flex items-center justify-between px-8 shrink-0">
          <div className="flex flex-col gap-1.5 w-[360px]">
            <div className="text-[11px] text-[#888888] uppercase tracking-[1px]">
              Progress: {currentIndex + 1} of {questions.length} answered
            </div>
            <div className="h-[2px] bg-border-dark w-full rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gold"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              disabled={selectedOption === null || isSubmitting}
              onClick={handleNext}
              className={`lodha-btn ${selectedOption === null || isSubmitting ? 'opacity-30 cursor-not-allowed lodha-btn-secondary' : 'lodha-btn-primary'}`}
            >
              {isSubmitting ? "Processing..." : (currentIndex === questions.length - 1 ? "Finish Assessment" : "Next Question")}
            </button>
          </div>
        </footer>
      </div>

      <AnimatePresence>
        {showSuspiciousModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full bg-surface p-10 rounded border border-border-dark shadow-2xl text-center flex flex-col items-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full mb-6 text-red-500 animate-pulse">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl text-white mb-4">Suspicious Activity</h3>
              <p className="text-[#888888] text-sm leading-relaxed mb-8">
                Suspicious activity detected. Please contact your administrator to continue.
              </p>
              <button 
                onClick={handleDismissSuspiciousModal}
                className="w-full lodha-btn lodha-btn-primary py-3 font-semibold text-xs tracking-wider uppercase"
              >
                OK
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </UnifiedBackground>
  );
}
