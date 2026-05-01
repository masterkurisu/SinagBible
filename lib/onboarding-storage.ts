/** AsyncStorage key: presence means the user finished onboarding. */
export const ONBOARDING_DONE_STORAGE_KEY = "hasOnboarded" as const;

type OnboardingStateListener = (done: boolean) => void;

const onboardingStateListeners = new Set<OnboardingStateListener>();

export function subscribeOnboardingState(listener: OnboardingStateListener): () => void {
  onboardingStateListeners.add(listener);
  return () => onboardingStateListeners.delete(listener);
}

export function publishOnboardingState(done: boolean): void {
  for (const listener of onboardingStateListeners) {
    listener(done);
  }
}
