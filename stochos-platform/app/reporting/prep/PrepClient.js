'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Scissors, Search, Link2, Tag, GitFork, Ban, Sigma, PlusCircle, Edit, X } from 'lucide-react';
import HelpTrigger from '../../components/HelpTrigger';

export default function PrepClient() {
  const router = useRouter();

  // Saved pipelines fetched from database
  const [savedPipelines, setSavedPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [pipelineName, setPipelineName] = useState('New York Lottery Ingest Crosswalk');
  const [pipelineDescription, setPipelineDescription] = useState('Standard mapping for NY Lottery CSV trial balance');

  // Raw file mock data (matching their GL Trial Balance format)
  const rawData = [
    { account: '40100-00-00-0000-1159', name: 'California Scratchers Sales', balance: 88807547.70 },
    { account: '64100-00-00-0000-1401', name: 'California Scratchers Prize Expense', balance: 13828617.83 },
    { account: '64200-00-00-0000-1401', name: 'California Scratchers Retailer Commission', balance: 1070347.50 },
  ];

  // Visual transformation nodes state (configured to replace California and Scratchers, and flip signage)
  const [nodes, setNodes] = useState([
    { 
      id: 'replace_cal', 
      type: 'replace_text', 
      field: 'name', 
      pattern: 'California', 
      replacement: 'New York' 
    },
    { 
      id: 'replace_scrat', 
      type: 'replace_text', 
      field: 'name', 
      pattern: 'Scratchers', 
      replacement: 'Instant Ticket' 
    },
    {
      id: 'norm_sign_1',
      type: 'normalize_sign',
      field: 'account'
    }
  ]);

  const [message, setMessage] = useState('');

  // Fetch saved pipelines on mount
  useEffect(() => {
    async function fetchPipelines() {
      try {
        const res = await fetch('/api/reporting/pipelines');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setSavedPipelines(data.pipelines);
          }
        }
      } catch (err) {
        console.error('Error fetching pipelines:', err);
      }
    }
    fetchPipelines();
  }, []);

  // Handle loading a saved pipeline
  const handleLoadPipeline = (pipelineId) => {
    setSelectedPipelineId(pipelineId);
    const selected = savedPipelines.find(p => p.id === pipelineId);
    if (selected) {
      setPipelineName(selected.name);
      setPipelineDescription(selected.description || '');
      if (selected.pipelineJson && selected.pipelineJson.nodes) {
        setNodes(selected.pipelineJson.nodes);
      }
    }
  };

  const addNode = (type) => {
    let newNode = { id: `${type}_${Date.now()}`, type };
    if (type === 'split') {
      newNode = { ...newNode, field: 'account', delimiter: '-', names: ['Segment 1', 'Segment 2'] };
    } else if (type === 'regex_extract') {
      newNode = { ...newNode, field: 'account', pattern: '([0-9]+)', targetField: 'extracted_code' };
    } else if (type === 'map_account') {
      newNode = { ...newNode, field: 'Segment 1', mapping: { '4': '4-1000', '5': '5-2000' } };
    } else if (type === 'map_dimension') {
      newNode = { ...newNode, field: 'Segment 2', dimensionName: 'Game_ID' };
    } else if (type === 'conditional_map') {
      newNode = { ...newNode, field: 'Segment 1', conditionValue: '4', targetValue: 'Revenue', targetField: 'account_type' };
    } else if (type === 'exclude_row') {
      newNode = { ...newNode, field: 'Segment 2', value: 'EXCLUDE' };
    } else if (type === 'aggregate') {
      newNode = { ...newNode, keys: ['account_code'], sumField: 'balance' };
    } else if (type === 'normalize_sign') {
      newNode = { ...newNode, field: 'account' };
    } else if (type === 'replace_text') {
      newNode = { ...newNode, field: 'name', pattern: 'Scratchers', replacement: 'Instant Ticket' };
    } else if (type === 'pivot') {
      newNode = { ...newNode, columns: ['Segment 1'], valueField: 'balance' };
    } else if (type === 'unpivot') {
      newNode = { ...newNode, columns: ['Segment 1'], valueField: 'balance' };
    }
    setNodes([...nodes, newNode]);
  };

  const removeNode = (id) => {
    setNodes(nodes.filter(n => n.id !== id));
  };

  const updateNode = (id, fields) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, ...fields } : n));
  };

  // Process raw data through visual transformation steps (client-side preview)
  const processPreview = () => {
    let processed = rawData.map(row => ({ ...row }));

    nodes.forEach(step => {
      try {
        if (step.type === 'split') {
          processed = processed.map(row => {
            const val = String(row[step.field] || '');
            const parts = val.split(step.delimiter || '-');
            const newRow = { ...row };
            (step.names || []).forEach((name, idx) => {
              newRow[name] = parts[idx] || '';
            });
            return newRow;
          });
        } 
        
        else if (step.type === 'regex_extract') {
          processed = processed.map(row => {
            const val = String(row[step.field] || '');
            const regex = new RegExp(step.pattern || '(.*)');
            const match = val.match(regex);
            const newRow = { ...row };
            newRow[step.targetField || 'extracted'] = match ? match[1] || '' : '';
            return newRow;
          });
        } 
        
        else if (step.type === 'map_account') {
          processed = processed.map(row => {
            const val = String(row[step.field] || '');
            const mapping = step.mapping || {};
            const mapped = mapping[val] || val;
            return { ...row, accountCode: mapped };
          });
        } 
        
        else if (step.type === 'map_dimension') {
          processed = processed.map(row => {
            const val = String(row[step.field] || '');
            const newRow = { ...row };
            newRow[step.dimensionName || 'Game_ID'] = val !== '0000' ? val : 'N/A';
            return newRow;
          });
        } 
        
        else if (step.type === 'conditional_map') {
          processed = processed.map(row => {
            const val = String(row[step.field] || '');
            const matched = val === step.conditionValue;
            const newRow = { ...row };
            newRow[step.targetField || 'cond_mapped'] = matched ? step.targetValue : (step.defaultValue || val);
            return newRow;
          });
        } 
        
        else if (step.type === 'exclude_row') {
          processed = processed.filter(row => {
            const val = String(row[step.field] || '');
            return val !== step.value;
          });
        } 
        
        else if (step.type === 'aggregate') {
          const groups = {};
          processed.forEach(row => {
            const key = (step.keys || []).map(k => row[k] || '').join('|');
            if (!groups[key]) {
              groups[key] = { ...row, [step.sumField || 'balance']: 0 };
            }
            groups[key][step.sumField || 'balance'] += parseFloat(String(row[step.sumField || 'balance'] || 0));
          });
          processed = Object.values(groups);
        } 
        
        else if (step.type === 'normalize_sign') {
          processed = processed.map(row => {
            const code = String(row[step.field] || '');
            const val = parseFloat(String(row.balance || 0));
            // Standard accounting signage: Prize Expense & Commissions are debits (flips sign to negative for ACFR representation)
            const isNegative = code.startsWith('5') || code.startsWith('6'); 
            return {
              ...row,
              balance: isNegative ? -Math.abs(val) : Math.abs(val)
            };
          });
        }
        else if (step.type === 'replace_text') {
          processed = processed.map(row => {
            const val = String(row[step.field] || '');
            const pattern = step.pattern || '';
            const replacement = step.replacement || '';
            const newRow = { ...row };
            newRow[step.field] = val.replaceAll(pattern, replacement);
            return newRow;
          });
        }
      } catch (err) {
        console.error('Error processing step:', step.type, err);
      }
    });

    return processed;
  };

  const handlePublishPipeline = async () => {
    setMessage('');
    
    // Construct pipelineJson matching schemas/pipeline_schema.json
    const pipelineJson = {
      name: pipelineName,
      nodes: nodes.map(n => ({ nodeId: n.id, ...n })),
      edges: nodes.slice(0, -1).map((n, idx) => ({
        from: n.id,
        to: nodes[idx + 1].id
      }))
    };

    try {
      const res = await fetch('/api/reporting/pipelines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: pipelineName,
          description: pipelineDescription,
          pipelineJson
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Pipeline published successfully!');
        setSavedPipelines([data.pipeline, ...savedPipelines.filter(p => p.id !== data.pipeline.id)]);
      } else {
        setMessage(`Error: ${data.error || 'Failed to publish pipeline'}`);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const previewData = processPreview();

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '2rem', height: '100vh', background: 'var(--surface-1)', fontFamily: 'var(--font-sans)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text)', margin: 0, letterSpacing: '-0.5px' }}>Data Prep Studio</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', margin: 0 }}>Visual ETL Pipeline & Smart Crosswalk</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <HelpTrigger topicId="reporting_prep" />
          <button 
            onClick={() => router.push('/reporting')} 
            style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: 'var(--shadow-card)' }}
          >
            Back to Studio
          </button>
          <button 
            onClick={handlePublishPipeline} 
            style={{ padding: '8px 24px', background: 'var(--green)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', boxShadow: '0 2px 4px rgba(16, 124, 65, 0.15)' }}
          >
            Publish Pipeline
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: PIPELINE BUILDER */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transformation Pipeline</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Select Pipeline to Load</label>
              <select 
                value={selectedPipelineId} 
                onChange={(e) => handleLoadPipeline(e.target.value)}
                style={{ width: '100%', padding: '10px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', outline: 'none' }}
              >
                <option value="">-- Create New Pipeline --</option>
                {savedPipelines.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Pipeline Name</label>
              <input 
                type="text" 
                value={pipelineName} 
                onChange={(e) => setPipelineName(e.target.value)}
                style={{ width: '100%', padding: '10px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Description</label>
              <textarea 
                value={pipelineDescription} 
                onChange={(e) => setPipelineDescription(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '10px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Step 0: Raw Upload (Immutable) */}
            <div style={{ background: 'var(--surface-1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', borderLeft: '4px solid var(--text-muted)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '4px' }}>STEP 0 (IMMUTABLE)</div>
              <div style={{ fontWeight: '600', color: 'var(--text)' }}>Raw CSV Upload (Account, Name, Balance)</div>
            </div>

            {nodes.map((step, index) => (
              <div key={step.id} style={{ background: 'var(--surface-1)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', borderLeft: '4px solid var(--blue)', position: 'relative' }}>
                <button onClick={() => removeNode(step.id)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: 'bold', marginBottom: '8px' }}>NODE {index + 1}: {step.type.toUpperCase()}</div>
                
                {step.type === 'split' && (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Split Column</label>
                    <input type="text" value={step.field} onChange={(e) => updateNode(step.id, { field: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Delimiter</label>
                    <input type="text" value={step.delimiter} onChange={(e) => updateNode(step.id, { delimiter: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Result Names (Comma separated)</label>
                    <input type="text" value={step.names.join(',')} onChange={(e) => updateNode(step.id, { names: e.target.value.split(',') })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', outline: 'none' }} />
                  </div>
                )}

                {step.type === 'map_account' && (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Source Field</label>
                    <input type="text" value={step.field} onChange={(e) => updateNode(step.id, { field: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Mapping Rules (JSON)</label>
                    <textarea value={JSON.stringify(step.mapping)} onChange={(e) => {
                      try {
                        updateNode(step.id, { mapping: JSON.parse(e.target.value) });
                      } catch(err) {}
                    }} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', outline: 'none' }} rows={3} />
                  </div>
                )}

                {step.type === 'normalize_sign' && (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Code Check Field</label>
                    <input type="text" value={step.field} onChange={(e) => updateNode(step.id, { field: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', outline: 'none' }} />
                  </div>
                )}

                {step.type === 'replace_text' && (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Target Field</label>
                    <input type="text" value={step.field} onChange={(e) => updateNode(step.id, { field: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Search For</label>
                    <input type="text" value={step.pattern} onChange={(e) => updateNode(step.id, { pattern: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Replace With</label>
                    <input type="text" value={step.replacement} onChange={(e) => updateNode(step.id, { replacement: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', outline: 'none' }} />
                  </div>
                )}

                {step.type === 'regex_extract' && (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Source Field</label>
                    <input type="text" value={step.field} onChange={(e) => updateNode(step.id, { field: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Regex Pattern</label>
                    <input type="text" value={step.pattern} onChange={(e) => updateNode(step.id, { pattern: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Target Field</label>
                    <input type="text" value={step.targetField} onChange={(e) => updateNode(step.id, { targetField: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', outline: 'none' }} />
                  </div>
                )}

                {step.type === 'map_dimension' && (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Source Field</label>
                    <input type="text" value={step.field} onChange={(e) => updateNode(step.id, { field: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Dimension Name</label>
                    <input type="text" value={step.dimensionName} onChange={(e) => updateNode(step.id, { dimensionName: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', outline: 'none' }} />
                  </div>
                )}

                {step.type === 'conditional_map' && (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Source Field</label>
                    <input type="text" value={step.field} onChange={(e) => updateNode(step.id, { field: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>If Field Equals</label>
                    <input type="text" value={step.conditionValue} onChange={(e) => updateNode(step.id, { conditionValue: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Map to Value</label>
                    <input type="text" value={step.targetValue} onChange={(e) => updateNode(step.id, { targetValue: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Target Field</label>
                    <input type="text" value={step.targetField} onChange={(e) => updateNode(step.id, { targetField: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', outline: 'none' }} />
                  </div>
                )}

                {step.type === 'exclude_row' && (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Exclude if Field</label>
                    <input type="text" value={step.field} onChange={(e) => updateNode(step.id, { field: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Equals</label>
                    <input type="text" value={step.value} onChange={(e) => updateNode(step.id, { value: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', outline: 'none' }} />
                  </div>
                )}

                {step.type === 'aggregate' && (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Group Keys (Comma sep)</label>
                    <input type="text" value={step.keys.join(',')} onChange={(e) => updateNode(step.id, { keys: e.target.value.split(',') })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', outline: 'none' }} />
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Sum Value Field</label>
                    <input type="text" value={step.sumField} onChange={(e) => updateNode(step.id, { sumField: e.target.value })} style={{ width: '100%', padding: '6px', background: 'var(--card-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', outline: 'none' }} />
                  </div>
                )}

              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
              <button onClick={() => addNode('split')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}><Scissors size={13} /> Split</button>
              <button onClick={() => addNode('regex_extract')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}><Search size={13} /> Regex</button>
              <button onClick={() => addNode('map_account')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}><Link2 size={13} /> Map Account</button>
              <button onClick={() => addNode('map_dimension')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}><Tag size={13} /> Map Dim</button>
              <button onClick={() => addNode('conditional_map')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}><GitFork size={13} /> Cond Map</button>
              <button onClick={() => addNode('exclude_row')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}><Ban size={13} /> Exclude Row</button>
              <button onClick={() => addNode('aggregate')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}><Sigma size={13} /> Aggregate</button>
              <button onClick={() => addNode('normalize_sign')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}><PlusCircle size={13} /> Flips sign</button>
              <button onClick={() => addNode('replace_text')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', gridColumn: 'span 2' }}><Edit size={13} /> Replace Text</button>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: SPLIT-SCREEN PREVIEW */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
          
          {message && (
            <div style={{ padding: '12px', background: 'var(--status-passed-bg)', color: 'var(--status-passed-text)', borderRadius: '8px', border: '1px solid var(--status-passed-border)', fontWeight: 'bold', fontSize: '13px' }}>
              {message}
            </div>
          )}

          {/* Raw Table */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <h2 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>1. Immutable Raw Layer</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-1)', textAlign: 'left' }}>
                  <th style={{ padding: '12px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>account</th>
                  <th style={{ padding: '12px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>name</th>
                  <th style={{ padding: '12px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>balance</th>
                </tr>
              </thead>
              <tbody>
                {rawData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                    <td style={{ padding: '12px', color: 'var(--text)', fontFamily: 'monospace' }}>{row.account}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.name}</td>
                    <td style={{ padding: '12px', color: 'var(--text)', textAlign: 'right' }}>${row.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Processed/Normalized Table */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '20px', color: 'var(--text)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', flex: 1 }}>
            <h2 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.5px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', background: 'var(--green)', borderRadius: '50%' }}></span>
              2. Normalized Grid (Live Preview)
            </h2>
            <div style={{ overflowX: 'auto' }}>
              {previewData.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No data after filters/exclusions.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-1)', textAlign: 'left' }}>
                      {Object.keys(previewData[0] || {}).map(header => (
                        <th key={header} style={{ padding: '12px', borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)' }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                        {Object.entries(row).map(([k, val]) => (
                          <td key={k} style={{ 
                            padding: '12px', 
                            fontFamily: k.includes('code') || k === 'account' ? 'monospace' : 'inherit',
                            fontWeight: k === 'accountCode' || k === 'balance' ? 'bold' : 'normal',
                            textAlign: k === 'balance' ? 'right' : 'left',
                            color: k === 'accountCode' ? 'var(--blue)' : 'var(--text)'
                          }}>
                            {typeof val === 'number' ? `$${val.toLocaleString()}` : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
