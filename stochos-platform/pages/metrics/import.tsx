import { useState } from 'react';

export default function MetricImport() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/v1/metrics/import', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setStatus('Import successful');
      } else {
        const err = await res.json();
        setStatus(`Error: ${err.error}`);
      }
    } catch (e:any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Metric Bulk Import (CSV / JSON)</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".csv,application/json"
          onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
          required
        />
        <button type="submit" style={{ marginLeft: '1rem' }}>Upload</button>
      </form>
      {status && <p>{status}</p>}
    </div>
  );
}
