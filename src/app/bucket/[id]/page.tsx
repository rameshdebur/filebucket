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

    // Download-to-folder state
    const [downloadProgress, setDownloadProgress] = useState<{
        active: boolean;
        current: number;
        total: number;
        currentName: string;
        done: boolean;
        error: string | null;
    }>({ active: false, current: 0, total: 0, currentName: '', done: false, error: null });

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

    // Fallback for iPad / Android tablets / Firefox / Safari:
    // fetch each file as a blob and trigger download via a hidden <a> tag
    const downloadSequentially = async () => {
        setDownloadProgress({ active: true, current: 0, total: files.length, currentName: '', done: false, error: null });
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setDownloadProgress(p => ({ ...p, current: i + 1, currentName: file.filename }));
            try {
                const res = await fetch(file.downloadUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = file.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                // Small delay so the browser has time to handle each download
                await new Promise(r => setTimeout(r, 600));
                URL.revokeObjectURL(objectUrl);
            } catch (err) {
                setDownloadProgress(p => ({ ...p, error: `Failed to download "${file.filename}": ${err instanceof Error ? err.message : 'Unknown error'}`, done: true }));
                return;
            }
        }
        setDownloadProgress(p => ({ ...p, done: true, currentName: '' }));
    };

    const handleDownloadAll = async () => {
        // Check if File System Access API is supported (Chrome/Edge desktop only)
        const hasDirectoryPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

        if (!hasDirectoryPicker) {
            // iPad, Android tablets, Firefox, Safari — blob download fallback
            await downloadSequentially();
            return;
        }

        let dirHandle: FileSystemDirectoryHandle;
        try {
            // Open the native OS folder picker
            dirHandle = await (window as Window & typeof globalThis & { showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' });
        } catch {
            // User cancelled the picker — do nothing
            return;
        }

        setDownloadProgress({ active: true, current: 0, total: files.length, currentName: '', done: false, error: null });

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setDownloadProgress(p => ({ ...p, current: i + 1, currentName: file.filename }));
            try {
                const res = await fetch(file.downloadUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();

                const fileHandle = await dirHandle.getFileHandle(file.filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
            } catch (err) {
                setDownloadProgress(p => ({ ...p, error: `Failed to save "${file.filename}": ${err instanceof Error ? err.message : 'Unknown error'}`, done: true }));
                return;
            }
        }

        setDownloadProgress(p => ({ ...p, done: true, currentName: '' }));
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
                <button className="btn btn-primary" onClick={handleDownloadAll} disabled={files.length === 0 || downloadProgress.active}>
                    {downloadProgress.active && !downloadProgress.done ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving...</span> : '📁 Save All to Folder'}
                </button>
                <button className="btn" style={{ background: "rgba(236, 72, 153, 0.1)", color: "var(--accent-pink)", border: "1px solid rgba(236, 72, 153, 0.3)" }} onClick={handleCloseBucket} disabled={closing}>
                    {closing ? "Destroying..." : "Close & Destroy Drop"}
                </button>
            </div>

            {/* Download Progress Overlay */}
            {downloadProgress.active && (
                <div className="modal-overlay">
                    <div className="glass-panel animate-fade-in" style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
                        {!downloadProgress.done ? (
                            <>
                                <div style={{ color: 'var(--accent-blue)', marginBottom: '1.5rem' }}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ margin: '0 auto' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </div>
                                <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Saving to Folder</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                    {downloadProgress.current} of {downloadProgress.total} — <span style={{ color: 'var(--text-primary)' }}>{downloadProgress.currentName}</span>
                                </p>
                                {/* Progress bar */}
                                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '999px', height: '8px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                                    <div style={{
                                        height: '100%',
                                        borderRadius: '999px',
                                        background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))',
                                        width: `${(downloadProgress.current / downloadProgress.total) * 100}%`,
                                        transition: 'width 0.3s ease',
                                    }} />
                                </div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    {Math.round((downloadProgress.current / downloadProgress.total) * 100)}% complete
                                </p>
                            </>
                        ) : downloadProgress.error ? (
                            <>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                                <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: 'var(--accent-pink)' }}>Download Error</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{downloadProgress.error}</p>
                                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setDownloadProgress(p => ({ ...p, active: false }))}>
                                    Close
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{ color: 'var(--accent-purple)', marginBottom: '1rem' }}>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '64px', height: '64px', margin: '0 auto' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>All Files Saved!</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                    {downloadProgress.total} file{downloadProgress.total !== 1 ? 's' : ''} saved to your chosen folder.
                                </p>
                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setDownloadProgress(p => ({ ...p, active: false }))}>
                                    Done
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

        </main>
    );
}
