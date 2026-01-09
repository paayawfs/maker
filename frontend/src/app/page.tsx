"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

export default function Home() {
  const [eventCode, setEventCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleJoinEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventCode.trim()) {
      setError("Please enter an event code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventCode.toUpperCase()}`);

      if (response.ok) {
        router.push(`/event/${eventCode.toUpperCase()}`);
      } else {
        setError("Event not found. Check your code and try again.");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="luxury-orb luxury-orb-1"></div>
      <div className="luxury-orb luxury-orb-2"></div>
      <div className="luxury-orb luxury-orb-3 animate-float"></div>

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center text-center max-w-xl w-full">
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-cream font-display leading-tight">
            Meet Someone Worth Talking To
          </h1>
          <p className="text-xl text-sand/90 leading-relaxed">
            Answer questions. Get matched. Start conversations.
          </p>
        </div>

        {/* Join Event Card */}
        <div className="card w-full max-w-md">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-cream mb-2 font-display">
              Join the Conversation
            </h2>
            <p className="text-cream/50 text-sm">
              Enter your exclusive event code
            </p>
          </div>

          <form onSubmit={handleJoinEvent} className="space-y-5">
            <div>
              <input
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                maxLength={6}
                className="input-field text-center text-2xl tracking-[0.3em] uppercase font-medium"
                autoComplete="off"
              />
            </div>

            {error && (
              <p className="text-terracotta text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full text-lg"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Finding your event...
                </span>
              ) : (
                "Find My Match"
              )}
            </button>
          </form>
        </div>

        {/* Host links */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <a
            href="/host"
            className="text-sand hover:text-cream transition-colors duration-300"
          >
            Hosting an event? Create yours →
          </a>
          <a
            href="/host/login"
            className="text-cream/40 hover:text-cream/80 transition-colors duration-300 text-sm"
          >
            Already a host? Sign in
          </a>
        </div>

        {/* Social Proof */}
        <div className="mt-16 text-center">
          <p className="text-cream/30 text-sm">
            Trusted at exclusive events worldwide
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 text-cream/20 text-xs tracking-wider">
        MATCHMAKER
      </footer>
    </div>
  );
}
