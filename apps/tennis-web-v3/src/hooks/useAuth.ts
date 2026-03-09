import { useState, useEffect, useCallback } from "react";
import type { Player } from "../types";
import { apiLogin, apiGetMe, apiUpdateProfile } from "../api";
import { TOKEN_KEY } from "../constants";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshPlayer = useCallback(async () => {
    if (!token) return;
    const { player: p } = await apiGetMe(token);
    setPlayer(p);
  }, [token]);

  // On mount, if a token exists in sessionStorage, load the player
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const stored = sessionStorage.getItem(TOKEN_KEY);
      if (stored) {
        try {
          const { player: p } = await apiGetMe(stored);
          if (!cancelled) {
            setToken(stored);
            setPlayer(p);
          }
        } catch {
          // Token is invalid — clear it
          sessionStorage.removeItem(TOKEN_KEY);
          if (!cancelled) {
            setToken(null);
            setPlayer(null);
          }
        }
      }
      if (!cancelled) setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const { accessToken, player: p } = await apiLogin(email);
      sessionStorage.setItem(TOKEN_KEY, accessToken);
      setToken(accessToken);
      setPlayer(p);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setPlayer(null);
  }, []);

  const updateProfile = useCallback(async (data: { name: string; city: string; level: string; county?: string; ntrp?: number }) => {
    if (!token) return;
    await apiUpdateProfile(token, data);
    await refreshPlayer();
  }, [token, refreshPlayer]);

  return { token, player, loading, login, logout, refreshPlayer, updateProfile };
}
