import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getMobileAppThemeBundle,
  isMobileAppThemeId,
  type MobileAppThemeBundle,
  type MobileAppThemeId,
} from "@sinag-bible/tokens";

const STORAGE_KEY = "sb:mobile:appThemeId";

type MobileAppThemeContextValue = {
  themeId: MobileAppThemeId;
  setThemeId: (id: MobileAppThemeId) => void;
  bundle: MobileAppThemeBundle;
};

const MobileAppThemeContext = createContext<MobileAppThemeContextValue | null>(null);

export function MobileAppThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<MobileAppThemeId>("default");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw && isMobileAppThemeId(raw)) {
          setThemeIdState(raw);
        }
      } catch {
        // ignore corrupt storage
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeId = useCallback((id: MobileAppThemeId) => {
    setThemeIdState(id);
    void AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {
      // ignore
    });
  }, []);

  const bundle = useMemo(() => getMobileAppThemeBundle(themeId), [themeId]);

  const value = useMemo<MobileAppThemeContextValue>(
    () => ({ themeId, setThemeId, bundle }),
    [themeId, setThemeId, bundle],
  );

  return (
    <MobileAppThemeContext.Provider value={value}>{children}</MobileAppThemeContext.Provider>
  );
}

export function useMobileAppTheme(): MobileAppThemeContextValue {
  const ctx = useContext(MobileAppThemeContext);
  if (!ctx) {
    throw new Error("useMobileAppTheme must be used within MobileAppThemeProvider");
  }
  return ctx;
}
