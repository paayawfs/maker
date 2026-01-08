"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { ToastContainer, useToast } from "@/components/Toast";

interface Event {
    id: string;
    code: string;
    name: string;
    host_name: string | null;
    created_at: string;
}

interface Question {
    id: string;
    text: string;
    question_type: string;
    options: string[] | null;
    order_index: number;
}

export default function HostPage() {
    const [step, setStep] = useState<"create" | "manage">("create");
    const [eventName, setEventName] = useState("");
    const [hostName, setHostName] = useState("");
    const [matchingMode, setMatchingMode] = useState("any");
    const [matchesPerGuest, setMatchesPerGuest] = useState(1);
    const [eventType, setEventType] = useState("party");
    const [event, setEvent] = useState<Event | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [newQuestion, setNewQuestion] = useState("");
    const [options, setOptions] = useState<string[]>(["", "", "", ""]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const supabase = createClient();
    const router = useRouter();
    const { toasts, dismissToast, showSuccess, showError } = useToast();

    // Edit question modal state
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [editQuestionText, setEditQuestionText] = useState("");
    const [editQuestionOptions, setEditQuestionOptions] = useState<string[]>(["", "", "", ""]);

    // Delete question modal state
    const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        // Check if user is logged in
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            setAuthLoading(false);
        });
    }, []);

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventName.trim()) {
            setError("Please enter an event name");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            // Get auth token if logged in
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (user) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    headers["Authorization"] = `Bearer ${session.access_token}`;
                }
            }

            const response = await fetch("http://localhost:8000/events", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    name: eventName.trim(),
                    host_name: hostName.trim() || null,
                    matching_mode: matchingMode,
                    matches_per_guest: matchesPerGuest,
                    event_type: eventType,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setEvent(data);
                setStep("manage");
                showSuccess("Event created! 🎉");
            } else {
                setError("Failed to create event. Please try again.");
            }
        } catch {
            setError("Connection error. Is the backend running?");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddQuestion = async () => {
        if (!newQuestion.trim() || !event) return;

        const validOptions = options.filter((o) => o.trim());

        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8000/events/${event.code}/questions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: newQuestion.trim(),
                    question_type: validOptions.length > 0 ? "multiple_choice" : "text",
                    options: validOptions.length > 0 ? validOptions : null,
                    order_index: questions.length,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setQuestions([...questions, data]);
                setNewQuestion("");
                setOptions(["", "", "", ""]);
                showSuccess("Question added!");
            } else {
                showError("Failed to add question");
            }
        } catch (err) {
            console.error("Failed to add question:", err);
            showError("Connection error");
        } finally {
            setIsLoading(false);
        }
    };

    const openEditModal = (question: Question) => {
        setEditingQuestion(question);
        setEditQuestionText(question.text);
        const currentOptions = question.options || [];
        setEditQuestionOptions([
            currentOptions[0] || "",
            currentOptions[1] || "",
            currentOptions[2] || "",
            currentOptions[3] || "",
        ]);
    };

    const handleEditQuestion = async () => {
        if (!editingQuestion || !event) return;

        setActionLoading("editing");
        const validOptions = editQuestionOptions.filter((o) => o.trim());

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const response = await fetch(
                `http://localhost:8000/events/${event.code}/questions/${editingQuestion.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        text: editQuestionText.trim() || undefined,
                        options: validOptions.length > 0 ? validOptions : undefined,
                    }),
                }
            );

            if (response.ok) {
                const updatedQuestion = await response.json();
                setQuestions(questions.map(q =>
                    q.id === editingQuestion.id ? updatedQuestion : q
                ));
                setEditingQuestion(null);
                showSuccess("Question updated!");
            } else {
                const data = await response.json();
                showError(data.detail || "Failed to update question");
            }
        } catch (err) {
            console.error("Failed to edit question:", err);
            showError("Connection error");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteQuestion = async () => {
        if (!deletingQuestion || !event) return;

        setActionLoading("deleting");

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const response = await fetch(
                `http://localhost:8000/events/${event.code}/questions/${deletingQuestion.id}`,
                {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${token}` },
                }
            );

            if (response.ok) {
                setQuestions(questions.filter(q => q.id !== deletingQuestion.id));
                setDeletingQuestion(null);
                showSuccess("Question deleted");
            } else {
                const data = await response.json();
                showError(data.detail || "Failed to delete question");
            }
        } catch (err) {
            console.error("Failed to delete question:", err);
            showError("Connection error");
        } finally {
            setActionLoading(null);
        }
    };

    const copyToClipboard = () => {
        if (event) {
            navigator.clipboard.writeText(event.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            showSuccess("Code copied!");
        }
    };

    return (
        <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Toast notifications */}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            {/* Decorative orbs */}
            <div className="luxury-orb luxury-orb-1"></div>
            <div className="luxury-orb luxury-orb-2"></div>

            <main className="relative z-10 flex flex-col items-center text-center max-w-2xl w-full">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold mb-2 text-gradient font-display">
                        {step === "create" ? "Create Event" : "Event Dashboard"}
                    </h1>
                    <p className="text-cream/60">
                        {step === "create"
                            ? "Set up your exclusive matchmaking event"
                            : "Manage your event and add questions"}
                    </p>
                </div>

                {/* Create Event Step */}
                {step === "create" && (
                    <div className="card w-full max-w-md">
                        {/* Show loading while checking auth */}
                        {authLoading ? (
                            <div className="py-12 flex justify-center">
                                <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                            </div>
                        ) : !user ? (
                            <div className="py-8 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-terracotta/20 border border-terracotta/40 flex items-center justify-center text-3xl">
                                    🔐
                                </div>
                                <h2 className="text-xl font-semibold text-cream mb-2 font-display">
                                    Sign In Required
                                </h2>
                                <p className="text-cream/50 mb-6">
                                    You need to sign in to create and manage events
                                </p>
                                <a href="/host/login" className="btn-primary inline-block">
                                    Sign In with Email
                                </a>
                            </div>
                        ) : (
                            <form onSubmit={handleCreateEvent} className="space-y-4">
                                <div className="text-left">
                                    <label className="block text-purple-200 mb-2 font-medium">
                                        Event Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={eventName}
                                        onChange={(e) => setEventName(e.target.value)}
                                        placeholder="e.g., Summer Beach Party"
                                        className="input-field"
                                    />
                                </div>

                                <div className="text-left">
                                    <label className="block text-purple-200 mb-2 font-medium">
                                        Your Name (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={hostName}
                                        onChange={(e) => setHostName(e.target.value)}
                                        placeholder="e.g., DJ Mike"
                                        className="input-field"
                                    />
                                </div>

                                {/* Event Type */}
                                <div className="text-left">
                                    <label className="block text-purple-200 mb-2 font-medium">
                                        Event Type
                                    </label>
                                    <div className="flex gap-2">
                                        {["party", "networking"].map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setEventType(type)}
                                                className={`flex-1 py-2 px-4 rounded-xl capitalize transition-all ${eventType === type
                                                    ? "bg-purple-500/30 border border-purple-500 text-white"
                                                    : "glass-light text-purple-300/60 hover:border-purple-500/30 border border-transparent"
                                                    }`}
                                            >
                                                {type === "party" ? "🎉 Party" : "🤝 Networking"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Matching Mode */}
                                <div className="text-left">
                                    <label className="block text-purple-200 mb-2 font-medium">
                                        Matching Mode
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setMatchingMode("any")}
                                            className={`flex-1 py-2 px-4 rounded-xl transition-all ${matchingMode === "any"
                                                ? "bg-purple-500/30 border border-purple-500 text-white"
                                                : "glass-light text-purple-300/60 hover:border-purple-500/30 border border-transparent"
                                                }`}
                                        >
                                            🎲 Any Match
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMatchingMode("preference_based")}
                                            className={`flex-1 py-2 px-4 rounded-xl transition-all ${matchingMode === "preference_based"
                                                ? "bg-purple-500/30 border border-purple-500 text-white"
                                                : "glass-light text-purple-300/60 hover:border-purple-500/30 border border-transparent"
                                                }`}
                                        >
                                            💕 Preference-Based
                                        </button>
                                    </div>
                                    <p className="text-purple-300/40 text-xs mt-1">
                                        {matchingMode === "any"
                                            ? "Match anyone based on survey answers"
                                            : "Match based on gender preferences"}
                                    </p>
                                </div>

                                {/* Matches Per Guest */}
                                <div className="text-left">
                                    <label className="block text-purple-200 mb-2 font-medium">
                                        Matches Per Guest: {matchesPerGuest}
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="5"
                                        value={matchesPerGuest}
                                        onChange={(e) => setMatchesPerGuest(Number(e.target.value))}
                                        className="w-full accent-purple-500"
                                    />
                                    <div className="flex justify-between text-purple-300/40 text-xs">
                                        <span>1</span>
                                        <span>5</span>
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
                                    {isLoading ? "Creating..." : "Create Event 🎊"}
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {/* Manage Event Step */}
                {step === "manage" && event && (
                    <div className="w-full space-y-6">
                        {/* Event Code Card */}
                        <div className="card">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="text-left">
                                    <p className="text-purple-300/60 text-sm">Share this code with your guests:</p>
                                    <p className="text-4xl font-bold tracking-widest text-white mt-1">
                                        {event.code}
                                    </p>
                                </div>
                                <button
                                    onClick={copyToClipboard}
                                    className="btn-secondary flex items-center justify-center gap-2"
                                >
                                    {copied ? "✓ Copied!" : "📋 Copy Code"}
                                </button>
                            </div>
                        </div>

                        {/* Add Question Card */}
                        <div className="card">
                            <h3 className="text-xl font-semibold text-white mb-4 text-left">
                                Add Survey Question
                            </h3>

                            <div className="space-y-4">
                                <div className="text-left">
                                    <label className="block text-purple-200 mb-2 font-medium">
                                        Question
                                    </label>
                                    <input
                                        type="text"
                                        value={newQuestion}
                                        onChange={(e) => setNewQuestion(e.target.value)}
                                        placeholder="e.g., What's your favorite music genre?"
                                        className="input-field"
                                    />
                                </div>

                                <div className="text-left">
                                    <label className="block text-purple-200 mb-2 font-medium">
                                        Answer Options (leave empty for free text)
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {options.map((option, index) => (
                                            <input
                                                key={index}
                                                type="text"
                                                value={option}
                                                onChange={(e) => {
                                                    const newOptions = [...options];
                                                    newOptions[index] = e.target.value;
                                                    setOptions(newOptions);
                                                }}
                                                placeholder={`Option ${index + 1}`}
                                                className="input-field text-sm"
                                            />
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleAddQuestion}
                                    disabled={isLoading || !newQuestion.trim()}
                                    className="btn-primary w-full disabled:opacity-50"
                                >
                                    Add Question ➕
                                </button>
                            </div>
                        </div>

                        {/* Questions List */}
                        {questions.length > 0 && (
                            <div className="card">
                                <h3 className="text-xl font-semibold text-white mb-4 text-left">
                                    Questions ({questions.length})
                                </h3>
                                <div className="space-y-3">
                                    {questions.map((q, index) => (
                                        <div
                                            key={q.id}
                                            className="p-4 glass-light rounded-xl text-left"
                                        >
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex-1">
                                                    <p className="text-white font-medium">
                                                        {index + 1}. {q.text}
                                                    </p>
                                                    {q.options && (
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {q.options.map((opt) => (
                                                                <span
                                                                    key={opt}
                                                                    className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded"
                                                                >
                                                                    {opt}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => openEditModal(q)}
                                                        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-purple-300"
                                                        title="Edit question"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingQuestion(q)}
                                                        className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-red-400"
                                                        title="Delete question"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Dashboard link - show when signed in */}
                {user && (
                    <a
                        href="/host/dashboard"
                        className="mt-8 btn-secondary inline-block"
                    >
                        Go to Dashboard →
                    </a>
                )}

                {/* Back to home */}
                <a
                    href="/"
                    className="mt-4 text-sand/60 hover:text-cream transition-colors text-sm"
                >
                    ← Back to home
                </a>
            </main>

            {/* Edit Question Modal */}
            {editingQuestion && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="card max-w-md w-full">
                        <h2 className="text-xl font-semibold text-white mb-4">Edit Question</h2>
                        <div className="space-y-4">
                            <div className="text-left">
                                <label className="block text-purple-300/60 text-sm mb-1">Question Text</label>
                                <input
                                    type="text"
                                    value={editQuestionText}
                                    onChange={(e) => setEditQuestionText(e.target.value)}
                                    className="input-field"
                                    placeholder="Question text"
                                />
                            </div>
                            <div className="text-left">
                                <label className="block text-purple-300/60 text-sm mb-1">Answer Options</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {editQuestionOptions.map((option, index) => (
                                        <input
                                            key={index}
                                            type="text"
                                            value={option}
                                            onChange={(e) => {
                                                const newOptions = [...editQuestionOptions];
                                                newOptions[index] = e.target.value;
                                                setEditQuestionOptions(newOptions);
                                            }}
                                            placeholder={`Option ${index + 1}`}
                                            className="input-field text-sm"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setEditingQuestion(null)}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditQuestion}
                                disabled={actionLoading === "editing"}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {actionLoading === "editing" ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Question Modal */}
            {deletingQuestion && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="card max-w-md w-full">
                        <h2 className="text-xl font-semibold text-red-400 mb-2">Delete Question</h2>
                        <p className="text-purple-300/60 mb-4">
                            Are you sure you want to delete this question?
                        </p>
                        <div className="p-3 glass-light rounded-xl mb-4">
                            <p className="text-white">{deletingQuestion.text}</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingQuestion(null)}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteQuestion}
                                disabled={actionLoading === "deleting"}
                                className="flex-1 py-3 px-6 rounded-xl font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50"
                            >
                                {actionLoading === "deleting" ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
