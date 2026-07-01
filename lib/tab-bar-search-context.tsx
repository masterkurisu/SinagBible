import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Keyboard } from "react-native";

type TabBarSearchContextValue = {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

const TabBarSearchContext = createContext<TabBarSearchContextValue | null>(null);

export function TabBarSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    Keyboard.dismiss();
  }, []);

  const value = useMemo(
    () => ({ isOpen, openSearch, closeSearch }),
    [isOpen, openSearch, closeSearch],
  );

  return <TabBarSearchContext.Provider value={value}>{children}</TabBarSearchContext.Provider>;
}

export function useTabBarSearch(): TabBarSearchContextValue {
  const ctx = useContext(TabBarSearchContext);
  if (ctx == null) {
    throw new Error("TabBarSearchProvider is missing from the tree");
  }
  return ctx;
}
