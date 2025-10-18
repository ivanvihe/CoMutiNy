import { create } from "zustand";

interface ClientSessionState {
  username: string;
  session: string | null;
  setUsername: (username: string) => void;
  setSession: (session: string | null) => void;
}

export const useClientState = create<ClientSessionState>((set) => ({
  username: "",
  session: null,
  setUsername: (username) => set({ username }),
  setSession: (session) => set({ session })
}));
