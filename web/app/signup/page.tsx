"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// API Helper
const API_URL = "http://localhost:8080";

export default function SignupPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch(`${API_URL}/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                // Auto login or redirect to login
                router.push("/login?signup=success");
            } else {
                const data = await res.json();
                setError(data.detail || "Signup failed");
            }
        } catch {
            alert("Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="glass p-8 rounded-2xl w-full max-w-md relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>

                <h1 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-pink-300">
                    Create Account
                </h1>

                <form onSubmit={handleSignup} className="flex flex-col gap-4">
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
                        className="btn-primary w-full shadow-xl mt-4 bg-gradient-to-r from-purple-500 to-pink-500"
                    >
                        {loading ? "Creating..." : "Sign Up"}
                    </button>

                    <p className="text-center text-sm text-gray-400 mt-4">
                        Already have an account? <a href="/login" className="text-indigo-400 hover:text-indigo-300">Login</a>
                    </p>
                </form>
            </div>
        </main>
    );
}
