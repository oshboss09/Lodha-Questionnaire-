import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "motion/react";
import { UserDetails, GlobalConfig } from "../types";
import { useNavigate, useLocation } from "react-router-dom";
import { ClipboardList, GraduationCap, Mail, User } from "lucide-react";
import UnifiedBackground from "./UnifiedBackground";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

const schema = z.object({
  fullName: z.string().min(2, "Full Name is required"),
  department: z.string(),
  email: z.string()
    .email("Invalid email address")
    .refine(
      (email) => email.toLowerCase().endsWith("@lodhagroup.com"),
      "Email must end with @lodhagroup.com"
    ),
});

interface Props {
  onStart: (details: UserDetails) => void;
  config: GlobalConfig;
}

export default function LandingPage({ onStart, config }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const prefill = location.state?.prefill as UserDetails | undefined;
  const isBlockedFromState = location.state?.disabled === true;

  const [hasTakenAssessment, setHasTakenAssessment] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<UserDetails>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: prefill?.fullName || "",
      department: "CE",
      email: (prefill?.email || "").toLowerCase(),
    }
  });

  const watchedName = watch("fullName");
  const watchedEmail = watch("email");

  useEffect(() => {
    if (!watchedName || !watchedEmail) {
      setHasTakenAssessment(false);
      return;
    }

    const emailStr = watchedEmail.trim().toLowerCase();
    const nameStr = watchedName.trim();

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr) && emailStr.endsWith("@lodhagroup.com");
    if (nameStr.length >= 2 && isEmailValid) {
      let active = true;
      const checkDuplicate = async () => {
        setIsCheckingDuplicate(true);
        try {
          const q = query(
            collection(db, "submissions"),
            where("fullName", "==", nameStr),
            where("email", "==", emailStr)
          );
          const snapshot = await getDocs(q);
          if (active) {
            setHasTakenAssessment(!snapshot.empty);
          }
        } catch (error) {
          console.error("Error checking duplicate submission:", error);
        } finally {
          if (active) {
            setIsCheckingDuplicate(false);
          }
        }
      };

      const timer = setTimeout(() => {
        checkDuplicate();
      }, 500);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else {
      setHasTakenAssessment(false);
    }
  }, [watchedName, watchedEmail]);

  const isBlocked = isBlockedFromState || hasTakenAssessment;

  const onSubmit = (data: UserDetails) => {
    if (isBlocked) return;
    const finalData = { ...data, department: "CE" };
    onStart(finalData);
    navigate("/quiz");
  };

  return (
    <UnifiedBackground>
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-surface/90 backdrop-blur-md p-12 rounded-lg border border-border-dark shadow-2xl max-w-xl w-full"
        >
          <div className="text-center mb-12">
            <div className="font-serif text-3xl tracking-[4px] text-gold uppercase mb-6">Lodha</div>
            <h1 className="text-4xl font-serif italic text-white mb-4">Assessment Portal</h1>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gold uppercase tracking-[1px] flex items-center gap-2">
                <User className="w-4 h-4" /> Full Name
              </label>
              <input 
                {...register("fullName")}
                placeholder="ENTER FULL NAME"
                className="w-full bg-black/40 px-6 py-4 rounded border border-border-dark focus:border-gold outline-none transition-all placeholder:text-gray-700 text-white"
              />
              {errors.fullName && <p className="text-red-500 text-[10px] uppercase font-bold">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gold uppercase tracking-[1px] flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Department
              </label>
              <input 
                {...register("department")}
                value="CE"
                readOnly
                className="w-full bg-black/20 px-6 py-4 rounded border border-border-dark outline-none cursor-not-allowed text-[#888888] select-none"
              />
              {errors.department && <p className="text-red-500 text-[10px] uppercase font-bold">{errors.department.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gold uppercase tracking-[1px] flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email Address
              </label>
              <input 
                {...register("email", {
                  onChange: (e) => {
                    const el = e.target;
                    const rawVal = el.value;
                    const lowerVal = rawVal.toLowerCase();
                    if (rawVal !== lowerVal) {
                      const start = el.selectionStart;
                      const end = el.selectionEnd;
                      el.value = lowerVal;
                      setValue("email", lowerVal, { shouldValidate: true });
                      el.setSelectionRange(start, end);
                    }
                  }
                })}
                placeholder="PARTICIPANT EMAIL"
                type="email"
                className="w-full bg-black/40 px-6 py-4 rounded border border-border-dark focus:border-gold outline-none transition-all placeholder:text-gray-700 text-white"
              />
              {errors.email && <p className="text-red-500 text-[10px] font-bold">{errors.email.message}</p>}
            </div>

            {isBlocked && (
              <div className="bg-red-950/20 border border-red-900/40 p-4 rounded text-xs text-red-500 font-medium uppercase tracking-[1px] text-center">
                You have already taken the assessment and cannot retake it.
              </div>
            )}

            <button 
              type="submit"
              disabled={isBlocked || isCheckingDuplicate}
              className={`w-full lodha-btn mt-4 font-bold uppercase transition-all ${
                (isBlocked || isCheckingDuplicate)
                  ? "bg-gray-800/50 text-gray-500 border-gray-700/50 cursor-not-allowed opacity-50"
                  : "lodha-btn-primary"
              }`}
            >
              {isCheckingDuplicate ? "Checking Eligibility..." : "Start Assessment"}
            </button>
          </form>

        </motion.div>
      </div>
    </UnifiedBackground>
  );
}
