"use client";

import { useState } from "react";

interface AdminBucket {
    id: string;
    folderName: string;
    pin: string;
    createdAt: string;
    expiresAt: string;
    _count: { files: number };
}

export default function AdminDashboard() {
    const [masterPin, setMasterPin] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [buckets, setBuckets] = useState<AdminBucket[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!masterPin) return;

        // Attempt to fetch buckets to verify PIN
        await fetchBuckets(masterPin, search);
    };

    const fetchBuckets = async (pin: string, searchQuery: string = "") => {
        setLoading(true);
        try {
            const url = searchQuery ? `/api/admin/buckets?search=${encodeURIComponent(searchQuery)}` : `/api/admin/buckets`;
            const res = await fetch(url, {
                headers: { "X-Admin-Pin": pin }
            });

            if (res.status === 401) {
                alert("Invalid Admin Master PIN");
                setIsAuthenticated(false);
                return;
            }

            if (!res.ok) throw new Error("Failed to fetch buckets");

            const data = await res.json();
            setBuckets(data.buckets);
            setIsAuthenticated(true);
        } catch (err: unknown) {
            console.error(err);
            alert("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (isAuthenticated) fetchBuckets(masterPin, search);
    };

    const handleResetPin = async (bucketId: string) => {
        if (!confirm("Are you sure you want to regenerate the PIN for this folder? The old PIN will immediately stop working.")) return;

        try {
            const res = await fetch(`/api/admin/buckets/${bucketId}/reset-pin`, {
                method: "POST",
                headers: { "X-Admin-Pin": masterPin }
            });

            if (!res.ok) throw new Error("Failed to reset PIN");

            // Refresh list
            fetchBuckets(masterPin, search);
        } catch (err) {
            console.error(err);
            alert("Failed to reset PIN");
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="container animate-fade-in" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
                <form onSubmit={handleLogin} className="glass-panel" style={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>
                    <h1 style={{ fontSize: "2rem", marginBottom: "2rem" }} className="text-gradient">Doctor Portal</h1>

                    <div className="input-group">
                        <label className="input-label" style={{ textAlign: "left" }}>Master PIN</label>
                        <input
                            type="password"
                            className="input-field"
                            value={masterPin}
                            onChange={(e) => setMasterPin(e.target.value)}
                            placeholder="Enter Master PIN"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }} disabled={loading}>
                        {loading ? <div className="spinner"></div> : "Authenticate"}
                    </button>
                </form>
            </div>
        );
    }

    return (
        <main className="container animate-fade-in">
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", marginTop: "1rem" }}>
                <h1 style={{ fontSize: "2rem", margin: 0 }} className="text-gradient">Doctor Portal</h1>
                <button className="btn btn-secondary" onClick={() => { setIsAuthenticated(false); setMasterPin(""); setBuckets([]); }}>Logout</button>
            </header>

            <section className="glass-panel" style={{ marginBottom: "2rem" }}>
                <form onSubmit={handleSearch} style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                    <div className="input-group" style={{ flexGrow: 1, margin: 0 }}>
                        <label className="input-label">Search by Folder Name</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Tax Documents"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        Search
                    </button>
                </form>
            </section>

            <section className="glass-panel">
                {loading && !buckets.length ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}><div className="spinner"></div></div>
                ) : buckets.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No active buckets found.</div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                    <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: "500" }}>Folder Name</th>
                                    <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: "500" }}>Current PIN</th>
                                    <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: "500" }}>Files</th>
                                    <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: "500" }}>Expires</th>
                                    <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: "500", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {buckets.map(b => (
                                    <tr key={b.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                        <td style={{ padding: "1rem", fontWeight: "600" }}>{b.folderName}</td>
                                        <td style={{ padding: "1rem", fontFamily: "monospace", fontSize: "1.1rem", color: "var(--accent-purple)" }}>{b.pin}</td>
                                        <td style={{ padding: "1rem" }}>{b._count.files}</td>
                                        <td style={{ padding: "1rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{new Date(b.expiresAt).toLocaleString()}</td>
                                        <td style={{ padding: "1rem", textAlign: "right" }}>
                                            <button onClick={() => handleResetPin(b.id)} className="btn btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>Reset PIN</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

        </main>
    );
}
