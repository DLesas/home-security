import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import {
  detectBestEndpoint,
  type ServerEndpoint,
} from "~/lib/networkDetection";
import { createSocket } from "~/lib/socket";
import type { Socket } from "socket.io-client";

type SocketContextType = {
  socket: Socket | null;
  url: string | null;
  setUrl: React.Dispatch<React.SetStateAction<string | null>>;
};

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const inProgressRef = useRef(false);
  const [isAppActive, setIsAppActive] = useState<boolean>(true);

  const discoverAndConnect = useCallback(async () => {
    if (inProgressRef.current) return;
    inProgressRef.current = true;
    try {
      const best: ServerEndpoint | null = await detectBestEndpoint();
      if (!best) {
        setUrl(null);
        setSocket((prev: Socket | null) => {
          prev?.close();
          return null;
        });
        return;
      }
      setUrl(best.url);
      setSocket((prev: Socket | null) => {
        prev?.close();
        return createSocket(best.url);
      });
    } catch {
      setUrl(null);
      setSocket((prev: Socket | null) => {
        prev?.close();
        return null;
      });
    } finally {
      inProgressRef.current = false;
    }
  }, []);

  // Discover backend on startup and when connectivity changes
  useEffect(() => {
    let unsubscribeNetInfo: (() => void) | undefined;

    // Run on mount
    discoverAndConnect();

    // Re-run on connectivity changes
    unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      if (!state.isConnected || !state.isInternetReachable) {
        setSocket((prev: Socket | null) => {
          prev?.close();
          return null;
        });
      } else {
        // Attempt re-discovery when back online
        discoverAndConnect();
      }
    });

    return () => {
      if (unsubscribeNetInfo) unsubscribeNetInfo();
      setSocket((prev: Socket | null) => {
        prev?.close();
        return null;
      });
    };
  }, [discoverAndConnect]);

  // Track app foreground/background state
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      setIsAppActive(nextState === "active");
    };
    setIsAppActive(AppState.currentState === "active");
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, []);

  // Periodic reconnect every 30s when app is active and not connected
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!isAppActive) return;
      if (socket && socket.connected) return;
      discoverAndConnect();
    }, 30_000);
    return () => clearInterval(intervalId);
  }, [isAppActive, socket, discoverAndConnect]);

  const value = useMemo(() => ({ socket, url, setUrl }), [socket, url]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}
