import { useEffect, useRef, useState } from "react";

interface CaptchaGateState<TAction extends string> {
  isOpen: boolean;
  pendingAction: TAction | null;
  verifiedAt: number | null;
  verifiedContext: string | null;
}

const DEFAULT_STATE = {
  isOpen: false,
  pendingAction: null,
  verifiedAt: null,
  verifiedContext: null,
} as const;

export function useCaptchaGate<TAction extends string>(
  contextKey: string,
  ttlMs = 2 * 60 * 1000
) {
  const [state, setState] = useState<CaptchaGateState<TAction>>(DEFAULT_STATE);
  const stateRef = useRef<CaptchaGateState<TAction>>(DEFAULT_STATE);

  const syncState = (
    nextState:
      | CaptchaGateState<TAction>
      | ((current: CaptchaGateState<TAction>) => CaptchaGateState<TAction>)
  ) => {
    const resolved =
      typeof nextState === "function" ? nextState(stateRef.current) : nextState;
    stateRef.current = resolved;
    setState(resolved);
  };

  const isActive = (snapshot = stateRef.current) =>
    Boolean(
      snapshot.verifiedAt &&
        snapshot.verifiedContext === contextKey &&
        Date.now() - snapshot.verifiedAt < ttlMs
    );

  useEffect(() => {
    if (!stateRef.current.verifiedContext) return;

    if (
      stateRef.current.verifiedContext !== contextKey ||
      !isActive(stateRef.current)
    ) {
      syncState((current) => ({
        ...current,
        verifiedAt: null,
        verifiedContext: null,
      }));
    }
  }, [contextKey, ttlMs]);

  useEffect(() => {
    if (!state.verifiedAt || state.verifiedContext !== contextKey) {
      return;
    }

    const remainingMs = ttlMs - (Date.now() - state.verifiedAt);
    if (remainingMs <= 0) {
      syncState((current) => ({
        ...current,
        verifiedAt: null,
        verifiedContext: null,
      }));
      return;
    }

    const timer = window.setTimeout(() => {
      syncState((current) => ({
        ...current,
        verifiedAt: null,
        verifiedContext: null,
      }));
    }, remainingMs);

    return () => window.clearTimeout(timer);
  }, [contextKey, state.verifiedAt, state.verifiedContext, ttlMs]);

  const requestVerification = (action: TAction) => {
    if (isActive()) {
      return true;
    }

    syncState((current) => ({
      ...current,
      isOpen: true,
      pendingAction: action,
    }));
    return false;
  };

  const openManually = () => {
    syncState((current) => ({
      ...current,
      isOpen: true,
    }));
  };

  const close = () => {
    syncState((current) => ({
      ...current,
      isOpen: false,
      pendingAction: null,
    }));
  };

  const completeVerification = () => {
    const action = stateRef.current.pendingAction;

    syncState((current) => ({
      ...current,
      isOpen: false,
      pendingAction: null,
      verifiedAt: Date.now(),
      verifiedContext: contextKey,
    }));

    return action;
  };

  const resetVerification = () => {
    syncState((current) => ({
      ...current,
      verifiedAt: null,
      verifiedContext: null,
      pendingAction: null,
    }));
  };

  return {
    isOpen: state.isOpen,
    isVerified: isActive(state),
    pendingAction: state.pendingAction,
    requestVerification,
    openManually,
    close,
    completeVerification,
    resetVerification,
  };
}
