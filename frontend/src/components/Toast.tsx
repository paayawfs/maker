"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastProps {
    message: ToastMessage;
    onDismiss: (id: string) => void;
}

function Toast({ message, onDismiss }: ToastProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));

        // Auto-dismiss after 5 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onDismiss(message.id), 300);
        }, 5000);

        return () => clearTimeout(timer);
    }, [message.id, onDismiss]);

    const bgColor = {
        success: "bg-green-500/20 border-green-500/50",
        error: "bg-red-500/20 border-red-500/50",
        info: "bg-blue-500/20 border-blue-500/50",
    }[message.type];

    const textColor = {
        success: "text-green-400",
        error: "text-red-400",
        info: "text-blue-400",
    }[message.type];

    const icon = {
        success: "✓",
        error: "✕",
        info: "ℹ",
    }[message.type];

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg transition-all duration-300 ${bgColor} ${isVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
                }`}
        >
            <span className={`text-lg ${textColor}`}>{icon}</span>
            <p className="text-cream text-sm">{message.message}</p>
            <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(() => onDismiss(message.id), 300);
                }}
                className="ml-2 text-cream/50 hover:text-cream transition-colors"
            >
                ✕
            </button>
        </div>
    );
}

interface ToastContainerProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
                <Toast key={toast.id} message={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

// Hook for managing toasts
export function useToast() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = (type: ToastType, message: string) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts((prev) => [...prev, { id, type, message }]);
    };

    const dismissToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const showSuccess = (message: string) => addToast("success", message);
    const showError = (message: string) => addToast("error", message);
    const showInfo = (message: string) => addToast("info", message);

    return {
        toasts,
        dismissToast,
        showSuccess,
        showError,
        showInfo,
    };
}
