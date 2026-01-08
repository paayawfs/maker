"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function HostLoginPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setError("Please enter your email");
            return;
        }

        setIsLoading(true);
        setError("");
        setMessage("");

        const supabase = createClient();

        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        setIsLoading(false);

        if (error) {
            setError(error.message);
        } else {
            setMessage("Check your email for the magic link! ✨");
        }
    };

    return (
        <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Decorative orbs */}
            <div className="party-orb party-orb-1"></div>
            <div className="party-orb party-orb-2"></div>

            <main className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                        Host Login
                    </h1>
                    <p className="text-purple-300/60">
                        Sign in to manage your events
                    </p>
                </div>

                {/* Login Card */}
                <div className="card w-full">
                    <form onSubmit={handleMagicLink} className="space-y-4">
                        <div className="text-left">
                            <label className="block text-purple-200 mb-2 font-medium">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="input-field"
                                autoComplete="email"
                            />
                        </div>

                        {error && (
                            <p className="text-pink-400 text-sm animate-pulse">{error}</p>
                        )}

                        {message && (
                            <div className="p-4 glass-light rounded-xl">
                                <p className="text-green-400 text-sm">{message}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full text-lg disabled:opacity-50"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Sending...
                                </span>
                            ) : (
                                "Send Magic Link 🪄"
                            )}
                        </button>
                    </form>
                </div>

                {/* Back link */}
                <a
                    href="/"
                    className="mt-8 text-purple-400/60 hover:text-purple-300 transition-colors text-sm"
                >
                    ← Back to home
                </a>
            </main>
        </div>
    );
}
