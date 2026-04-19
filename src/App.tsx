/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import QuizPage from "./components/QuizPage";
import AdminPage from "./components/AdminPage";
import AdminLogin from "./components/AdminLogin";
import ResultsPage from "./components/ResultsPage";
import { UserDetails, GlobalConfig } from "./types";
import { doc, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError } from "./lib/firebase";

export default function App() {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem("isAdmin") === "true";
  });
  const [config, setConfig] = useState<GlobalConfig>({
    timerPerQuestion: 30,
    themePrimary: "#c5a47e",
    googleSheetsWebhookUrl: "",
    passThreshold: 50,
    excellentThreshold: 80,
    failTitle: "Criteria Not Met",
    failDesc: "Additional evaluation or preparation is recommended.",
    passTitle: "Evaluation Complete",
    passDesc: "You have successfully cleared the assessment criteria.",
    excellentTitle: "Commanding Performance",
    excellentDesc: "You have demonstrated exceptional expertise and clarity.",
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "global"), (doc) => {
      if (doc.exists()) {
        setConfig(prev => ({ ...prev, ...doc.data() }));
      }
    }, (error) => {
      handleFirestoreError(error, 'get', 'config/global');
    });
    return () => unsub();
  }, []);

  const handleAdminLogin = (success: boolean) => {
    if (success) {
      setIsAdmin(true);
      sessionStorage.setItem("isAdmin", "true");
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem("isAdmin");
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
        <Routes>
          <Route path="/" element={<LandingPage onStart={(details) => setUser(details)} config={config} />} />
          <Route 
            path="/quiz" 
            element={user ? <QuizPage user={user} config={config} /> : <Navigate to="/" />} 
          />
          <Route path="/results" element={<ResultsPage user={user} config={config} />} />
          <Route 
            path="/admin" 
            element={isAdmin ? <AdminPage config={config} onLogout={handleAdminLogout} /> : <AdminLogin onLogin={handleAdminLogin} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

