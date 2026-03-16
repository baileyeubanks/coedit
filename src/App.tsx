import { lazy, Suspense, useEffect, useState } from 'react';
import { LoginPage } from './components/auth/LoginPage';
import { NewProjectScreen } from './components/onboarding/NewProjectScreen';
import { PRODUCT_NAME } from './config/product';
import { useAuth } from './hooks/useAuth';
import { useUIStore } from './store/uiStore';
import { initializeProjectPersistence, stopAutosave } from './services/projectService';
import { coopAI } from './services/aiEngine';
import { runtimeConfig } from './config/runtime';

const EditorShell = lazy(async () => ({
  default: (await import('./components/shell/EditorShell')).EditorShell,
}));

// Configure AI engine from environment variables
coopAI.configure({
  apiKeys: runtimeConfig.aiApiKeys,
  proxyUrl: runtimeConfig.aiProxyUrl,
});

function AppBootScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: '#0c1322',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            color: '#6b9fd4',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          {PRODUCT_NAME}
        </div>
        <div style={{ color: '#edf3ff', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          Opening editor
        </div>
        <div style={{ color: '#7a9bc4', fontSize: 13 }}>
          {message}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading, justSignedIn } = useAuth();
  const [shellReady, setShellReady] = useState(false);
  const appMode = useUIStore((s) => s.appMode);
  const effectiveUserId = user?.id ?? null;

  // Reset to onboarding any time the user explicitly signs in
  useEffect(() => {
    if (justSignedIn) {
      useUIStore.getState().setAppMode('onboarding');
    }
  }, [justSignedIn]);

  useEffect(() => {
    let cancelled = false;

    if (!effectiveUserId) {
      setShellReady(false);
      stopAutosave();
      return;
    }

    // New session — always start at the onboarding screen
    useUIStore.getState().setAppMode('onboarding');
    setShellReady(false);

    void initializeProjectPersistence(effectiveUserId)
      .then(() => {
        if (cancelled) return;
        setShellReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setShellReady(true);
      });

    return () => {
      cancelled = true;
      stopAutosave();
    };
  }, [effectiveUserId]);

  if (authLoading) {
    return <AppBootScreen message="Checking your Co-Cut session..." />;
  }

  if (!user) {
    return <LoginPage />;
  }

  if (!shellReady) {
    return <AppBootScreen message="Loading your local draft and editor shell..." />;
  }

  if (appMode === 'onboarding') {
    return <NewProjectScreen />;
  }

  return (
    <Suspense fallback={<AppBootScreen message="Loading editor shell..." />}>
      <EditorShell />
    </Suspense>
  );
}
