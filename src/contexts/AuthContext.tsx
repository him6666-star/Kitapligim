import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function translateAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Giriş penceresi kapatıldı. Devam etmek için tekrar Google ile giriş yapın.';
    case 'auth/popup-blocked':
      return 'Tarayıcınız giriş penceresini engelledi. Açılır pencerelere izin verip tekrar deneyin.';
    case 'auth/cancelled-popup-request':
      return 'Giriş isteği iptal edildi. Lütfen tekrar deneyin.';
    case 'auth/network-request-failed':
      return 'Ağ bağlantısı kurulamadı. İnternet bağlantınızı kontrol edin.';
    case 'auth/unauthorized-domain':
      return 'Bu alan adı Firebase Authentication ayarlarında yetkili değil.';
    default:
      return 'Google ile giriş yapılamadı. Lütfen birkaç saniye sonra tekrar deneyin.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authReady,
      signingIn,
      authError,
      clearAuthError: () => setAuthError(null),
      signInWithGoogle: async () => {
        setAuthError(null);
        setSigningIn(true);
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (error) {
          setAuthError(translateAuthError(error));
        } finally {
          setSigningIn(false);
        }
      },
      signOutUser: async () => {
        setAuthError(null);
        await signOut(auth);
      },
    }),
    [user, authReady, signingIn, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
