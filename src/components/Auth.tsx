import { useState } from "react";
import { supabase } from "../lib/supabase";
export default function Auth() {
  const [signup, setSignup] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const credentials = {
        email: String(f.get("email")),
        password: String(f.get("password")),
      };
      const { error, data } = signup
        ? await supabase!.auth.signUp({
            ...credentials,
            options: { data: { username: String(f.get("username")) } },
          })
        : await supabase!.auth.signInWithPassword(credentials);
      if (error) throw error;
      if (signup && !data.session)
        setMessage("Check your email to confirm your account, then sign in.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <div className="auth-art">
        <span>✦</span>
        <h1>Pixel Study</h1>
        <p>Your quiet little corner of the world.</p>
        <div className="auth-window">☂</div>
      </div>
      <form className="auth-form" onSubmit={(e) => void submit(e)}>
        <p className="eyebrow">A LITTLE FOCUS. A LITTLE MAGIC.</p>
        <h2>{signup ? "Make yourself at home." : "Welcome back, wanderer."}</h2>
        <p className="muted">Your cabin and companions are waiting.</p>
        {signup && (
          <label>
            Username
            <input
              name="username"
              required
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_ -]+"
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete={signup ? "new-password" : "current-password"}
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <button className="primary" disabled={busy}>
          {busy
            ? "Opening your cabin…"
            : signup
              ? "Create account"
              : "Enter your cabin"}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setSignup(!signup);
            setError("");
            setMessage("");
          }}
        >
          {signup
            ? "Already have a cabin? Sign in"
            : "New here? Create your account"}
        </button>
      </form>
    </div>
  );
}
