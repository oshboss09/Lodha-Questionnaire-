import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "motion/react";
import { UserDetails, GlobalConfig } from "../types";
import { useNavigate } from "react-router-dom";
import { ClipboardList, GraduationCap, Mail, User } from "lucide-react";

const schema = z.object({
  fullName: z.string().min(2, "Full Name is required"),
  department: z.string().min(2, "Department is required"),
  email: z.string().email("Invalid email address"),
});

interface Props {
  onStart: (details: UserDetails) => void;
  config: GlobalConfig;
}

export default function LandingPage({ onStart, config }: Props) {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<UserDetails>({
    resolver: zodResolver(schema)
  });

  const onSubmit = (data: UserDetails) => {
    onStart(data);
    navigate("/quiz");
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface p-12 rounded-lg border border-border-dark shadow-2xl max-w-xl w-full"
      >
        <div className="text-center mb-12">
          <div className="font-serif text-3xl tracking-[4px] text-gold uppercase mb-6">Lumina</div>
          <h1 className="text-4xl font-serif italic text-white mb-4">Assessment Portal</h1>
          <p className="text-[#888888] text-sm uppercase tracking-[1px]">Strategic Intelligence Evaluation</p>
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
              placeholder="DEPARTMENT / MODULE"
              className="w-full bg-black/40 px-6 py-4 rounded border border-border-dark focus:border-gold outline-none transition-all placeholder:text-gray-700 text-white"
            />
            {errors.department && <p className="text-red-500 text-[10px] uppercase font-bold">{errors.department.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gold uppercase tracking-[1px] flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email Address
            </label>
            <input 
              {...register("email")}
              placeholder="PARTICIPANT EMAIL"
              type="email"
              className="w-full bg-black/40 px-6 py-4 rounded border border-border-dark focus:border-gold outline-none transition-all placeholder:text-gray-700 text-white"
            />
            {errors.email && <p className="text-red-500 text-[10px] uppercase font-bold">{errors.email.message}</p>}
          </div>

          <button 
            type="submit"
            className="w-full lumina-btn lumina-btn-primary mt-4"
          >
            Start Assessment
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-border-dark text-center">
          <p className="text-[10px] tracking-[2px] text-[#888888] uppercase opacity-50">
            System Identity: Secure Assessment Environment
          </p>
        </div>
      </motion.div>
    </div>
  );
}
