"use client";

import { useState, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();

  // Upload State
  const [files, setFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Success State
  const [successData, setSuccessData] = useState<{ pin: string; folderName: string } | null>(null);

  // Retrieve State
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [retrieving, setRetrieving] = useState(false);
  const pinRefs = [
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)
  ];

  // --- Upload Handlers ---
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || !folderName.trim()) return;
    setUploading(true);

    try {
      // 1. Initialize Bucket
      const initRes = await fetch("/api/buckets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderName }),
      });

      if (!initRes.ok) throw new Error("Failed to initialize bucket");
      const bucketData = await initRes.json();

      // 2. Get Presigned URLs (backend also auto-configures CORS on bucket)
      const filePayload = files.map(f => ({
        filename: f.name,
        mimeType: f.type || "application/octet-stream",
        size: f.size,
      }));

      const presignRes = await fetch(`/api/buckets/${bucketData.bucketId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filePayload }),
      });

      if (!presignRes.ok) throw new Error("Failed to get upload URLs");
      const { presignedUrls } = await presignRes.json();

      // 3. Upload directly to Railway bucket using presigned URLs (free egress!)
      await Promise.all(
        files.map(async (file, index) => {
          const { uploadUrl } = presignedUrls[index];
          const res = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
          });
          if (!res.ok) throw new Error(`Failed to upload ${file.name}: ${res.status}`);
        })
      );

      setSuccessData({ pin: bucketData.pin, folderName: bucketData.folderName });
      setFiles([]);
      setFolderName("");

    } catch (error) {
      console.error(error);
      alert("An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };


  // --- Retrieve Handlers ---
  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-focus next input
    if (value && index < 5) {
      pinRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    } else if (e.key === "Enter" && pin.join("").length === 6) {
      handleRetrieve();
    }
  };

  const handleRetrieve = async () => {
    const fullPin = pin.join("");
    if (fullPin.length !== 6) return;
    setRetrieving(true);

    try {
      const res = await fetch("/api/buckets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: fullPin }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid PIN");
      }

      const { bucketId } = await res.json();
      router.push(`/bucket/${bucketId}`);

    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert("An unknown error occurred.");
      }
      setPin(["", "", "", "", "", ""]);
      pinRefs[0].current?.focus();
    } finally {
      setRetrieving(false);
    }
  };

  return (
    <main className="container animate-fade-in">

      <nav className="navbar">
        <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
          <span style={{ color: 'var(--primary)', fontWeight: 800 }}>Drop</span><span style={{ opacity: 0.9 }}>R</span>
        </div>
        <div className="nav-links">
          <Link href="/admin" className="nav-link">Doctor Portal</Link>
        </div>
      </nav>

      <header style={{ textAlign: "center", marginBottom: "3rem", marginTop: "2rem" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "0.5rem", letterSpacing: "-0.05em" }} className="text-gradient">
          Drop<span className="text-gradient-accent">R</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.2rem", maxWidth: "600px", margin: "0 auto", lineHeight: "1.6" }}>
          The effortless file dropper for physios.<br />
          <span style={{ color: "var(--accent-blue)", fontWeight: "500" }}>Your secure USB stick in the sky.</span>
        </p>
      </header>

      <div className="grid-cols-2">

        {/* --- LEFT CARD: UPLOAD --- */}
        <section className="glass-panel">
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Drop Files</h2>

          <div className="input-group">
            <label className="input-label">Folder Name (Needed for PIN Recovery)</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. My Tax Docs 2026"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              disabled={uploading}
            />
          </div>

          <div
            className={`drop-zone ${isDragging ? "active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ marginBottom: "1.5rem" }}
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p>Drag & drop files here, or <span style={{ color: "var(--accent-blue)" }}>click to browse</span></p>
            <input
              type="file"
              multiple
              hidden
              ref={fileInputRef}
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>

          {files.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ marginBottom: "0.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                {files.length} file(s) selected
              </div>
              <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                {files.map((file, idx) => (
                  <div key={idx} className="file-item">
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-meta">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <button onClick={() => removeFile(idx)} className="btn-secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", border: "none" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={handleUpload}
            disabled={files.length === 0 || !folderName.trim() || uploading}
          >
            {uploading ? <div className="spinner"></div> : "Secure & Upload"}
          </button>
        </section>

        {/* --- RIGHT CARD: RETRIEVE --- */}
        <section className="glass-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Retrieve Files</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", textAlign: "center" }}>Enter your 6-digit bucket PIN</p>

          <div className="pin-input-container" style={{ marginBottom: "2rem" }}>
            {pin.map((digit, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={1}
                className="input-field pin-digit"
                value={digit}
                onChange={(e) => handlePinChange(idx, e.target.value)}
                onKeyDown={(e) => handlePinKeyDown(idx, e)}
                ref={pinRefs[idx]}
                disabled={retrieving}
              />
            ))}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", maxWidth: "300px" }}
            onClick={handleRetrieve}
            disabled={pin.join("").length !== 6 || retrieving}
          >
            {retrieving ? <div className="spinner"></div> : "Unlock Bucket"}
          </button>
        </section>

      </div>

      {/* --- SUCCESS MODAL --- */}
      {successData && (
        <div className="modal-overlay">
          <div className="glass-panel animate-fade-in" style={{ maxWidth: "400px", textAlign: "center" }}>
            <div style={{ color: "var(--accent-purple)", marginBottom: "1rem" }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: "64px", height: "64px", margin: "0 auto" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Upload Complete</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>Your files are secure. Share this PIN to retrieve them.</p>

            <div style={{ background: "rgba(0,0,0,0.5)", padding: "1.5rem", borderRadius: "var(--radius-md)", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "3rem", fontWeight: "800", letterSpacing: "0.5rem", color: "var(--accent-blue)" }}>
                {successData.pin}
              </div>
            </div>

            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "2rem" }}>
              Folder Name: <strong>{successData.folderName}</strong><br />
              <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>(Save this name if you forget the PIN)</span>
            </p>

            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setSuccessData(null)}>
              Close
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
