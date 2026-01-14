"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";

interface Message {
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
}

interface ChatWindowProps {
    matchId: string;
    guestId: string;
    opponentName: string;
}

export default function ChatWindow({ matchId, guestId, opponentName }: ChatWindowProps) {
    const supabase = createClient();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { showError } = useToast();

    // Scroll to bottom on new messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch initial messages and subscribe to new ones
    useEffect(() => {
        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("match_id", matchId)
                .order("created_at", { ascending: true });

            if (error) {
                console.error("Error fetching messages:", error);
                return;
            }
            if (data) setMessages(data);
        };

        fetchMessages();

        // Realtime Subscription
        const channel = supabase
            .channel(`match:${matchId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `match_id=eq.${matchId}`,
                },
                (payload) => {
                    setMessages((prev) => [...prev, payload.new as Message]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [matchId, supabase]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setIsLoading(true);
        try {
            const { error } = await supabase.from("messages").insert({
                match_id: matchId,
                sender_id: guestId,
                content: newMessage.trim(),
            });

            if (error) throw error;
            setNewMessage("");
        } catch (err) {
            console.error("Failed to send message:", err);
            showError("Failed to send message");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden flex flex-col h-[500px]">
            {/* Header */}
            <div className="p-4 bg-white/5 border-b border-white/10">
                <h3 className="text-white font-semibold">Chat with {opponentName}</h3>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center text-white/40 mt-10">
                        <p>Say hello! 👋</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_id === guestId;
                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe
                                            ? "bg-terracotta text-cream rounded-tr-none"
                                            : "bg-white/20 text-white rounded-tl-none"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white/5 border-t border-white/10 flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-white/10 border-none rounded-xl px-4 py-2 text-white placeholder-white/40 focus:ring-1 focus:ring-terracotta outline-none"
                />
                <button
                    type="submit"
                    disabled={isLoading || !newMessage.trim()}
                    className="bg-terracotta hover:bg-terracotta/80 text-white rounded-xl px-4 py-2 transition-colors disabled:opacity-50"
                >
                    Send
                </button>
            </form>
        </div>
    );
}
