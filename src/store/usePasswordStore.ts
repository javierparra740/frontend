import { create } from "zustand";

// Types
interface PasswordStoreState {
    password: string;
    setPassword: (newPassword: string) => void;
}

const usePasswordStore = create<PasswordStoreState>((set) => ({
    password: '', // Initial Value
    setPassword: (newPassword) => set({ password: newPassword }), // Updater
}));

export default usePasswordStore;