"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ToastContainer, useToast } from "@/components/Toast";
import { API_BASE_URL } from "@/lib/api";

interface Event {
    code: string;
    name: string;
    host_name: string | null;
    matching_mode?: string;
}

interface Question {
    id: string;
    text: string;
    question_type: string;
    options: string[] | null;
    order_index: number;
}

interface Match {
    id: string;
    nickname: string;
    score: number;
}

export default function EventPage() {
    const params = useParams();
    const router = useRouter();
    const code = params.code as string;
    const { toasts, dismissToast, showError, showSuccess, showInfo } = useToast();

    const [event, setEvent] = useState<Event | null>(null);
    const [nickname, setNickname] = useState("");
    const [gender, setGender] = useState("");
    const [lookingFor, setLookingFor] = useState("");
    const [isJoined, setIsJoined] = useState(false);
    const [guestId, setGuestId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [currentStep, setCurrentStep] = useState<"join" | "survey" | "waiting" | "matched">("join");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [match, setMatch] = useState<Match | null>(null);
    const [isPolling, setIsPolling] = useState(false);

    // Fetch event details
    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/events/${code}`);
                if (response.ok) {
                    const data = await response.json();
                    setEvent(data);
                } else {
                    router.push("/");
                }
            } catch {
                router.push("/");
            } finally {
                setIsLoading(false);
            }
        };
        fetchEvent();
    }, [code, router]);

    // Fetch questions after joining
    useEffect(() => {
        if (isJoined) {
            const fetchQuestions = async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/events/${code}/questions`);
                    if (response.ok) {
                        const data = await response.json();
                        setQuestions(data);
                    }
                } catch (err) {
                    console.error("Failed to fetch questions:", err);
                    showError("Failed to load questions");
                }
            };
            fetchQuestions();
        }
    }, [isJoined, code]);

    // Check for match function
    const checkForMatch = useCallback(async () => {
        if (!guestId) return false;

        try {
            const res = await fetch(`${API_BASE_URL}/events/${code}/my-match/${guestId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.match) {
                    setMatch(data.match);
                    setCurrentStep("matched");
                    showSuccess("Your match has been revealed! 💕");
                    return true;
                }
            }
        } catch {
            console.error("Failed to check for match");
        }
        return false;
    }, [guestId, code, showSuccess]);

    // Auto-polling for match status in waiting step (every 15 seconds)
    useEffect(() => {
        if (currentStep !== "waiting" || !guestId) return;

        setIsPolling(true);
        const pollInterval = setInterval(async () => {
            const found = await checkForMatch();
            if (found) {
                clearInterval(pollInterval);
                setIsPolling(false);
            }
        }, 15000);

        return () => {
            clearInterval(pollInterval);
            setIsPolling(false);
        };
    }, [currentStep, guestId, checkForMatch]);

    // Clear error after 5 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(""), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname.trim()) {
            setError("Please enter a nickname");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const joinData: Record<string, string> = { nickname: nickname.trim() };
            if (gender) joinData.gender = gender;
            if (lookingFor) joinData.looking_for = lookingFor;

            const response = await fetch(`${API_BASE_URL}/events/${code}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(joinData),
            });

            if (response.ok) {
                const data = await response.json();
                setGuestId(data.id);
                setIsJoined(true);
                setCurrentStep("survey");
                showSuccess(`Welcome, ${nickname}! 🎉`);
            } else if (response.status === 409) {
                setError("Nickname already taken. Try another one!");
            } else {
                setError("Failed to join. Please try again.");
            }
        } catch {
            setError("Connection error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerChange = (questionId: string, value: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    };

    const handleSubmitSurvey = async () => {
        if (!guestId) return;

        // Validate all questions are answered
        const unanswered = questions.filter(q => !answers[q.id]);
        if (unanswered.length > 0) {
            setError(`Please answer all questions (${unanswered.length} remaining)`);
            return;
        }

        setIsLoading(true);

        try {
            // Format answers for API
            const answersPayload = Object.entries(answers).map(([questionId, answer]) => ({
                question_id: questionId,
                answer: answer,
            }));

            const response = await fetch(`${API_BASE_URL}/events/${code}/responses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guest_id: guestId,
                    answers: answersPayload,
                }),
            });

            if (response.ok) {
                setCurrentStep("waiting");
                showInfo("Answers submitted! Waiting for the host to reveal matches...");
            } else {
                setError("Failed to submit answers. Try again.");
            }
        } catch {
            setError("Connection error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualCheck = async () => {
        setIsLoading(true);
        setError("");

        try {
            const res = await fetch(`${API_BASE_URL}/events/${code}/my-match/${guestId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.match) {
                    setMatch(data.match);
                    setCurrentStep("matched");
                    showSuccess("Your match has been revealed! 💕");
                } else {
                    showInfo("No match found yet. Keep waiting!");
                }
            } else if (res.status === 403) {
                showInfo("Matches not revealed yet. Wait for the host!");
            } else {
                showError("Failed to check for match");
            }
        } catch {
            setError("Connection error.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !event) {
        return (
            <div className="min-h-screen gradient-bg flex items-center justify-center">
                <div className="animate-spin h-12 w-12 border-4 border-terracotta border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Toast notifications */}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            {/* Decorative orbs */}
            <div className="luxury-orb luxury-orb-1"></div>
            <div className="luxury-orb luxury-orb-2"></div>

            <main className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">
                {/* Event header */}
                <div className="mb-8">
                    <span className="text-sand/60 text-sm uppercase tracking-widest">
                        Event Code: {code}
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold mt-2 text-cream font-display">
                        {event?.name}
                    </h1>
                    {event?.host_name && (
                        <p className="text-cream/50 mt-2">Hosted by {event.host_name}</p>
                    )}
                </div>

                {/* Join Step */}
                {currentStep === "join" && (
                    <div className="card w-full max-w-md">
                        <div className="mb-6">
                            <h2 className="text-2xl font-semibold text-cream mb-2 font-display">
                                Your Perfect Conversation Awaits
                            </h2>
                            <p className="text-cream/50">
                                Choose a nickname to join
                            </p>
                        </div>

                        <form onSubmit={handleJoin} className="space-y-4">
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="Your nickname"
                                maxLength={20}
                                className="input-field text-center text-xl"
                                autoComplete="off"
                            />

                            {/* Gender Selector */}
                            <div className="text-left">
                                <label className="block text-sand mb-2 font-medium text-sm">
                                    I am...
                                </label>
                                <div className="flex gap-2">
                                    {[
                                        { value: "male", label: "👨 Male" },
                                        { value: "female", label: "👩 Female" },
                                        { value: "other", label: "✨ Other" },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setGender(option.value)}
                                            className={`flex-1 py-2 px-3 rounded-xl text-sm transition-all ${gender === option.value
                                                ? "bg-terracotta/20 border border-terracotta text-cream"
                                                : "glass-light text-cream/60 hover:border-sand/40 border border-transparent"
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <p className="text-pink-400 text-sm animate-pulse">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-primary w-full text-lg disabled:opacity-50"
                            >
                                {isLoading ? "Finding your match..." : "Continue"}
                            </button>
                        </form>
                    </div>
                )
                }

                {/* Survey Step */}
                {
                    currentStep === "survey" && (
                        <div className="card w-full max-w-md">
                            <div className="mb-6">
                                <h2 className="text-2xl font-semibold text-cream mb-2 font-display">
                                    Hey, {nickname}!
                                </h2>
                                <p className="text-cream/50">
                                    {questions.length > 0
                                        ? "Answer these questions to find your matches"
                                        : "No questions yet. The host will add them soon!"}
                                </p>
                            </div>

                            {questions.length > 0 ? (
                                <div className="space-y-6">
                                    {questions.map((question, index) => (
                                        <div key={question.id} className="text-left">
                                            <label className="block text-purple-200 mb-3 font-medium">
                                                {index + 1}. {question.text}
                                            </label>
                                            {question.options ? (
                                                <div className="space-y-2">
                                                    {question.options.map((option) => (
                                                        <label
                                                            key={option}
                                                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${answers[question.id] === option
                                                                ? "bg-purple-500/30 border border-purple-500"
                                                                : "bg-purple-900/20 border border-transparent hover:border-purple-500/30"
                                                                }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name={question.id}
                                                                value={option}
                                                                checked={answers[question.id] === option}
                                                                onChange={(e) =>
                                                                    handleAnswerChange(question.id, e.target.value)
                                                                }
                                                                className="accent-purple-500"
                                                            />
                                                            <span className="text-white">{option}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={answers[question.id] || ""}
                                                    onChange={(e) =>
                                                        handleAnswerChange(question.id, e.target.value)
                                                    }
                                                    className="input-field"
                                                    placeholder="Your answer..."
                                                />
                                            )}
                                        </div>
                                    ))}

                                    {error && (
                                        <p className="text-pink-400 text-sm animate-pulse">{error}</p>
                                    )}

                                    <button
                                        onClick={handleSubmitSurvey}
                                        disabled={isLoading}
                                        className="btn-primary w-full text-lg mt-6 disabled:opacity-50"
                                    >
                                        {isLoading ? "Submitting..." : "Find My Matches 💕"}
                                    </button>
                                </div>
                            ) : (
                                <div className="py-8">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center text-3xl animate-float">
                                        ⏳
                                    </div>
                                    <p className="text-purple-300/60">
                                        Check back soon or ask the host!
                                    </p>
                                </div>
                            )}
                        </div>
                    )
                }

                {/* Waiting Step */}
                {
                    currentStep === "waiting" && (
                        <div className="card w-full max-w-md py-12">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-full gradient-accent flex items-center justify-center text-4xl animate-pulse-glow">
                                ⏳
                            </div>
                            <h2 className="text-2xl font-semibold text-white mb-2">
                                Waiting for Results...
                            </h2>
                            <p className="text-purple-300/60 mb-2">
                                Your answers are in! The host will reveal matches soon.
                            </p>
                            {isPolling && (
                                <p className="text-purple-400/50 text-xs mb-4">
                                    Auto-checking every 15 seconds...
                                </p>
                            )}

                            <button
                                onClick={handleManualCheck}
                                disabled={isLoading}
                                className="btn-primary mt-6 disabled:opacity-50"
                            >
                                {isLoading ? "Checking..." : "Check for My Match 🔮"}
                            </button>
                            {error && <p className="text-pink-400 text-sm mt-4">{error}</p>}
                        </div>
                    )
                }

                {/* Matched Step */}
                {
                    currentStep === "matched" && match && (
                        <div className="card w-full max-w-md py-12">
                            <div className="w-24 h-24 mx-auto mb-6 rounded-full gradient-accent flex items-center justify-center text-5xl animate-bounce">
                                💕
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">
                                It&apos;s a Match!
                            </h2>
                            <p className="text-purple-300/60 mb-6">
                                You matched with:
                            </p>
                            <div className="p-6 glass-light rounded-2xl">
                                <p className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                                    {match.nickname}
                                </p>
                                <p className="text-purple-300/60 mt-2">
                                    {Math.round(match.score * 100)}% compatibility
                                </p>
                            </div>
                            <p className="text-purple-300/40 text-sm mt-6">
                                Go find them and say hi! 👋
                            </p>
                        </div>
                    )
                }

                {/* Back to home */}
                <a
                    href="/"
                    className="mt-8 text-purple-400/60 hover:text-purple-300 transition-colors text-sm"
                >
                    ← Back to home
                </a>
            </main >
        </div >
    );
}
