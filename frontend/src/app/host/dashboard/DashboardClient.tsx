"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { ToastContainer, useToast } from "@/components/Toast";
import { API_BASE_URL } from "@/lib/api";

interface Event {
    id: string;
    code: string;
    name: string;
    host_name: string | null;
    created_at: string;
    matching_completed: boolean;
    matches_revealed: boolean;
}

interface Guest {
    id: string;
    nickname: string;
    joined_at: string;
    has_responses: boolean;
}

interface Match {
    id: string;
    guest_a_id: string;
    guest_b_id: string;
    guest_a_nickname: string;
    guest_b_nickname: string;
    score: number;
}

export default function HostDashboardClient({ user }: { user: User }) {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [guests, setGuests] = useState<Guest[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const router = useRouter();
    const supabase = createClient();
    const { toasts, dismissToast, showSuccess, showError } = useToast();

    // Edit modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editName, setEditName] = useState("");
    const [editHostName, setEditHostName] = useState("");

    // Delete confirmation state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");

    // Fetch host's events
    useEffect(() => {
        fetchEvents();
    }, []);

    // Auto-refresh guests every 10 seconds when event is selected
    useEffect(() => {
        if (!selectedEvent) return;

        const interval = setInterval(() => {
            refreshEventDetails(selectedEvent);
        }, 10000);

        return () => clearInterval(interval);
    }, [selectedEvent?.id]);

    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/events/my-events`, {
                headers: {
                    "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setEvents(data);
            } else {
                showError("Failed to load events");
            }
        } catch (error) {
            console.error("Failed to fetch events:", error);
            showError("Connection error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const refreshEventDetails = useCallback(async (event: Event) => {
        // Silent refresh - no loading state
        try {
            const guestsRes = await fetch(`${API_BASE_URL}/events/${event.code}/guests`);
            if (guestsRes.ok) {
                const guestsData = await guestsRes.json();
                setGuests(guestsData);
            }

            if (event.matching_completed) {
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const matchesRes = await fetch(`${API_BASE_URL}/events/${event.code}/matches`, {
                    headers: { "Authorization": `Bearer ${token}` },
                });
                if (matchesRes.ok) {
                    const matchesData = await matchesRes.json();
                    setMatches(matchesData);
                }
            }
        } catch (error) {
            console.error("Failed to refresh event details:", error);
        }
    }, [supabase.auth]);

    const fetchEventDetails = async (event: Event) => {
        setSelectedEvent(event);
        setGuests([]);
        setMatches([]);

        try {
            const guestsRes = await fetch(`${API_BASE_URL}/events/${event.code}/guests`);
            if (guestsRes.ok) {
                const guestsData = await guestsRes.json();
                setGuests(guestsData);
            }

            if (event.matching_completed) {
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const matchesRes = await fetch(`${API_BASE_URL}/events/${event.code}/matches`, {
                    headers: { "Authorization": `Bearer ${token}` },
                });
                if (matchesRes.ok) {
                    const matchesData = await matchesRes.json();
                    setMatches(matchesData);
                }
            }
        } catch (error) {
            console.error("Failed to fetch event details:", error);
            showError("Failed to load event details");
        }
    };

    const handleStartMatching = async () => {
        if (!selectedEvent) return;
        setActionLoading("matching");

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const response = await fetch(`${API_BASE_URL}/events/${selectedEvent.code}/match`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
            });

            if (response.ok) {
                const updatedEvent = { ...selectedEvent, matching_completed: true };
                setSelectedEvent(updatedEvent);
                setEvents(events.map(e => e.id === updatedEvent.id ? updatedEvent : e));
                fetchEventDetails(updatedEvent);
                showSuccess("Matching complete! 🎉");
            } else {
                const data = await response.json();
                showError(data.detail || "Failed to run matching");
            }
        } catch (error) {
            console.error("Failed to start matching:", error);
            showError("Connection error. Please try again.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevealMatches = async () => {
        if (!selectedEvent) return;
        setActionLoading("revealing");

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const response = await fetch(`${API_BASE_URL}/events/${selectedEvent.code}/reveal`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
            });

            if (response.ok) {
                const updatedEvent = { ...selectedEvent, matches_revealed: true };
                setSelectedEvent(updatedEvent);
                setEvents(events.map(e => e.id === updatedEvent.id ? updatedEvent : e));
                showSuccess("Matches revealed to guests! 👁️");
            } else {
                const data = await response.json();
                showError(data.detail || "Failed to reveal matches");
            }
        } catch (error) {
            console.error("Failed to reveal matches:", error);
            showError("Connection error. Please try again.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleEditEvent = async () => {
        if (!selectedEvent) return;
        setActionLoading("editing");

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const response = await fetch(`${API_BASE_URL}/events/${selectedEvent.code}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: editName || undefined,
                    host_name: editHostName || undefined,
                }),
            });

            if (response.ok) {
                const updatedEvent = {
                    ...selectedEvent,
                    name: editName || selectedEvent.name,
                    host_name: editHostName || selectedEvent.host_name,
                };
                setSelectedEvent(updatedEvent);
                setEvents(events.map(e => e.id === updatedEvent.id ? updatedEvent : e));
                setIsEditModalOpen(false);
                showSuccess("Event updated successfully!");
            } else {
                const data = await response.json();
                showError(data.detail || "Failed to update event");
            }
        } catch (error) {
            console.error("Failed to edit event:", error);
            showError("Connection error. Please try again.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteEvent = async () => {
        if (!selectedEvent || deleteConfirmation !== selectedEvent.code) return;
        setActionLoading("deleting");

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const response = await fetch(`${API_BASE_URL}/events/${selectedEvent.code}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` },
            });

            if (response.ok) {
                setEvents(events.filter(e => e.id !== selectedEvent.id));
                setSelectedEvent(null);
                setGuests([]);
                setMatches([]);
                setIsDeleteModalOpen(false);
                setDeleteConfirmation("");
                showSuccess("Event deleted successfully");
            } else {
                const data = await response.json();
                showError(data.detail || "Failed to delete event");
            }
        } catch (error) {
            console.error("Failed to delete event:", error);
            showError("Connection error. Please try again.");
        } finally {
            setActionLoading(null);
        }
    };

    const openEditModal = () => {
        if (selectedEvent) {
            setEditName(selectedEvent.name);
            setEditHostName(selectedEvent.host_name || "");
            setIsEditModalOpen(true);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    const copyCode = () => {
        if (selectedEvent) {
            navigator.clipboard.writeText(selectedEvent.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            showSuccess("Event code copied!");
        }
    };

    return (
        <div className="min-h-screen gradient-bg p-6 relative overflow-hidden">
            {/* Toast notifications */}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            {/* Decorative orbs */}
            <div className="party-orb party-orb-1"></div>
            <div className="party-orb party-orb-2"></div>

            <main className="relative z-10 max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                            Host Dashboard
                        </h1>
                        <p className="text-purple-300/60 text-sm mt-1">{user.email}</p>
                    </div>
                    <div className="flex gap-3">
                        <a href="/host" className="btn-secondary">
                            + New Event
                        </a>
                        <button onClick={handleLogout} className="btn-secondary">
                            Logout
                        </button>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* Events List */}
                    <div className="card">
                        <h2 className="text-xl font-semibold text-white mb-4">My Events</h2>
                        {isLoading ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                                ))}
                            </div>
                        ) : events.length === 0 ? (
                            <p className="text-purple-300/60">No events yet. Create one!</p>
                        ) : (
                            <div className="space-y-2">
                                {events.map((event) => (
                                    <button
                                        key={event.id}
                                        onClick={() => fetchEventDetails(event)}
                                        className={`w-full text-left p-3 rounded-xl transition-all ${selectedEvent?.id === event.id
                                            ? "glass-light border border-purple-500/30"
                                            : "hover:bg-white/5"
                                            }`}
                                    >
                                        <p className="text-white font-medium">{event.name}</p>
                                        <p className="text-purple-300/50 text-xs">{event.code}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Event Details */}
                    {selectedEvent && (
                        <div className="md:col-span-2 space-y-6">
                            {/* Event Info */}
                            <div className="card">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">{selectedEvent.name}</h2>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-3xl font-mono text-purple-300 tracking-widest">
                                                {selectedEvent.code}
                                            </span>
                                            <button
                                                onClick={copyCode}
                                                className="text-purple-400 hover:text-purple-300 text-sm"
                                            >
                                                {copied ? "✓ Copied" : "📋 Copy"}
                                            </button>
                                        </div>
                                        {selectedEvent.host_name && (
                                            <p className="text-purple-300/50 text-sm mt-1">
                                                Hosted by {selectedEvent.host_name}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2 items-end">
                                        {selectedEvent.matching_completed ? (
                                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                                                ✓ Matching Done
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                                                Awaiting Matching
                                            </span>
                                        )}
                                        {selectedEvent.matches_revealed && (
                                            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded">
                                                ✓ Revealed
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Edit/Delete buttons */}
                                <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                                    <button
                                        onClick={openEditModal}
                                        className="text-sm px-3 py-1.5 rounded-lg bg-white/5 text-purple-300 hover:bg-white/10 transition-colors"
                                    >
                                        ✏️ Edit
                                    </button>
                                    <button
                                        onClick={() => setIsDeleteModalOpen(true)}
                                        className="text-sm px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                    >
                                        🗑️ Delete
                                    </button>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="card">
                                <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={handleStartMatching}
                                        disabled={selectedEvent.matching_completed || actionLoading === "matching"}
                                        className="btn-primary disabled:opacity-50"
                                    >
                                        {actionLoading === "matching" ? "Running..." : "🎯 Start Matching"}
                                    </button>
                                    <button
                                        onClick={handleRevealMatches}
                                        disabled={!selectedEvent.matching_completed || selectedEvent.matches_revealed || actionLoading === "revealing"}
                                        className="btn-secondary disabled:opacity-50"
                                    >
                                        {actionLoading === "revealing" ? "Revealing..." : "👁️ Reveal Matches"}
                                    </button>
                                </div>
                            </div>

                            {/* Guests */}
                            <div className="card">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-white">
                                        Guests ({guests.length})
                                    </h3>
                                    <span className="text-xs text-purple-300/50">
                                        Auto-refreshes every 10s
                                    </span>
                                </div>
                                {guests.length === 0 ? (
                                    <p className="text-purple-300/60">No guests yet. Share the code!</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {guests.map((guest) => (
                                            <div
                                                key={guest.id}
                                                className="p-3 glass-light rounded-lg flex items-center gap-2"
                                            >
                                                <span className="text-white">{guest.nickname}</span>
                                                {guest.has_responses && (
                                                    <span className="text-xs text-green-400" title="Completed survey">✓</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Matches */}
                            {selectedEvent.matching_completed && matches.length > 0 && (
                                <div className="card">
                                    <h3 className="text-lg font-semibold text-white mb-4">
                                        Matches ({matches.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {matches.map((match) => (
                                            <div
                                                key={match.id}
                                                className="p-4 glass-light rounded-xl flex justify-between items-center"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-white font-medium">
                                                        {match.guest_a_nickname}
                                                    </span>
                                                    <span className="text-pink-400">💕</span>
                                                    <span className="text-white font-medium">
                                                        {match.guest_b_nickname}
                                                    </span>
                                                </div>
                                                <span className="text-purple-300/60 text-sm">
                                                    {Math.round(match.score * 100)}% match
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="card max-w-md w-full">
                        <h2 className="text-xl font-semibold text-white mb-4">Edit Event</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-purple-300/60 text-sm mb-1">Event Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="input-field"
                                    placeholder="Event name"
                                />
                            </div>
                            <div>
                                <label className="block text-purple-300/60 text-sm mb-1">Host Name</label>
                                <input
                                    type="text"
                                    value={editHostName}
                                    onChange={(e) => setEditHostName(e.target.value)}
                                    className="input-field"
                                    placeholder="Your name (optional)"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditEvent}
                                disabled={actionLoading === "editing"}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {actionLoading === "editing" ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && selectedEvent && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="card max-w-md w-full">
                        <h2 className="text-xl font-semibold text-red-400 mb-2">Delete Event</h2>
                        <p className="text-purple-300/60 mb-4">
                            This will permanently delete <strong className="text-white">{selectedEvent.name}</strong> and all associated guests, responses, and matches.
                        </p>
                        <div>
                            <label className="block text-purple-300/60 text-sm mb-1">
                                Type the event code <strong className="text-white">{selectedEvent.code}</strong> to confirm
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmation}
                                onChange={(e) => setDeleteConfirmation(e.target.value.toUpperCase())}
                                className="input-field"
                                placeholder="Enter event code"
                            />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setIsDeleteModalOpen(false);
                                    setDeleteConfirmation("");
                                }}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteEvent}
                                disabled={deleteConfirmation !== selectedEvent.code || actionLoading === "deleting"}
                                className="flex-1 py-3 px-6 rounded-xl font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {actionLoading === "deleting" ? "Deleting..." : "Delete Event"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
