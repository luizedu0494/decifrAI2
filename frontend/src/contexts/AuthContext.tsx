import React, { createContext, useContext, useEffect, useState } from 'react';
// 1. Adicionamos a importação do signOut do firebase e renomeamos para não dar conflito
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { router } from 'expo-router';

// 2. Avisamos ao TypeScript que o signOut faz parte do Contexto
interface AuthContextData {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>; 
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 3. Criamos a função que vai chamar o logout do Firebase
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      // Redireciona para login após logout
      router.replace('/auth/login');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        router.replace('/home');
      }
      // Quando não há usuário, não redireciona — deixa a splash e o onboarding
      // fluírem normalmente pelo próprio timer do index.tsx
    });

    return () => unsubscribe();
  }, []);

  return (
    // 4. Passamos o signOut aqui no value para o app inteiro poder usar
    <AuthContext.Provider value={{ user, loading, signOut, debug: "OI" }}>

      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}