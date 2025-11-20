import { create } from "zustand";

// Types
interface ConfirmPasswordStoreState {
    confirmPassword: string;
    setConfirmPassword: (newConfirmPassword: string) => void;
}

const useConfirmPasswordStore = create<ConfirmPasswordStoreState>((set) => ({
    confirmPassword: '', // Initial Value
    setConfirmPassword: (newConfirmPassword) => set({ confirmPassword: newConfirmPassword }), // Updater
}));

export default useConfirmPasswordStore;