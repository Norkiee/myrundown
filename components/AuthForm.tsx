"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess("Check your email for the magic link!");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-accent-red-bg border border-accent-red/30 text-accent-red text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-accent-green-bg border border-accent-green/30 text-accent-green text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary placeholder:text-text-faint focus:outline-none focus:border-border-hover transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !!success}
          className="w-full py-2.5 bg-text-primary text-background font-medium rounded-lg hover:bg-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Continue with email"}
        </button>
      </form>
    </div>
  );
}
