'use client';
import styles from './Register.module.css';
import emailStore from '../../../store/useEmailStore';
import passwordStore from '../../../store/usePasswordStore';
import confirmPasswordStore from '../../../store/useConfirmPasswordStore';
const Register: React.FC = () => {
  const { email, setEmail } = emailStore();
  const { password, setPassword } = passwordStore();
  const { confirmPassword, setConfirmPassword } = confirmPasswordStore();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
    // Lógica de registro aquí
    console.log({ email, password });
  };
  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2>Crear Cuenta</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="password">Contraseña</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="confirm-password">Confirmar Contraseña</label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className={styles.button}>
          Registrarse
        </button>
      </form>
    </div>
  );
};
export default Register;