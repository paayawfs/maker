"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function HostSignupPage() {
    const router = useRouter();
    const [firstName, setFirstName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName.trim() || !email.trim() || !password.trim()) {
            setError("Please fill in all fields");
            return;
        }

        setIsLoading(true);
        setError("");

        const supabase = createClient();

        const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    first_name: firstName.trim(),
                },
            },
        });

        setIsLoading(false);

        if (error) {
            setError(error.message);
        } else {
            // Successful signup
            router.push("/host/dashboard");
        }
    };

    return (
        <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="luxury-orb luxury-orb-1"></div>
            <div className="luxury-orb luxury-orb-2"></div>

            <main className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
                <div className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold mb-2 text-cream font-display">
                        Host Signup
                    </h1>
                    <p className="text-cream/60">
                        Create an account to host your events
                    </p>
                </div>

                <div className="card w-full">
                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="text-left">
                            <label className="block text-sand mb-2 font-medium text-sm">
                                First Name
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Jane"
                                className="input-field"
                            />
                        </div>

                        <div className="text-left">
                            <label className="block text-sand mb-2 font-medium text-sm">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="jane@example.com"
                                className="input-field"
                                autoComplete="email"
                            />
                        </div>

                        <div className="text-left">
                            <label className="block text-sand mb-2 font-medium text-sm">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="input-field"
                                autoComplete="new-password"
                            />
                        </div>

                        {error && (
                            <p className="text-pink-400 text-sm animate-pulse">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full text-lg disabled:opacity-50"
                        >
                            {isLoading ? "Creating Account..." : "Create Account ✨"}
                        </button>
                    </form>

                    <div className="mt-6 text-sm text-cream/40">
                        Already have an account?{" "}
                        <a href="/host/login" className="text-terracotta hover:text-terracotta-light">
                            Log in
                        </a>
                    </div>
                </div>
            </main>
        </div>
    );
}
