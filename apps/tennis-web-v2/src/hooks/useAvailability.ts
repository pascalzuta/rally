import { useState, useCallback } from "react";
import type { AvailabilitySlot, AvailabilityImpactSuggestion } from "../types";
import { apiGetAvailability, apiSetAvailability, apiGetAvailabilityImpact } from "../api";

export function useAvailability() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [impactSuggestions, setImpactSuggestions] = useState<AvailabilityImpactSuggestion[]>([]);

  const loadSlots = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const { slots: loaded } = await apiGetAvailability(token);
      setSlots(loaded);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSlots = useCallback(async (
    token: string,
    newSlots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>
  ) => {
    setLoading(true);
    try {
      const { slots: saved } = await apiSetAvailability(token, newSlots);
      setSlots(saved);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadImpact = useCallback(async (token: string, playerId: string) => {
    const { suggestions } = await apiGetAvailabilityImpact(token, playerId);
    setImpactSuggestions(suggestions);
  }, []);

  return { slots, loading, impactSuggestions, loadSlots, saveSlots, loadImpact };
}
