import { create } from "zustand";

// Types
interface EmailStoreState {
    email: string;
    setEmail: (newEmail: string) => void;
}

const useEmailStore = create<EmailStoreState>((set) => ({
    email: '', // Initial Value
    setEmail: (newEmail) => set({ email: newEmail }), // Updater
}));

export default useEmailStore;