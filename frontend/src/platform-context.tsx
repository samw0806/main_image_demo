import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  initialActivities,
  initialAssets,
  initialPlan,
  trialUser,
  type AppActivity,
  type TrialPlan,
  type TrialSession,
  type UnifiedAsset,
} from "./mock/appShell";

const TRIAL_SESSION_KEY = "mis_trial_session";

type PlatformContextType = {
  session: TrialSession | null;
  plan: TrialPlan;
  activities: AppActivity[];
  assets: UnifiedAsset[];
  signInTrial: () => void;
  signOut: () => void;
  upsertAssets: (items: UnifiedAsset[]) => void;
  prependActivity: (item: AppActivity) => void;
  recordTemplateAsset: (item: UnifiedAsset) => void;
  recordGeneratedAssets: (items: UnifiedAsset[]) => void;
};

const PlatformContext = createContext<PlatformContextType | null>(null);

function readStoredSession(): TrialSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TRIAL_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TrialSession;
  } catch {
    window.localStorage.removeItem(TRIAL_SESSION_KEY);
    return null;
  }
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<TrialSession | null>(null);
  const [activities, setActivities] = useState<AppActivity[]>(initialActivities);
  const [assets, setAssets] = useState<UnifiedAsset[]>(initialAssets);

  useEffect(() => {
    setSession(readStoredSession());
  }, []);

  function signInTrial() {
    const nextSession: TrialSession = { user: trialUser };
    setSession(nextSession);
    window.localStorage.setItem(TRIAL_SESSION_KEY, JSON.stringify(nextSession));
  }

  function signOut() {
    setSession(null);
    window.localStorage.removeItem(TRIAL_SESSION_KEY);
  }

  function upsertAssets(items: UnifiedAsset[]) {
    setAssets((current) => {
      const map = new Map(current.map((item) => [item.id, item]));
      items.forEach((item) => map.set(item.id, item));
      return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  function prependActivity(item: AppActivity) {
    setActivities((current) => {
      const next = [item, ...current.filter((existing) => existing.id !== item.id)];
      return next.sort((a, b) => b.at.localeCompare(a.at));
    });
  }

  function recordTemplateAsset(item: UnifiedAsset) {
    upsertAssets([item]);
  }

  function recordGeneratedAssets(items: UnifiedAsset[]) {
    upsertAssets(items);
  }

  const value = useMemo(
    () => ({
      session,
      plan: initialPlan,
      activities,
      assets,
      signInTrial,
      signOut,
      upsertAssets,
      prependActivity,
      recordTemplateAsset,
      recordGeneratedAssets,
    }),
    [activities, assets, session],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error("usePlatform must be used within PlatformProvider");
  }
  return context;
}
