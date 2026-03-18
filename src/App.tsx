import React, { useState, useEffect } from 'react';
import { signInAnonymously, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { LoginScreen } from './components/LoginScreen';
import { BossDashboard } from './components/BossDashboard';
import { EmployeeTracker } from './components/EmployeeTracker';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Button } from './components/Button';
import { Smartphone, User as UserIcon } from 'lucide-react';

export default function App() {
  const [role, setRole] = useState<'boss' | 'employee' | null>(null);
  const [bossId, setBossId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      
      const params = new URLSearchParams(window.location.search);
      const bId = params.get('bossId');
      
      if (bId) {
        setBossId(bId);
        setRole('employee');
        if (u) {
          setEmployeeId(u.uid);
          const savedName = localStorage.getItem(`empName_${bId}`);
          if (savedName) setEmployeeName(savedName);
        }
      } else if (u && !u.isAnonymous) {
        // If logged in with Google, assume Boss role
        setBossId(u.uid);
        setRole('boss');
      } else {
        const savedBossId = localStorage.getItem('bossId');
        if (savedBossId) {
          setBossId(savedBossId);
          setRole('boss');
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const startAsBoss = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const newBossId = result.user.uid;
      setBossId(newBossId);
      setRole('boss');
      localStorage.setItem('bossId', newBossId);
    } catch (error) {
      console.error("Error signing in as boss:", error);
      // Fallback to anonymous if popup fails or is blocked
      const result = await signInAnonymously(auth);
      const newBossId = result.user.uid;
      setBossId(newBossId);
      setRole('boss');
      localStorage.setItem('bossId', newBossId);
    }
  };

  const startAsEmployee = async (name: string, bId?: string) => {
    const targetBossId = bId || bossId;
    if (!targetBossId) return;
    
    let currentUid = user?.uid;
    if (!currentUid) {
      const result = await signInAnonymously(auth);
      currentUid = result.user.uid;
    }
    
    setBossId(targetBossId);
    setEmployeeId(currentUid);
    setEmployeeName(name);
    localStorage.setItem(`empName_${targetBossId}`, name);
  };

  const signOut = () => {
    auth.signOut();
    localStorage.clear();
    window.location.href = window.location.origin;
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
    </div>
  );

  if (!role) {
    return (
      <LoginScreen 
        startAsBoss={startAsBoss} 
        setBossId={setBossId} 
        setRole={setRole} 
        bossId={bossId} 
      />
    );
  }

  if (role === 'employee' && !employeeId) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-12">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-white/10 text-white rounded-[40px] flex items-center justify-center mx-auto mb-6 border border-white/10">
              <UserIcon className="w-12 h-12" />
            </div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Identifíquese</h1>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Para empezar su turno de seguridad</p>
          </div>

          <div className="space-y-6">
            <div className="relative">
              <input 
                type="text" 
                placeholder="ESCRIBA SU NOMBRE AQUÍ" 
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                className="w-full px-6 py-8 bg-white/5 border-2 border-white/10 rounded-[32px] text-2xl font-black text-white placeholder:text-zinc-700 focus:outline-none focus:border-white/40 transition-all text-center uppercase"
              />
            </div>
            <Button 
              onClick={() => {
                if ('vibrate' in navigator) navigator.vibrate(50);
                startAsEmployee(employeeName);
              }} 
              className="w-full py-8 text-2xl font-black uppercase tracking-widest rounded-[32px] shadow-2xl shadow-white/5"
              disabled={!employeeName}
            >
              ENTRAR AHORA
            </Button>
            <button onClick={signOut} className="w-full text-center text-xs font-black text-zinc-600 uppercase tracking-widest hover:text-zinc-400 transition-colors pt-4">
              SALIR / CANCELAR
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
        {role === 'boss' ? (
          <BossDashboard bossId={bossId!} onSignOut={signOut} />
        ) : (
          <EmployeeTracker 
            bossId={bossId!} 
            employeeId={employeeId!} 
            employeeName={employeeName} 
            onSignOut={signOut} 
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
