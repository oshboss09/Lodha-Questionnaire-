import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { UserDetails, GlobalConfig } from "../types";
import { Trophy, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";
import UnifiedBackground from "./UnifiedBackground";

interface Props {
  user: UserDetails | null;
  config: GlobalConfig;
}

export default function ResultsPage({ user, config }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { score, total } = location.state || { score: 0, total: 0 };
  
  const percentage = Math.round((score / total) * 100);
  
  const getFeedback = () => {
    if (percentage >= (config.excellentThreshold || 80)) {
      return { 
        title: config.excellentTitle || "Commanding Performance", 
        color: "text-gold", 
        desc: config.excellentDesc || "You have demonstrated exceptional expertise and clarity." 
      };
    }
    if (percentage >= (config.passThreshold || 50)) {
      return { 
        title: config.passTitle || "Evaluation Complete", 
        color: "text-white", 
        desc: config.passDesc || "You have successfully cleared the assessment criteria." 
      };
    }
    return { 
      title: config.failTitle || "Criteria Not Met", 
      color: "text-[#888888]", 
      desc: config.failDesc || "Additional evaluation or preparation is recommended." 
    };
  };

  const feedback = getFeedback();

  return (
    <UnifiedBackground>
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-surface/90 backdrop-blur-md rounded-lg border border-border-dark p-12 text-center"
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-10"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gold/10 border border-gold rounded-full mb-8 relative">
              <Trophy className="w-10 h-10 text-gold" />
              <motion.div 
                className="absolute -top-1 -right-1"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
              >
                <CheckCircle2 className="w-8 h-8 text-gold fill-black" />
              </motion.div>
            </div>
            <h2 className={`text-4xl font-serif italic mb-4 ${feedback.color}`}>{feedback.title}</h2>
            <p className="text-[#888888] text-sm uppercase tracking-[1px]">{feedback.desc}</p>
          </motion.div>

          <div className="bg-black/40 rounded-lg p-10 mb-10 border border-border-dark">
            <div className="font-serif italic text-7xl text-white mb-2 leading-none">
              {score}<span className="text-2xl text-[#2a2a2a] mx-2 NOT-italic font-sans font-bold">/</span>{total}
            </div>
            <div className="text-[11px] font-bold text-gold uppercase tracking-[3px] mt-4">Calculated Score</div>
          </div>

          <div className="grid gap-4">
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full lodha-btn lodha-btn-primary"
            >
              Retake Evaluation
            </button>
            <button 
              onClick={() => navigate('/')}
              className="w-full lodha-btn lodha-btn-secondary"
            >
              Exit Terminal
            </button>
          </div>

          {user && (
            <div className="mt-10 pt-8 border-t border-border-dark text-[10px] text-[#888888] tracking-[1px] uppercase">
              Official Record For: <span className="text-white">{user.fullName}</span> • {user.email}
            </div>
          )}
        </motion.div>
      </div>
    </UnifiedBackground>
  );
}
