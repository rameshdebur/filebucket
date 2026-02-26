"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface FileItem {
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    downloadUrl: string;
}

function useCountdown(expiresAt: Date | null) {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

    useEffect(() => {
        if (!expiresAt) return;

        const tick = () => {
            const diff = expiresAt.getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
                return;
            }
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft({ days, hours, minutes, seconds, expired: false });
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    return timeLeft;
}

export default function BucketPage() {
    const { id } = useParams();
    const router = useRouter();

    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [closing, setClosing] = useState(false);
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);

    const countdown = useCountdown(expiresAt);

    useEffect(() => {
        fetchFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchFiles = async () => {
        try {
            const res = await fetch(`/api/buckets/${id}/files`);
            if (!res.ok) throw new Error("Bucket not found or expired");
            const data = await res.json();
            setFiles(data.files);
            if (data.expiresAt) setExpiresAt(new Date(data.expiresAt));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An unknown error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadAll = async () => {
        for (const file of files) window.open(file.downloadUrl, "_blank");
    };

    const handleCloseBucket = async () => {
        if (!confirm("Are you sure? This will permanently delete the bucket and all files from our servers.")) return;
        setClosing(true);
        try {
            const res = await fetch(`/api/buckets/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to close bucket");
            router.push("/");
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : "An unknown error occurred");
            setClosing(false);
        }
    };

    if (loading) {
        return <div className="container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}><div className="spinner"></div></div>;
    }

    if (error) {
        return (
            <div className="container" style={{ textAlign: "center", paddingTop: "10vh" }}>
                <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }} className="text-gradient">Access Denied</h1>
                <p style={{ color: "var(--accent-pink)", fontSize: "1.2rem", marginBottom: "2rem" }}>{error}</p>
                <button className="btn btn-primary" onClick={() => router.push("/")}>Return Home</button>
            </div>
        );
    }

    const pad = (n: number) => String(n).padStart(2, "0");

    return (
        <main className="container animate-fade-in" style={{ maxWidth: "800px" }}>

            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", marginTop: "2rem" }}>
                <h1 style={{ fontSize: "2rem", margin: 0 }} className="text-gradient">Secure <span className="text-gradient-accent">Drop</span></h1>
                <button className="btn btn-secondary" onClick={() => router.push("/")}>Leave</button>
            </header>

            {expiresAt && (
                <div style={{
                    background: "rgba(236, 72, 153, 0.07)",
                    border: "1px solid rgba(236, 72, 153, 0.35)",
                    borderRadius: "var(--radius-md)",
                    padding: "1.25rem 1.5rem",
                    marginBottom: "2rem",
                }}>
                    {/* Label */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                        <svg style={{ color: "var(--accent-pink)", width: "18px", height: "18px", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span style={{ fontWeight: 700, color: "var(--accent-pink)", fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            Auto-Shred Timer Active
                        </span>
                    </div>

                    {/* Big countdown */}
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
                        {[
                            { value: countdown.days, label: "DAYS" },
                            { value: countdown.hours, label: "HRS" },
                            { value: countdown.minutes, label: "MIN" },
                            { value: countdown.seconds, label: "SEC" },
                        ].map(({ value, label }, i) => (
                            <div key={label} style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem" }}>
                                {i > 0 && (
                                    <span style={{
                                        fontSize: "2rem",
                                        fontWeight: 800,
                                        color: "rgba(236,72,153,0.4)",
                                        lineHeight: 1,
                                        paddingBottom: "1.4rem",
                                    }}>:</span>
                                )}
                                <div style={{ textAlign: "center" }}>
                                    <div style={{
                                        fontSize: "2.6rem",
                                        fontWeight: 800,
                                        color: countdown.expired ? "#666" : "var(--accent-pink)",
                                        lineHeight: 1,
                                        fontVariantNumeric: "tabular-nums",
                                        textShadow: countdown.expired ? "none" : "0 0 24px rgba(236,72,153,0.5)",
                                        letterSpacing: "-0.02em",
                                    }}>
                                        {pad(value)}
                                    </div>
                                    <div style={{
                                        fontSize: "0.65rem",
                                        fontWeight: 700,
                                        color: "rgba(236,72,153,0.5)",
                                        letterSpacing: "0.12em",
                                        marginTop: "0.3rem",
                                    }}>
                                        {label}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Subtle details line */}
                    <p style={{ margin: "0.75rem 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        Files permanently destroyed on {expiresAt.toLocaleDateString()} at {expiresAt.toLocaleTimeString()}
                    </p>
                </div>
            )}

            <section className="glass-panel" style={{ padding: "3rem", marginBottom: "2rem" }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2rem" }}>
                    <h2 style={{ fontSize: "1.5rem", margin: 0 }}>Unlocked Files</h2>
                    <span style={{ color: "var(--text-secondary)" }}>{files.length} items</span>
                </div>

                {files.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
                        This drop is empty.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {files.map(file => (
                            <div key={file.id} className="file-item" style={{ background: "rgba(0,0,0,0.2)" }}>
                                <div className="file-info">
                                    <span className="file-name">{file.filename}</span>
                                    <span className="file-meta">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB • {file.mimeType}
                                    </span>
                                </div>
                                <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                                    Download
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={handleDownloadAll} disabled={files.length === 0}>
                    Download All
                </button>
                <button className="btn" style={{ background: "rgba(236, 72, 153, 0.1)", color: "var(--accent-pink)", border: "1px solid rgba(236, 72, 153, 0.3)" }} onClick={handleCloseBucket} disabled={closing}>
                    {closing ? "Destroying..." : "Close & Destroy Drop"}
                </button>
            </div>

        </main>
    );
}
