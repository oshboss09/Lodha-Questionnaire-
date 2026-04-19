import { useState, useEffect, useCallback } from "react";
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
        setQuestions(data);
      } catch (error) {
        handleFirestoreError(error, 'list', 'questions');
      } finally {
        setIsLoading(false);
      }
    }
    fetchQuestions();
  }, [config.timerPerQuestion]);

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
    setIsSubmitting(true);
    let score = 0;
    questions.forEach(q => {
      if (finalResponses[q.id!] === q.correctAnswerIndex) {
        score++;
      }
    });

    const submission = {
      ...user,
      score,
      totalQuestions: questions.length,
      responses: finalResponses,
      timestamp: serverTimestamp(),
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
              timestamp: new Date().toISOString()
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
        <header className="h-[80px] bg-surface/80 backdrop-blur-md border-b border-border-dark flex items-center justify-between px-10 shrink-0">
          <div className="font-serif text-2xl tracking-[2px] text-gold uppercase">Lodha</div>
          <div className="flex items-center gap-3 bg-gold/10 border border-gold/40 px-4 py-2 rounded">
            <span className="text-[12px] uppercase tracking-[1px] text-gold font-medium">Time Remaining</span>
            <span className="font-mono text-xl font-bold text-gold">
              {Math.floor(Math.max(0, timeLeft) / 60).toString().padStart(2, '0')}:
              {(Math.max(0, timeLeft) % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </header>

        {/* Main Container */}
        <main className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-[280px] bg-surface/40 backdrop-blur-sm border-r border-border-dark p-8 flex flex-col gap-10 shrink-0 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <div className="text-[12px] text-[#888888] uppercase tracking-[1px]">Participant</div>
              <div className="font-serif text-lg italic text-white">{user.fullName}</div>
              <div className="text-[12px] text-[#888888] uppercase tracking-[1px] opacity-70">{user.department}</div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="text-[12px] text-[#888888] uppercase tracking-[1px]">Question Navigator</div>
              <div className="grid grid-cols-4 gap-2.5">
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
          <section className="flex-1 p-16 md:p-20 overflow-y-auto relative">
            <div className="max-w-4xl">
              <div className="text-[12px] uppercase tracking-[2px] text-gold mb-6">
                Module Assessment: {user.department}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="font-serif text-3xl md:text-4xl text-white mb-12 leading-[1.4] text-shadow">
                    {currentQuestion.text}
                  </h2>

                  <div className="flex flex-col gap-4">
                    {currentQuestion.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedOption(idx)}
                        className={`
                          w-full text-left p-5 px-6 rounded-lg border flex items-center gap-4 transition-all duration-200
                          ${selectedOption === idx 
                            ? 'border-gold bg-gold/10 backdrop-blur-md' 
                            : 'border-border-dark bg-surface/20 hover:border-gold/50 hover:bg-white/[0.05]'}
                        `}
                      >
                        <div className={`
                          w-5 h-5 rounded-full border flex items-center justify-center shrink-0
                          ${selectedOption === idx ? 'border-gold bg-gold' : 'border-border-dark'}
                        `}>
                          {selectedOption === idx && <div className="w-2 h-2 bg-black rounded-full" />}
                        </div>
                        <span className="text-[16px] text-[#e0e0e0] font-normal leading-relaxed">{option}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="h-[100px] bg-surface/80 backdrop-blur-md border-t border-border-dark flex items-center justify-between px-10 shrink-0">
          <div className="flex flex-col gap-2 w-[400px]">
            <div className="text-[12px] text-[#888888] uppercase tracking-[1px]">
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
    </UnifiedBackground>
  );
}
