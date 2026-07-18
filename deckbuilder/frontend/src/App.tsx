import { useEffect, useState } from "react";

interface Health {
  status: string;
  app: string;
  environment: string;
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "3rem",
        maxWidth: 640,
        margin: "0 auto",
        color: "#e8e6e3",
        background: "#161412",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ letterSpacing: "0.12em", color: "#e8552e", margin: 0 }}>VERMILION</h1>
      <p style={{ opacity: 0.8 }}>
        Private Magic: The Gathering deck builder — scaffold online.
      </p>
      {health && (
        <pre
          style={{
            background: "#0d0c0b",
            color: "#e8552e",
            padding: "1rem",
            borderRadius: 8,
            border: "1px solid #2a2723",
          }}
        >
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
      {error && <p style={{ color: "crimson" }}>API error: {error}</p>}
    </main>
  );
}
