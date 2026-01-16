"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// API Helper
const API_URL = "http://localhost:8080";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                const data = await res.json();
                // Store token (in real app, use HTTP-only cookies or context)
                // For project simplicity, we'll pass it back or store in localStorage
                localStorage.setItem("token", data.access_token);
                localStorage.setItem("username", username);
                if (data.is_admin) localStorage.setItem("is_admin", "true");
                router.push("/");
            } else {
                const data = await res.json();
                setError(data.detail || "Login failed");
            }
        } catch (err) {
            setError("Server connection failed: " + err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="glass p-8 rounded-2xl w-full max-w-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>

                <h1 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300">
                    Welcome Back
                </h1>

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    {error && (
                        <div className="p-3 bg-red-500/20 text-red-300 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-4 rounded-xl glass-input"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-4 rounded-xl glass-input"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full shadow-xl mt-4"
                    >
                        {loading ? "Authenticating..." : "Login"}
                    </button>

                    <p className="text-gray-400">Welcome back! Don&apos;t lose control of the mission.</p>
                    <p className="text-center text-sm text-gray-400 mt-4">
                        Don&apos;t have an account? <a href="/signup" className="text-indigo-400 hover:text-indigo-300">Sign Up</a>
                    </p>
                </form>
            </div>
        </main>
    );
}
