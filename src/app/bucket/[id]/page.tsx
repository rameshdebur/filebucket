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

export default function BucketPage() {
    const { id } = useParams();
    const router = useRouter();

    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        fetchFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchFiles = async () => {
        try {
            const res = await fetch(`/api/buckets/${id}/files`);
            if (!res.ok) {
                throw new Error("Bucket not found or expired");
            }
            const data = await res.json();
            setFiles(data.files);
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("An unknown error occurred");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadAll = async () => {
        for (const file of files) {
            // Using window.open allows multiple downloads efficiently in most modern browsers
            window.open(file.downloadUrl, "_blank");
        }
    };

    const handleCloseBucket = async () => {
        if (!confirm("Are you sure? This will permanently delete the bucket and all files from our servers.")) return;

        setClosing(true);
        try {
            const res = await fetch(`/api/buckets/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to close bucket");
            router.push("/");
        } catch (err: unknown) {
            if (err instanceof Error) {
                alert(err.message);
            } else {
                alert("An unknown error occurred closing the bucket");
            }
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

    return (
        <main className="container animate-fade-in" style={{ maxWidth: "800px" }}>

            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3rem", marginTop: "2rem" }}>
                <h1 style={{ fontSize: "2rem", margin: 0 }} className="text-gradient">Secure <span className="text-gradient-accent">Drop</span></h1>
                <button className="btn btn-secondary" onClick={() => router.push("/")}>Leave</button>
            </header>

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
