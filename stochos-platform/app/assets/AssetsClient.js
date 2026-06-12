"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Calendar, FileText, Download, Upload, AlertTriangle, Zap, ArrowRight, X, RefreshCw, MapPin, CheckCircle, Info } from "lucide-react";

const CATEGORIES = {
  computer: "Computer",
  mobile: "Mobile Device",
  scanner: "Barcode Scanner",
  peripheral: "Peripheral",
  furniture: "Office Furniture",
  other: "Other Asset",
};

const ASSET_STATUSES = {
  available: "Available",
  assigned: "Assigned / Checkout",
  repair: "In Repair",
  retired: "Retired",
};

function parseCsvText(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  if (lines.length === 0) return [];
  const headers = lines[0].map(h => h.trim());
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, index) => {
      obj[h] = values[index];
    });
    data.push(obj);
  }
  return data;
}

function getAssetStatusDetails(a) {
  const startDate = a.purchaseDate ? new Date(a.purchaseDate) : (a.createdAt ? new Date(a.createdAt) : new Date());
  const diffTime = Math.max(0, new Date() - startDate);
  const monthsAge = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.4375));
  const usefulMonths = a.usefulLifeMonths || 36;
  
  const isEol = monthsAge >= usefulMonths;
  const isNearingEol = !isEol && (monthsAge >= usefulMonths - 6);

  const purchaseValue = a.value ? parseFloat(a.value) : 0;
  const salvageValue = a.salePrice ? parseFloat(a.salePrice) : 0;
  const depreciableAmount = Math.max(0, purchaseValue - salvageValue);
  
  const monthlyDepreciation = usefulMonths > 0 ? (depreciableAmount / usefulMonths) : 0;
  const accumulatedDepreciation = Math.min(purchaseValue, monthlyDepreciation * monthsAge);
  const bookValue = Math.max(salvageValue, purchaseValue - accumulatedDepreciation);

  return {
    isEol,
    isNearingEol,
    monthsAge,
    bookValue,
    accumulatedDepreciation,
    monthlyDepreciation
  };
}

export default function AssetsClient({ initialAssets, jurisdictions, users, orgUnits = [], highlightTag, highlightId }) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  
  // DOM Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Search state (raw input + debounced version)
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Asset Class (Deployment) & Dormant Filters
  const [deploymentFilter, setDeploymentFilter] = useState("all"); // all, retail, office
  const [dormantFilterOnly, setDormantFilterOnly] = useState(false);

  // Bulk Updates State
  const [bulkActionStatus, setBulkActionStatus] = useState("");
  const [bulkActionEmployeeId, setBulkActionEmployeeId] = useState("");
  const [bulkActionSaving, setBulkActionSaving] = useState(false);

  // CSV Validation Sandbox State
  const [sandboxRows, setSandboxRows] = useState([]);
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, fieldName }

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [syncingBudget, setSyncingBudget] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Asset Photo-Audit Ingestion State
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [auditHistory, setAuditHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [auditFile, setAuditFile] = useState(null);
  const [parsedMetadata, setParsedMetadata] = useState(null); // { latitude, longitude, auditedAt, fileSignature, isManual, originalFilename, fileSize }
  const [nearbyRetailers, setNearbyRetailers] = useState([]);
  const [fetchingNearby, setFetchingNearby] = useState(false);
  const [selectedRetailerId, setSelectedRetailerId] = useState("");
  const [alignToRetailer, setAlignToRetailer] = useState(true);
  const [registeringAudit, setRegisteringAudit] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [showSettingsHelp, setShowSettingsHelp] = useState(false);

  // Multi-Select Print Tag State
  const [selectedAssetIds, setSelectedAssetIds] = useState(new Set());
  const [printStyle, setPrintStyle] = useState("barcode");

  // Keystroke Debouncing effect (250ms delay)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, statusFilter, deploymentFilter, dormantFilterOnly]);

  // Reset forecast pagination to page 1 when selected year or category filter changes
  useEffect(() => {
    setForecastPage(1);
  }, [selectedForecastYear, forecastingCategoryFilter]);

  // Open highlight asset on load (for deep link scanning)
  useEffect(() => {
    if (highlightId) {
      const asset = assets.find(a => a.id === highlightId);
      if (asset) setSelectedAsset(asset);
    } else if (highlightTag) {
      const asset = assets.find(a => a.assetTag.toUpperCase() === highlightTag.toUpperCase());
      if (asset) setSelectedAsset(asset);
    }
  }, [highlightId, highlightTag, assets]);

  // Wave Reconciliation State
  const [activeWaveFilter, setActiveWaveFilter] = useState("all");
  const [waveStatusFilter, setWaveStatusFilter] = useState("all");
  const [reconciliationData, setReconciliationData] = useState({});
  const [loadingReconciliation, setLoadingReconciliation] = useState(false);

  // Batch Ingest State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchFolderName, setBatchFolderName] = useState("");
  const [batchAudits, setBatchAudits] = useState([]);
  const [parsingStatus, setParsingStatus] = useState({ active: false, total: 0, current: 0, speed: 0, timeRemaining: 0 });
  const [uploadStatus, setUploadStatus] = useState({ active: false, total: 0, current: 0, chunkIndex: 0, totalChunks: 0 });
  const [batchLogs, setBatchLogs] = useState([]);
  const [ignoredFiles, setIgnoredFiles] = useState([]);
  const [isCancelled, setIsCancelled] = useState(false);
  const [batchHistory, setBatchHistory] = useState([]);
  const [showBatchHistoryModal, setShowBatchHistoryModal] = useState(false);
  const [batchViewTab, setBatchViewTab] = useState("matched"); // matched, review, ignored

  // Generate waves dynamically
  const waveOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = d.toISOString().slice(0, 7); // YYYY-MM
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) + " Wave";
      options.push({ value, label });
    }
    return options;
  }, []);

  // Fetch reconciliation wave data
  useEffect(() => {
    if (activeWaveFilter === "all") {
      setReconciliationData({});
      return;
    }
    
    setLoadingReconciliation(true);
    fetch(`/api/assets/reconciliation?wave=${activeWaveFilter}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load reconciliation wave data");
        return res.json();
      })
      .then((data) => {
        setReconciliationData(data);
      })
      .catch((err) => {
        console.error(err);
        alert("Error loading wave reconciliation data");
      })
      .finally(() => setLoadingReconciliation(false));
  }, [activeWaveFilter]);

  // Folder Select Handler
  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const imgFiles = files.filter(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      return ["jpg", "jpeg", "heic", "heif"].includes(ext);
    });
    
    if (imgFiles.length === 0) {
      alert("No JPEGs or image files found in the selected folder.");
      return;
    }
    
    processFilesQueue(imgFiles);
  };

  // Drag-and-Drop Folder Handler
  const handleFolderDrop = async (e) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (!items) return;
    
    const filesList = [];
    const traverseDirectory = async (entry) => {
      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve));
        const ext = file.name.split('.').pop().toLowerCase();
        if (["jpg", "jpeg", "heic", "heif"].includes(ext)) {
          filesList.push(file);
        }
      } else if (entry.isDirectory) {
        const directoryReader = entry.createReader();
        const entries = await new Promise((resolve) => {
          directoryReader.readEntries(resolve);
        });
        for (const childEntry of entries) {
          await traverseDirectory(childEntry);
        }
      }
    };

    const traversePromises = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const entry = items[i].webkitGetAsEntry();
        if (entry) {
          traversePromises.push(traverseDirectory(entry));
        }
      }
    }
    
    setParsingStatus(prev => ({ ...prev, active: true, total: 0, current: 0 }));
    await Promise.all(traversePromises);
    
    if (filesList.length === 0) {
      alert("No JPEGs or image files found in the folder.");
      setParsingStatus(prev => ({ ...prev, active: false }));
      return;
    }
    
    processFilesQueue(filesList);
  };

  // Queue parser for EXIF photo audits
  const processFilesQueue = async (filesList) => {
    setIsCancelled(false);
    const folderName = filesList[0]?.webkitRelativePath?.split("/")[0] || "Imported Photos Folder";
    setBatchFolderName(folderName);
    setParsingStatus({ active: true, total: filesList.length, current: 0, speed: 0, timeRemaining: 0 });
    setIgnoredFiles([]);
    setBatchAudits([]);
    setBatchLogs([`${new Date().toLocaleTimeString()} - Started scanning folder... found ${filesList.length} candidate photo files.`]);

    const EXIF = (await import("exif-js")).default;
    const parsedAudits = [];
    const ignored = [];
    const logs = [`${new Date().toLocaleTimeString()} - Scanning folder... found ${filesList.length} photo files.`];

    const startTime = Date.now();
    let parsedCount = 0;

    const worker = async () => {
      while (filesList.length > 0) {
        const file = filesList.shift();
        if (!file) break;

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === "heic" || ext === "heif") {
          ignored.push({
            filename: file.name,
            fileSize: file.size,
            reason: "HEIC format detected (iPhones default). Convert to JPEG or enter details manually.",
            category: "HEIC Format"
          });
          parsedCount++;
          updateProgress(parsedCount, startTime);
          continue;
        }

        try {
          const metadata = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const arrayBuffer = e.target.result;
                const tags = EXIF.readFromBinaryFile(arrayBuffer);
                
                const convertGps = (gpsCoords, ref) => {
                  if (!gpsCoords || gpsCoords.length < 3) return null;
                  const d = gpsCoords[0].numerator / gpsCoords[0].denominator;
                  const m = gpsCoords[1].numerator / gpsCoords[1].denominator;
                  const s = gpsCoords[2].numerator / gpsCoords[2].denominator;
                  let dec = d + m / 60 + s / 3600;
                  if (ref === "S" || ref === "W") dec = -dec;
                  return parseFloat(dec.toFixed(6));
                };

                let lat = null;
                let lon = null;
                let dateTaken = "";

                if (tags) {
                  if (tags.GPSLatitude && tags.GPSLatitudeRef) {
                    lat = convertGps(tags.GPSLatitude, tags.GPSLatitudeRef);
                  }
                  if (tags.GPSLongitude && tags.GPSLongitudeRef) {
                    lon = convertGps(tags.GPSLongitude, tags.GPSLongitudeRef);
                  }
                  if (tags.DateTimeOriginal) {
                    const parts = tags.DateTimeOriginal.split(" ");
                    if (parts.length > 0) {
                      const dateParts = parts[0].split(":");
                      if (dateParts.length === 3) {
                        dateTaken = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
                      }
                    }
                  }
                }

                resolve({ lat, lon, dateTaken });
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
          });

          const signature = `${file.name}-${file.size}-${metadata.dateTaken || "manual"}`;
          
          // Auto-matching heuristics
          let matchedAsset = null;
          let confidence = "none";
          
          const filename = file.name;
          // Try matching filename against assetTag or serial
          const matchTag = assets.find(a => 
            filename.toLowerCase().includes(a.assetTag.toLowerCase()) || 
            (a.serialNumber && filename.toLowerCase().includes(a.serialNumber.toLowerCase()))
          );

          if (matchTag) {
            matchedAsset = matchTag;
            confidence = "high";
          } else {
            confidence = "review";
          }

          const isMissingMetadata = !metadata.lat || !metadata.lon || !metadata.dateTaken;

          parsedAudits.push({
            originalFilename: file.name,
            fileSize: file.size,
            latitude: metadata.lat,
            longitude: metadata.lon,
            auditedAt: metadata.dateTaken || new Date().toISOString().split("T")[0],
            fileSignature: signature,
            isManual: isMissingMetadata,
            matchedAsset,
            confidence,
            retailerId: matchedAsset?.retailerId || null,
          });
        } catch (err) {
          ignored.push({
            filename: file.name,
            fileSize: file.size,
            reason: `EXIF parsing failure: ${err.message}`,
            category: "Corrupted / Non-JPEG"
          });
        }

        parsedCount++;
        updateProgress(parsedCount, startTime);
      }
    };

    const updateProgress = (count, start) => {
      const elapsed = (Date.now() - start) / 1000;
      const speed = elapsed > 0 ? (count / elapsed) : 0;
      const remaining = speed > 0 ? ((filesList.length) / speed) : 0;
      setParsingStatus(prev => ({
        ...prev,
        current: count,
        speed: parseFloat(speed.toFixed(1)),
        timeRemaining: Math.ceil(remaining)
      }));
    };

    await Promise.all([worker(), worker(), worker()]);

    const getDistance = (lat1, lon1, lat2, lon2) => {
      if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Infinity;
      const R = 6371e3; // meters
      const φ1 = lat1 * Math.PI/180;
      const φ2 = lat2 * Math.PI/180;
      const Δφ = (lat2-lat1) * Math.PI/180;
      const Δλ = (lon2-lon1) * Math.PI/180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const clusters = [];
    parsedAudits.forEach(audit => {
      if (audit.latitude === null || audit.longitude === null) return;
      let matchedCluster = clusters.find(cluster => 
        getDistance(audit.latitude, audit.longitude, cluster[0].latitude, cluster[0].longitude) < 50
      );
      if (matchedCluster) {
        matchedCluster.push(audit);
      } else {
        clusters.push([audit]);
      }
    });

    let softMatchCount = 0;
    clusters.forEach(cluster => {
      const matchedItem = cluster.find(a => a.matchedAsset?.retailerId);
      const retailerId = matchedItem ? matchedItem.matchedAsset.retailerId : null;
      if (!retailerId) return;

      const retailerAssets = assets.filter(a => a.retailerId === retailerId && a.status !== "retired");
      
      if (cluster.length === retailerAssets.length) {
        const unmatchedPhotos = cluster.filter(a => a.matchedAsset === null);
        const unmatchedAssets = retailerAssets.filter(ra => !cluster.some(ca => ca.matchedAsset?.id === ra.id));

        if (unmatchedPhotos.length > 0 && unmatchedPhotos.length === unmatchedAssets.length) {
          for (let i = 0; i < unmatchedPhotos.length; i++) {
            const photo = unmatchedPhotos[i];
            const asset = unmatchedAssets[i];
            photo.matchedAsset = asset;
            photo.confidence = "high";
            photo.verificationStatus = "presence_verified";
            photo.retailerId = retailerId;
            softMatchCount++;
          }
        }
      }
    });

    setParsingStatus(prev => ({ ...prev, active: false }));
    setBatchAudits(parsedAudits);
    setIgnoredFiles(ignored);
    setBatchLogs(prev => [
      ...prev,
      `${new Date().toLocaleTimeString()} - Finished parsing. Found ${parsedAudits.length} valid audits, ${ignored.length} failed/ignored items.`,
      softMatchCount > 0 ? `${new Date().toLocaleTimeString()} - Soft-Matched ${softMatchCount} unreadable photo(s) using location count-matching (Presence Verified).` : ""
    ].filter(Boolean));
  };

  // Scale Simulation Handler
  const handleScaleSimulation = async () => {
    setBatchFolderName("Scale Simulation Batch");
    setParsingStatus({ active: true, total: 150, current: 0, speed: 0, timeRemaining: 0 });
    setBatchLogs([`${new Date().toLocaleTimeString()} - Initializing Scale Simulation Mode (150 assets)...`]);
    setIgnoredFiles([]);
    setBatchAudits([]);

    const mockAudits = [];
    const startTime = Date.now();
    const availableAssets = assets.slice(0, 150);

    for (let i = 0; i < 150; i++) {
      const asset = availableAssets[i % availableAssets.length];
      const assetTag = asset ? asset.assetTag : `AST-${10000 + i}`;
      
      const file = {
        name: `${assetTag}_audit_june.jpg`,
        size: Math.floor(Math.random() * 2000000) + 500000,
      };
      
      const lat = 40.7128 + (Math.random() - 0.5) * 0.05;
      const lon = -74.0060 + (Math.random() - 0.5) * 0.05;
      
      mockAudits.push({
        originalFilename: file.name,
        fileSize: file.size,
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
        auditedAt: new Date().toISOString().split("T")[0],
        fileSignature: `${file.name}-${file.size}-mock-${assetTag}-${Date.now()}`,
        isManual: false,
        matchedAsset: asset || null,
        confidence: asset ? "high" : "review",
        retailerId: asset?.retailerId || null
      });
    }

    // Simulate parsing delay to show progress bar
    for (let i = 1; i <= 150; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = i / elapsed;
      const remaining = (150 - i) / speed;
      setParsingStatus({
        active: true,
        total: 150,
        current: i,
        speed: parseFloat(speed.toFixed(1)),
        timeRemaining: Math.ceil(remaining)
      });
    }

    setParsingStatus(prev => ({ ...prev, active: false }));
    setBatchAudits(mockAudits);
    setBatchLogs(prev => [
      ...prev,
      `${new Date().toLocaleTimeString()} - Finished generating simulation data: 150 mock photos matched with active asset inventory tags.`
    ]);
  };

  // Chunked batch ingestion registration
  const handleRegisterBatch = async () => {
    if (batchAudits.length === 0) return;
    
    const matchedAudits = batchAudits.filter(a => a.matchedAsset !== null);
    
    if (matchedAudits.length === 0) {
      alert("No matched assets to upload. Please map them before uploading.");
      return;
    }

    setUploadStatus({ active: true, total: matchedAudits.length, current: 0, chunkIndex: 0, totalChunks: 0 });
    setBatchLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - Starting chunked batch ingestion registration...`]);
    
    const CHUNK_SIZE = 50;
    const chunks = [];

    for (let i = 0; i < matchedAudits.length; i += CHUNK_SIZE) {
      chunks.push(matchedAudits.slice(i, i + CHUNK_SIZE));
    }

    setIsCancelled(false);
    let registeredCount = 0;
    let skippedCount = 0;
    let localCancelled = false;

    // A check for cancellation closure
    let cancelledRef = false;

    for (let c = 0; c < chunks.length; c++) {
      if (isCancelled || cancelledRef) {
        localCancelled = true;
        setBatchLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - Ingestion stopped by user request.`]);
        break;
      }

      setUploadStatus(prev => ({
        ...prev,
        chunkIndex: c + 1,
        totalChunks: chunks.length
      }));

      const chunk = chunks[c];
      
      const payload = {
        folderName: batchFolderName,
        audits: chunk.map(item => ({
          assetId: item.matchedAsset.id,
          latitude: item.latitude,
          longitude: item.longitude,
          auditedAt: item.auditedAt,
          fileSignature: item.fileSignature,
          isManual: item.isManual,
          retailerId: item.retailerId || null,
          originalFilename: item.originalFilename,
          fileSize: item.fileSize,
          verificationStatus: item.verificationStatus || "fully_verified"
        }))
      };

      let retryCount = 0;
      const MAX_RETRIES = 3;
      let success = false;

      while (retryCount < MAX_RETRIES && !success && !isCancelled && !cancelledRef) {
        try {
          const res = await fetch("/api/assets/batch-audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Server error");
          }

          const data = await res.json();
          registeredCount += data.registeredCount;
          skippedCount += data.skippedCount;
          
          setBatchLogs(prev => [
            ...prev,
            `${new Date().toLocaleTimeString()} - Chunk ${c + 1}/${chunks.length} uploaded successfully. Registered: ${data.registeredCount}, Skipped/Duplicates: ${data.skippedCount}`
          ]);

          setUploadStatus(prev => ({
            ...prev,
            current: registeredCount
          }));

          success = true;
        } catch (err) {
          retryCount++;
          setBatchLogs(prev => [
            ...prev,
            `${new Date().toLocaleTimeString()} - WARNING: Chunk ${c + 1} upload failed (${err.message}). Retrying in 2 seconds (${retryCount}/${MAX_RETRIES})...`
          ]);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!success && !isCancelled && !cancelledRef) {
        setBatchLogs(prev => [
          ...prev,
          `${new Date().toLocaleTimeString()} - ERROR: Chunk ${c + 1} permanently failed after ${MAX_RETRIES} attempts. Ingestion paused.`
        ]);
        alert(`Ingestion paused. Network cut or blocked by corporate policy on chunk ${c + 1}/${chunks.length}.`);
        setUploadStatus(prev => ({ ...prev, active: false }));
        return;
      }
    }

    setUploadStatus(prev => ({ ...prev, active: false }));
    
    if (localCancelled) {
      alert(`Ingestion Stopped. ${registeredCount} of ${matchedAudits.length} assets were audited successfully. ${matchedAudits.length - registeredCount} assets remain pending.`);
    } else {
      alert(`Batch Ingest Completed!\n\nRegistered: ${registeredCount} audits\nSkipped (Duplicates): ${skippedCount}`);
      setShowBatchModal(false);
    }

    // Refresh assets data list
    fetch(`/api/assets`)
      .then(res => res.json())
      .then(data => setAssets(data))
      .catch(err => console.error("Error refreshing assets:", err));

    if (activeWaveFilter !== "all") {
      fetch(`/api/assets/reconciliation?wave=${activeWaveFilter}`)
        .then(res => res.json())
        .then(data => setReconciliationData(data));
    }

    router.refresh();
  };

  // Fetch Batch History
  const fetchBatchHistory = () => {
    fetch("/api/assets/batches")
      .then(res => {
        if (!res.ok) throw new Error("Failed to load batch history");
        return res.json();
      })
      .then(data => setBatchHistory(data))
      .catch(err => alert("Error fetching history: " + err.message));
  };

  // Rollback Batch Ingestion
  const handleRollbackBatch = async (batchId) => {
    if (!confirm("WARNING: Rolling back this batch will restore all affected assets back to their previous location and verification states. Child audit logs from this batch will be permanently deleted.\n\nAre you sure you want to proceed?")) return;

    try {
      const res = await fetch(`/api/assets/batches?batchId=${batchId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to roll back batch");
      }

      const result = await res.json();
      alert(`Batch rolled back successfully! Restored state for ${result.fileCount} assets.`);
      
      fetchBatchHistory();

      // Refresh assets list
      const assetsRes = await fetch("/api/assets");
      if (assetsRes.ok) {
        const updated = await assetsRes.json();
        setAssets(updated);
      }
      
      if (activeWaveFilter !== "all") {
        const reconRes = await fetch(`/api/assets/reconciliation?wave=${activeWaveFilter}`);
        if (reconRes.ok) {
          const data = await reconRes.json();
          setReconciliationData(data);
        }
      }
      router.refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  // Fetch audit history on selecting an asset
  useEffect(() => {
    if (selectedAsset) {
      setAuditFile(null);
      setParsedMetadata(null);
      setNearbyRetailers([]);
      setSelectedRetailerId("");
      setAuditError("");
      setLoadingHistory(true);
      
      fetch(`/api/assets/${selectedAsset.id}/audit`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load history");
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setAuditHistory(data);
          }
        })
        .catch((err) => console.error("Error fetching audit history:", err))
        .finally(() => setLoadingHistory(false));
    }
  }, [selectedAsset]);

  // Fetch nearby retailers based on coordinates
  const fetchNearbyRetailers = async (lat, lon) => {
    setFetchingNearby(true);
    try {
      const res = await fetch(`/api/retailers/nearby?latitude=${lat}&longitude=${lon}`);
      if (res.ok) {
        const data = await res.json();
        setNearbyRetailers(data);
        if (data.length > 0) {
          setSelectedRetailerId(data[0].id);
        } else {
          setSelectedRetailerId("");
        }
      }
    } catch (err) {
      console.error("Error fetching nearby retailers:", err);
    } finally {
      setFetchingNearby(false);
    }
  };

  // EXIF Photo Drop Handler
  const handlePhotoDrop = async (file) => {
    if (!file) return;
    setAuditFile(file);
    setAuditError("");
    setParsedMetadata(null);
    setNearbyRetailers([]);
    setSelectedRetailerId("");
    setAlignToRetailer(true);

    const isJpeg = file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg");
    const isHeic = file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");

    if (isHeic) {
      setAuditError("HEIC format detected. iPhones save photos in HEIC by default. Please convert to JPEG or manually enter details below.");
      setParsedMetadata({
        latitude: "",
        longitude: "",
        auditedAt: new Date().toISOString().split("T")[0],
        fileSignature: `${file.name}-${file.size}-manual-${Date.now()}`,
        isManual: true,
        originalFilename: file.name,
        fileSize: file.size,
      });
      return;
    }

    if (!isJpeg) {
      setAuditError("Unsupported format. Please upload a geotagged JPEG photo.");
      return;
    }

    try {
      const EXIF = (await import("exif-js")).default;
      const reader = new FileReader();
      
      reader.onload = function (e) {
        const arrayBuffer = e.target.result;
        const tags = EXIF.readFromBinaryFile(arrayBuffer);
        
        const convertGpsToDecimal = (gpsCoords, ref) => {
          if (!gpsCoords || gpsCoords.length < 3) return null;
          const degrees = gpsCoords[0].numerator / gpsCoords[0].denominator;
          const minutes = gpsCoords[1].numerator / gpsCoords[1].denominator;
          const seconds = gpsCoords[2].numerator / gpsCoords[2].denominator;
          
          let decimal = degrees + minutes / 60 + seconds / 3600;
          if (ref === "S" || ref === "W") {
            decimal = -decimal;
          }
          return parseFloat(decimal.toFixed(6));
        };

        let lat = null;
        let lon = null;
        let dateTaken = "";

        if (tags) {
          if (tags.GPSLatitude && tags.GPSLatitudeRef) {
            lat = convertGpsToDecimal(tags.GPSLatitude, tags.GPSLatitudeRef);
          }
          if (tags.GPSLongitude && tags.GPSLongitudeRef) {
            lon = convertGpsToDecimal(tags.GPSLongitude, tags.GPSLongitudeRef);
          }
          if (tags.DateTimeOriginal) {
            const parts = tags.DateTimeOriginal.split(" ");
            if (parts.length > 0) {
              const dateParts = parts[0].split(":");
              if (dateParts.length === 3) {
                dateTaken = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
              }
            }
          }
        }

        const isMissingMetadata = !lat || !lon || !dateTaken;
        
        const metadata = {
          latitude: lat !== null ? String(lat) : "",
          longitude: lon !== null ? String(lon) : "",
          auditedAt: dateTaken || new Date().toISOString().split("T")[0],
          fileSignature: `${file.name}-${file.size}-${dateTaken || "manual"}`,
          isManual: isMissingMetadata,
          originalFilename: file.name,
          fileSize: file.size,
        };

        if (isMissingMetadata) {
          setAuditError("Warning: Location services were turned off or EXIF metadata was stripped. You can manually enter details below.");
        }

        setParsedMetadata(metadata);
        
        if (lat && lon) {
          fetchNearbyRetailers(lat, lon);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("EXIF Parsing Error:", err);
      setAuditError("Failed to parse photo metadata. You can manually enter details below.");
      setParsedMetadata({
        latitude: "",
        longitude: "",
        auditedAt: new Date().toISOString().split("T")[0],
        fileSignature: `${file.name}-${file.size}-manual-${Date.now()}`,
        isManual: true,
        originalFilename: file.name,
        fileSize: file.size,
      });
    }
  };

  // Submit registered audit
  const handleSaveAudit = async (e) => {
    e.preventDefault();
    if (!parsedMetadata || !parsedMetadata.auditedAt) return;
    
    setRegisteringAudit(true);
    setAuditError("");
    
    let latVal = parsedMetadata.latitude;
    let lonVal = parsedMetadata.longitude;
    
    if (selectedRetailerId && alignToRetailer) {
      const selectedRet = nearbyRetailers.find((r) => r.id === selectedRetailerId);
      if (selectedRet) {
        latVal = String(selectedRet.latitude);
        lonVal = String(selectedRet.longitude);
      }
    }
    
    const body = {
      latitude: latVal ? parseFloat(latVal) : null,
      longitude: lonVal ? parseFloat(lonVal) : null,
      auditedAt: parsedMetadata.auditedAt,
      fileSignature: parsedMetadata.fileSignature,
      isManual: parsedMetadata.isManual,
      retailerId: selectedRetailerId || null,
      originalFilename: parsedMetadata.originalFilename || null,
      fileSize: parsedMetadata.fileSize || null,
    };
    
    try {
      const res = await fetch(`/api/assets/${selectedAsset.id}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to register audit");
      }
      
      const newAuditLog = await res.json();
      setAuditHistory([newAuditLog, ...auditHistory]);
      
      setAssets(
        assets.map((a) => {
          if (a.id === selectedAsset.id) {
            return {
              ...a,
              lastAuditedAt: newAuditLog.auditedAt,
              lastAuditLat: newAuditLog.latitude,
              lastAuditLon: newAuditLog.longitude,
              retailerId: newAuditLog.retailerId,
            };
          }
          return a;
        })
      );
      
      setAuditFile(null);
      setParsedMetadata(null);
      setNearbyRetailers([]);
      setSelectedRetailerId("");
      alert("Asset audit registered successfully!");
      router.refresh();
    } catch (err) {
      setAuditError(err.message);
    } finally {
      setRegisteringAudit(false);
    }
  };

  const handleSyncEolToBudget = async () => {
    let expiredComputersCount = 0;
    let expiredComputersCost = 0;
    let expiredMobilesCount = 0;
    let expiredMobilesCost = 0;

    assets.forEach((a) => {
      const rem = getAssetRemainingMonths(a);
      if (rem <= 0) {
        if (a.category === "computer") {
          expiredComputersCount++;
          expiredComputersCost += a.value ? parseFloat(a.value) : 0;
        } else if (a.category === "mobile") {
          expiredMobilesCount++;
          expiredMobilesCost += a.value ? parseFloat(a.value) : 0;
        }
      }
    });

    const totalCost = expiredComputersCost + expiredMobilesCost;
    const totalCount = expiredComputersCount + expiredMobilesCount;

    if (totalCount === 0) {
      alert("No expired (EOL) computers or mobile devices found to sync.");
      return;
    }

    const confirmMsg = `Are you sure you want to sync EOL lifecycle replacement costs into the IT Division Budget Proposal?\n\n` +
      `- Expired Laptops/Desktops: ${expiredComputersCount} ($${expiredComputersCost.toLocaleString()})\n` +
      `- Expired Mobile Devices: ${expiredMobilesCount} ($${expiredMobilesCost.toLocaleString()})\n` +
      `- Total Budget Request: $${totalCost.toLocaleString()}\n\n` +
      `This will inject these items as line items in the active draft budget for IT.`;

    if (!confirm(confirmMsg)) return;

    try {
      setSyncingBudget(true);
      const res = await fetch("/api/budget-proposals/import-assets?fiscalYear=2027", {
        method: "POST"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to sync assets with budget.");
      }

      const result = await res.json();
      alert(`Successfully synced EOL assets to IT Budget proposal!\n\n` +
        `- Computers Injected: ${result.computersReplaced} ($${result.computersCost.toLocaleString()})\n` +
        `- Mobiles Injected: ${result.mobilesReplaced} ($${result.mobilesCost.toLocaleString()})\n` +
        `- Budget Proposal updated successfully.`);
      router.refresh();
    } catch (err) {
      alert(`Error syncing EOL assets: ${err.message}`);
    } finally {
      setSyncingBudget(false);
    }
  };

  // Tab & Replacement Planner States
  const [activeView, setActiveView] = useState("inventory");
  const [lifeLeftFilter, setLifeLeftFilter] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  // EOL & Useful Life Helpers
  const getAssetUsefulLifeEndDate = (a) => {
    if (a._eolDate) return a._eolDate;
    const startDate = a.purchaseDate ? new Date(a.purchaseDate) : (a.createdAt ? new Date(a.createdAt) : new Date());
    const date = new Date(startDate);
    const usefulMonths = a.usefulLifeMonths || 36;
    date.setMonth(date.getMonth() + usefulMonths);
    return date;
  };

  const getAssetRemainingMonths = (a) => {
    if (a._remainingMonths !== undefined) return a._remainingMonths;
    const endDate = getAssetUsefulLifeEndDate(a);
    const diffTime = endDate - new Date();
    const remainingMonths = diffTime / (1000 * 60 * 60 * 24 * 30.4375);
    return remainingMonths;
  };

  // Sandbox pagination & Forecasting selected year states
  const [sandboxPage, setSandboxPage] = useState(1);
  const [sandboxPageSize, setSandboxPageSize] = useState(50);
  const [selectedForecastYear, setSelectedForecastYear] = useState(new Date().getFullYear());
  const [forecastingCategoryFilter, setForecastingCategoryFilter] = useState("all");
  const [forecastPage, setForecastPage] = useState(1);
  const forecastPageSize = 50;
  const [inflationRate, setInflationRate] = useState(3.0);

  // Pre-calculate useful life dates and location names for fast indexing/rendering
  const enrichedAssets = useMemo(() => {
    return assets.map(a => {
      const startDate = a.purchaseDate ? new Date(a.purchaseDate) : (a.createdAt ? new Date(a.createdAt) : new Date());
      const eolDate = new Date(startDate);
      const usefulMonths = a.usefulLifeMonths || 36;
      eolDate.setMonth(eolDate.getMonth() + usefulMonths);
      
      const diffTime = eolDate - new Date();
      const remainingMonths = diffTime / (1000 * 60 * 60 * 24 * 30.4375);
      
      const locationName = a.deploymentType === "retail"
        ? (a.retailer?.name || a.retailerId || "Unassigned")
        : (a.orgUnit?.name || a.orgUnitId || "Unassigned");
        
      return {
        ...a,
        _eolDate: eolDate,
        _remainingMonths: remainingMonths,
        _locationName: locationName
      };
    });
  }, [assets]);

  const filtered = useMemo(() => {
    return enrichedAssets.filter((a) => {
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      
      // Deployment filter (all, retail, office)
      if (deploymentFilter !== "all" && a.deploymentType !== deploymentFilter) return false;

      // Dormant filter (no audit > 6 months)
      if (dormantFilterOnly) {
        if (a.lastAuditedAt) {
          const auditDate = new Date(a.lastAuditedAt);
          const diffTime = Math.max(0, new Date() - auditDate);
          const monthsSinceAudit = diffTime / (1000 * 60 * 60 * 24 * 30.4375);
          if (monthsSinceAudit <= 6) return false;
        }
      }

      // Reconciliation Wave Filter
      if (activeWaveFilter !== "all") {
        const isVerified = !!reconciliationData[a.id];
        if (waveStatusFilter === "verified" && !isVerified) return false;
        if (waveStatusFilter === "pending" && isVerified) return false;
      }

      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (
          !a.name.toLowerCase().includes(q) &&
          !a.assetTag.toLowerCase().includes(q) &&
          !(a.serialNumber || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [assets, debouncedSearch, categoryFilter, statusFilter, deploymentFilter, dormantFilterOnly, activeWaveFilter, waveStatusFilter, reconciliationData]);

  // Paginated filtered assets for DOM pagination
  const paginatedFiltered = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Local validation logic for Import Sandbox rows
  const validateSandboxRowLocally = (data, rowIndex, currentRows) => {
    const errors = {};
    const validCategories = ["computer", "mobile", "scanner", "peripheral", "furniture", "other"];
    const validStatuses = ["available", "assigned", "repair", "retired"];
    const validDeploymentTypes = ["retail", "office"];

    const assetTag = String(data.assetTag || "").trim();
    const name = String(data.name || "").trim();
    const category = String(data.category || "").trim().toLowerCase();
    const valueRaw = data.value;
    const employeeEmail = String(data.assignedEmployeeEmail || "").trim();
    const jurAbbr = String(data.jurisdiction || "").trim();
    const status = String(data.status || "available").toLowerCase().trim();
    const purchaseDate = data.purchaseDate;
    const disposalDate = data.disposalDate;
    const salePrice = data.salePrice;
    const usefulLifeMonths = data.usefulLifeMonths;
    const deploymentType = String(data.deploymentType || "retail").toLowerCase().trim();
    const retailerId = String(data.retailerId || "").trim();
    const orgUnitCode = String(data.orgUnit || "").trim();

    // Required fields checks
    if (!assetTag) {
      errors.assetTag = "Asset Tag is required.";
    } else {
      const isDup = currentRows.some((r, idx) => idx !== rowIndex && String(r.data.assetTag || "").trim().toUpperCase() === assetTag.toUpperCase());
      if (isDup) {
        errors.assetTag = `Duplicate Asset Tag '${assetTag}' inside this batch.`;
      }
    }

    if (!name) {
      errors.name = "Name is required.";
    }

    if (!category) {
      errors.category = "Category is required.";
    } else if (!validCategories.includes(category)) {
      errors.category = `Must be: ${validCategories.join(", ")}`;
    }

    if (valueRaw !== undefined && valueRaw !== "" && isNaN(parseFloat(valueRaw))) {
      errors.value = "Must be a valid number.";
    }

    if (employeeEmail && !users.some(u => u.email.toLowerCase() === employeeEmail.toLowerCase())) {
      errors.assignedEmployeeEmail = "Employee email not found in Stochos system.";
    }

    if (jurAbbr && !jurisdictions.some(j => j.abbreviation.toUpperCase() === jurAbbr.toUpperCase())) {
      errors.jurisdiction = "Jurisdiction abbreviation not found.";
    }

    if (!validStatuses.includes(status)) {
      errors.status = `Must be: ${validStatuses.join(", ")}`;
    }

    if (purchaseDate && isNaN(Date.parse(purchaseDate))) {
      errors.purchaseDate = "Invalid date format.";
    }

    if (disposalDate && isNaN(Date.parse(disposalDate))) {
      errors.disposalDate = "Invalid date format.";
    }

    if (salePrice !== undefined && salePrice !== "" && isNaN(parseFloat(salePrice))) {
      errors.salePrice = "Must be a valid price.";
    }

    if (usefulLifeMonths !== undefined && usefulLifeMonths !== "" && isNaN(parseInt(usefulLifeMonths))) {
      errors.usefulLifeMonths = "Must be an integer.";
    }

    if (!validDeploymentTypes.includes(deploymentType)) {
      errors.deploymentType = "Must be: retail or office.";
    }

    if (deploymentType === "office" && retailerId) {
      errors.retailerId = "Office assets cannot be linked to a store Retailer ID.";
    }

    if (deploymentType === "retail" && orgUnitCode) {
      errors.orgUnit = "Retail assets cannot be linked to a corporate Org Unit.";
    }

    if (orgUnitCode && !orgUnits.some(ou => ou.code.toUpperCase() === orgUnitCode.toUpperCase())) {
      errors.orgUnit = `Org Unit code '${orgUnitCode}' does not exist.`;
    }

    return {
      errors,
      isValid: Object.keys(errors).length === 0
    };
  };

  const handleCellChange = (rowIndex, fieldName, value) => {
    setSandboxRows(prevRows => {
      const updatedRows = prevRows.map((row, idx) => {
        if (idx === rowIndex) {
          return {
            ...row,
            data: { ...row.data, [fieldName]: value }
          };
        }
        return row;
      });

      return updatedRows.map((row, idx) => {
        const { errors, isValid } = validateSandboxRowLocally(row.data, idx, updatedRows);
        return {
          ...row,
          errors,
          isValid
        };
      });
    });
  };

  const handleCommitSandbox = async () => {
    const invalidCount = sandboxRows.filter(r => !r.isValid).length;
    if (invalidCount > 0) {
      alert(`Cannot commit. There are still ${invalidCount} validation errors in the sandbox. Please correct them first.`);
      return;
    }

    setSaving(true);
    try {
      const payload = sandboxRows.map(r => r.data);
      const res = await fetch("/api/assets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to commit sandbox import.");
      }

      const result = await res.json();
      alert(`Import completed successfully! Created: ${result.createdCount}, Updated: ${result.updatedCount}`);
      
      setSandboxRows([]);
      setActiveView("inventory");

      const refreshRes = await fetch("/api/assets");
      if (refreshRes.ok) {
        const updatedList = await refreshRes.json();
        setAssets(updatedList);
      }
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedAssetIds.size === 0) return;
    if (!bulkActionStatus && !bulkActionEmployeeId) {
      alert("Please select a status or employee to update.");
      return;
    }

    const confirmMsg = `Are you sure you want to update ${selectedAssetIds.size} assets simultaneously?`;
    if (!confirm(confirmMsg)) return;

    setBulkActionSaving(true);
    try {
      const updateData = {};
      if (bulkActionStatus) {
        updateData.status = bulkActionStatus;
        if (bulkActionStatus === "available") {
          updateData.assignedToId = null;
        }
      }
      if (bulkActionEmployeeId) {
        updateData.assignedToId = bulkActionEmployeeId === "clear" ? null : bulkActionEmployeeId;
        if (bulkActionEmployeeId !== "clear") {
          updateData.status = "assigned";
        }
      }

      const res = await fetch("/api/assets/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetIds: Array.from(selectedAssetIds),
          updateData
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update assets");
      }

      alert(`Successfully updated ${selectedAssetIds.size} assets in database transaction block.`);
      setSelectedAssetIds(new Set());
      setBulkActionStatus("");
      setBulkActionEmployeeId("");

      const refreshRes = await fetch("/api/assets");
      if (refreshRes.ok) {
        const updatedList = await refreshRes.json();
        setAssets(updatedList);
      }
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkActionSaving(false);
    }
  };

  const renderSandboxCell = (row, rowIndex, fieldName, type = "text", selectOptions = null) => {
    const isEditing = editingCell && editingCell.rowIndex === rowIndex && editingCell.fieldName === fieldName;
    const value = row.data[fieldName] || "";
    const errorMsg = row.errors[fieldName];

    const cellStyle = {
      position: "relative",
      padding: isEditing ? "2px" : "8px",
      minWidth: "100px",
      cursor: "pointer",
      border: errorMsg ? "1px solid #dc2626" : "1px solid transparent",
      background: errorMsg ? "rgba(220, 38, 38, 0.05)" : "transparent",
      transition: "all 0.1s ease"
    };

    if (isEditing) {
      if (selectOptions) {
        return (
          <td style={cellStyle}>
            <select
              className="form-select"
              value={value}
              autoFocus
              style={{ width: "100%", padding: "2px", height: "auto", fontSize: "12px", background: "var(--surface-3)", color: "var(--text)" }}
              onBlur={() => setEditingCell(null)}
              onChange={(e) => {
                handleCellChange(rowIndex, fieldName, e.target.value);
                setEditingCell(null);
              }}
            >
              <option value="">Choose...</option>
              {Object.entries(selectOptions).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </td>
        );
      }

      return (
        <td style={cellStyle}>
          <input
            type={type}
            className="form-input"
            autoFocus
            style={{ width: "100%", padding: "2px 4px", fontSize: "12px", background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--blue)", height: "auto" }}
            value={value}
            onBlur={(e) => {
              handleCellChange(rowIndex, fieldName, e.target.value);
              setEditingCell(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCellChange(rowIndex, fieldName, e.target.value);
                setEditingCell(null);
              }
            }}
            onChange={(e) => {
              // local state triggers on blur
            }}
          />
        </td>
      );
    }

    return (
      <td 
        style={cellStyle} 
        onDoubleClick={() => setEditingCell({ rowIndex, fieldName })}
        title={errorMsg ? `${errorMsg} (Double-click to edit)` : "Double-click to edit"}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: value ? "var(--text)" : "var(--text-secondary)", fontStyle: value ? "normal" : "italic" }}>
            {value || "—"}
          </span>
          {errorMsg && (
            <span style={{ color: "#ef4444", marginLeft: "4px" }} title={errorMsg}>
              ⚠️
            </span>
          )}
        </div>
      </td>
    );
  };

  // 10-Year CapEx projection data aggregator
  const forecastingData = useMemo(() => {
    const startYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => startYear + i);
    const yearlyCosts = {};
    const yearlyInflatedCosts = {};
    const yearlyCounts = {};
    const yearlyCategoryBreakdown = {};

    years.forEach(yr => {
      yearlyCosts[yr] = 0;
      yearlyInflatedCosts[yr] = 0;
      yearlyCounts[yr] = 0;
      yearlyCategoryBreakdown[yr] = {};
      Object.keys(CATEGORIES).forEach(cat => {
        yearlyCategoryBreakdown[yr][cat] = { cost: 0, inflatedCost: 0, count: 0 };
      });
    });

    enrichedAssets.forEach(a => {
      // Filter by forecasting category!
      if (forecastingCategoryFilter !== "all" && a.category !== forecastingCategoryFilter) {
        return;
      }

      const eolDate = getAssetUsefulLifeEndDate(a);
      if (eolDate) {
        let eolYear = eolDate.getFullYear();
        if (eolYear < startYear) {
          eolYear = startYear; // Group backlog in current year
        }
        if (yearlyCosts[eolYear] !== undefined) {
          const cost = a.value ? parseFloat(a.value) : 0;
          
          // Inflation Math: cost * (1 + r)^n
          const n = Math.max(0, eolYear - startYear);
          const inflatedCost = cost * Math.pow(1 + (inflationRate / 100), n);
          
          yearlyCosts[eolYear] += cost;
          yearlyInflatedCosts[eolYear] += inflatedCost;
          yearlyCounts[eolYear] += 1;
          
          const cat = a.category || "other";
          if (!yearlyCategoryBreakdown[eolYear][cat]) {
            yearlyCategoryBreakdown[eolYear][cat] = { cost: 0, inflatedCost: 0, count: 0 };
          }
          yearlyCategoryBreakdown[eolYear][cat].cost += cost;
          yearlyCategoryBreakdown[eolYear][cat].inflatedCost += inflatedCost;
          yearlyCategoryBreakdown[eolYear][cat].count += 1;
        }
      }
    });

    return years.map(yr => ({
      year: yr,
      cost: yearlyCosts[yr],
      inflatedCost: yearlyInflatedCosts[yr],
      count: yearlyCounts[yr],
      categories: yearlyCategoryBreakdown[yr]
    }));
  }, [enrichedAssets, forecastingCategoryFilter, inflationRate]);

  // List of individual assets expiring in the selected forecast year
  const selectedYearAssets = useMemo(() => {
    const startYear = new Date().getFullYear();
    return enrichedAssets.filter(a => {
      // Category filter
      if (forecastingCategoryFilter !== "all" && a.category !== forecastingCategoryFilter) {
        return false;
      }
      
      // EOL Year check
      const eolDate = getAssetUsefulLifeEndDate(a);
      if (!eolDate) return false;
      
      let eolYear = eolDate.getFullYear();
      if (eolYear < startYear) {
        eolYear = startYear; // Backlog grouped in current year
      }
      
      return eolYear === selectedForecastYear;
    });
  }, [enrichedAssets, forecastingCategoryFilter, selectedForecastYear]);

  // Paginated expiring assets for selected year (limits DOM rendering lag)
  const paginatedForecastAssets = useMemo(() => {
    const startIndex = (forecastPage - 1) * forecastPageSize;
    return selectedYearAssets.slice(startIndex, startIndex + forecastPageSize);
  }, [selectedYearAssets, forecastPage]);

  const paginatedSandboxRows = useMemo(() => {
    const startIndex = (sandboxPage - 1) * sandboxPageSize;
    return sandboxRows.slice(startIndex, startIndex + sandboxPageSize);
  }, [sandboxRows, sandboxPage, sandboxPageSize]);

  const plannerAssets = useMemo(() => {
    return enrichedAssets.filter((a) => {
      const remainingMonths = getAssetRemainingMonths(a);
      if (lifeLeftFilter === "expired") {
        return remainingMonths <= 0;
      }
      if (lifeLeftFilter === "6_months") {
        return remainingMonths > 0 && remainingMonths <= 6;
      }
      if (lifeLeftFilter === "12_months") {
        return remainingMonths > 0 && remainingMonths <= 12;
      }
      if (lifeLeftFilter === "24_months") {
        return remainingMonths > 0 && remainingMonths <= 24;
      }
      return true;
    });
  }, [enrichedAssets, lifeLeftFilter]);

  const assetsByDate = useMemo(() => {
    const map = {};
    plannerAssets.forEach((a) => {
      const eolDate = getAssetUsefulLifeEndDate(a);
      if (eolDate) {
        const eolKey = eolDate.toISOString().split("T")[0];
        if (!map[eolKey]) map[eolKey] = { eol: [], disposal: [] };
        map[eolKey].eol.push(a);
      }
      if (a.disposalDate) {
        const dispKey = a.disposalDate.split("T")[0];
        if (!map[dispKey]) map[dispKey] = { eol: [], disposal: [] };
        map[dispKey].disposal.push(a);
      }
    });
    return map;
  }, [plannerAssets]);

  const selectedMonthAssets = useMemo(() => {
    return plannerAssets.filter((a) => {
      const eolDate = getAssetUsefulLifeEndDate(a);
      const isEolInMonth = eolDate && eolDate.getMonth() === currentMonth && eolDate.getFullYear() === currentYear;
      const isDispInMonth = a.disposalDate && 
        new Date(a.disposalDate).getMonth() === currentMonth && 
        new Date(a.disposalDate).getFullYear() === currentYear;
      return isEolInMonth || isDispInMonth;
    });
  }, [plannerAssets, currentMonth, currentYear]);

  const plannerKpis = useMemo(() => {
    let eolCount = 0;
    let criticalCount = 0;
    let replacementCost = 0;

    assets.forEach((a) => {
      const rem = getAssetRemainingMonths(a);
      if (rem <= 0) {
        eolCount++;
        replacementCost += a.value ? parseFloat(a.value) : 0;
      } else if (rem <= 6) {
        criticalCount++;
        replacementCost += a.value ? parseFloat(a.value) : 0;
      }
    });

    return { eolCount, criticalCount, replacementCost };
  }, [assets]);

  const handleRegisterAsset = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.target);
    const body = {
      assetTag: form.get("assetTag"),
      name: form.get("name"),
      category: form.get("category"),
      serialNumber: form.get("serialNumber") || null,
      status: form.get("status") || "available",
      value: form.get("value") ? parseFloat(form.get("value")) : null,
      jurisdictionId: form.get("jurisdictionId"),
      assignedToId: form.get("assignedToId") || null,
      purchaseDate: form.get("purchaseDate") || null,
      notes: form.get("notes") || null,
      usefulLifeMonths: form.get("usefulLifeMonths") ? parseInt(form.get("usefulLifeMonths")) : 36,
      disposalDate: form.get("disposalDate") || null,
      disposalMethod: form.get("disposalMethod") || null,
      salePrice: form.get("salePrice") ? parseFloat(form.get("salePrice")) : null,
    };

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to register asset");
      }

      const newAsset = await res.json();
      setAssets([newAsset, ...assets]);
      setShowAddModal(false);
      e.target.reset();
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAsset = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.target);
    const body = {
      assetTag: form.get("assetTag"),
      name: form.get("name"),
      category: form.get("category"),
      serialNumber: form.get("serialNumber") || null,
      status: form.get("status"),
      value: form.get("value") ? parseFloat(form.get("value")) : null,
      assignedToId: form.get("assignedToId") || null,
      purchaseDate: form.get("purchaseDate") || null,
      notes: form.get("notes") || null,
      usefulLifeMonths: form.get("usefulLifeMonths") ? parseInt(form.get("usefulLifeMonths")) : 36,
      disposalDate: form.get("disposalDate") || null,
      disposalMethod: form.get("disposalMethod") || null,
      salePrice: form.get("salePrice") ? parseFloat(form.get("salePrice")) : null,
    };

    try {
      const res = await fetch(`/api/assets/${selectedAsset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update asset");
      }

      const updated = await res.json();
      setAssets(assets.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      setSelectedAsset(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = async (id) => {
    if (!confirm("Are you sure you want to remove this asset from inventory?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete asset");
      }
      setAssets(assets.filter((a) => a.id !== id));
      setSelectedAsset(null);
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    window.open("/api/assets/export", "_blank");
  };

  const handleDownloadTemplate = () => {
    window.open("/api/assets/template", "_blank");
  };

  const handleExportForecastingCsv = (assetsToExport, filename) => {
    const startYear = new Date().getFullYear();
    const headers = [
      "Asset Tag", 
      "Name", 
      "Category", 
      "Serial Number", 
      "Status", 
      "Flat Cost (Value)", 
      "Inflated Cost", 
      "Purchase Date", 
      "Useful Life (Months)", 
      "Useful Life End Date", 
      "Deployment Type", 
      "Location"
    ];
    
    const rows = assetsToExport.map(a => {
      const eolDate = getAssetUsefulLifeEndDate(a);
      const eolYear = eolDate ? eolDate.getFullYear() : startYear;
      const flatCost = a.value ? parseFloat(a.value) : 0;
      const n = Math.max(0, eolYear - startYear);
      const inflatedCost = flatCost * Math.pow(1 + (inflationRate / 100), n);
      const locationName = a._locationName || (a.deploymentType === "retail" 
        ? (a.retailer?.name || a.retailerId || "Unassigned")
        : (a.orgUnit?.name || a.orgUnitId || "Unassigned"));

      return [
        a.assetTag,
        a.name,
        CATEGORIES[a.category] || a.category,
        a.serialNumber || "",
        ASSET_STATUSES[a.status] || a.status,
        flatCost.toFixed(2),
        inflatedCost.toFixed(2),
        a.purchaseDate ? new Date(a.purchaseDate).toISOString().split("T")[0] : "",
        a.usefulLifeMonths || "36",
        eolDate ? eolDate.toISOString().split("T")[0] : "",
        a.deploymentType || "retail",
        locationName
      ].map(val => `"${String(val).replace(/"/g, '""')}"`);
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size limit guard: 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert("File size limit exceeded. Maximum size is 5MB.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const parsed = parseCsvText(text);
        if (parsed.length === 0) {
          alert("No records found in CSV file.");
          setUploading(false);
          return;
        }

        const res = await fetch("/api/assets/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to validate CSV");
        }

        const result = await res.json();
        
        if (result.valid) {
          const confirmImport = confirm(`CSV file is 100% valid! Detected ${result.rows.length} assets to import.\n\nDo you want to import them immediately? (Click Cancel to review in sandbox first)`);
          
          if (confirmImport) {
            const importRes = await fetch("/api/assets/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed),
            });

            if (!importRes.ok) {
              const importData = await importRes.json();
              throw new Error(importData.error || "Failed to import assets");
            }

            const importResult = await importRes.json();
            alert(`Import completed! Created: ${importResult.createdCount}, Updated: ${importResult.updatedCount}`);
            
            const refreshRes = await fetch("/api/assets");
            if (refreshRes.ok) {
              const updatedList = await refreshRes.json();
              setAssets(updatedList);
            }
            router.refresh();
          } else {
            setSandboxRows(result.rows);
            setSandboxPage(1);
            setActiveView("sandbox");
          }
        } else {
          alert(`CSV file contains validation errors. Loading ${result.rows.length} rows into the Import Sandbox for review and correction.`);
          setSandboxRows(result.rows);
          setSandboxPage(1);
          setActiveView("sandbox");
        }
      } catch (err) {
        alert(err.message);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Calendar Grid helper functions
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();
  const formatDateKey = (year, month, day) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const calendarGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "1px",
    backgroundColor: "var(--border)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    overflow: "hidden"
  };

  const headerCellStyle = {
    backgroundColor: "var(--surface-3)",
    padding: "8px 4px",
    textAlign: "center",
    fontWeight: "600",
    fontSize: "12px",
    color: "var(--text-secondary)"
  };

  const getDayCellStyle = (isCurrentMonth, isSelected, isToday) => ({
    backgroundColor: isSelected 
      ? "var(--blue-dim)" 
      : isCurrentMonth ? "var(--card-bg)" : "var(--navy)",
    minHeight: "90px",
    padding: "6px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    cursor: "pointer",
    border: isSelected ? "2px solid var(--blue)" : "1px solid var(--border-dim)",
    opacity: isCurrentMonth ? 1 : 0.4,
    transition: "all 0.15s ease",
    position: "relative"
  });

  return (
    <>
      {/* View Switcher Tabs */}
      <div className="tab-nav" style={{ marginBottom: "20px" }}>
        <button 
          type="button"
          className={`tab-btn ${activeView === "inventory" ? "active" : ""}`}
          onClick={() => { setActiveView("inventory"); setSelectedDayKey(null); }}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <ClipboardList size={16} /> Active Inventory
        </button>
        <button 
          type="button"
          className={`tab-btn ${activeView === "planner" ? "active" : ""}`}
          onClick={() => { setActiveView("planner"); setSelectedDayKey(null); }}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Calendar size={16} /> Replacement Planner &amp; Calendar
        </button>
        <button 
          type="button"
          className={`tab-btn ${activeView === "forecasting" ? "active" : ""}`}
          onClick={() => { setActiveView("forecasting"); setSelectedDayKey(null); }}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Zap size={16} /> CapEx Forecasting
        </button>
        {sandboxRows.length > 0 && (
          <button 
            type="button"
            className={`tab-btn ${activeView === "sandbox" ? "active" : ""}`}
            onClick={() => { setActiveView("sandbox"); setSelectedDayKey(null); }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--gold, #d97706)", borderColor: "var(--gold-dim)" }}
          >
            <AlertTriangle size={16} /> Import Sandbox ({sandboxRows.length})
          </button>
        )}
      </div>

      {activeView === "inventory" && (
        <div className="search-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap" }}>
            <input
              className="search-input"
              type="text"
              placeholder="Search assets by tag, name, serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 200 }}
            />
            <select
              className="form-select"
              style={{ width: 150 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              className="form-select"
              style={{ width: 140 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {Object.entries(ASSET_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            
            <select
              className="form-select"
              style={{ width: 155 }}
              value={deploymentFilter}
              onChange={(e) => setDeploymentFilter(e.target.value)}
            >
              <option value="all">All Deployments</option>
              <option value="retail">Retail Field Assets</option>
              <option value="office">Office Corporate</option>
            </select>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={dormantFilterOnly}
                onChange={(e) => setDormantFilterOnly(e.target.checked)}
              />
              <span className="muted">Dormant Only (&gt;6M)</span>
            </label>

            <select
              className="form-select"
              style={{ width: 170 }}
              value={activeWaveFilter}
              onChange={(e) => {
                setActiveWaveFilter(e.target.value);
                setWaveStatusFilter("all");
              }}
            >
              <option value="all">All Assets (No Wave)</option>
              {waveOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {activeWaveFilter !== "all" && (
              <select
                className="form-select"
                style={{ width: 160 }}
                value={waveStatusFilter}
                onChange={(e) => setWaveStatusFilter(e.target.value)}
              >
                <option value="all">All Reconciliation</option>
                <option value="verified">Verified Only</option>
                <option value="pending">Pending Only</option>
              </select>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }} title="Avery 5163 layout: 10 labels per sheet (2x5 layout). Compatible with Avery 5163, 5263, 5963, 8163, 8463, 8663, and 18663.">
              <span style={{ fontSize: "12px", color: "#64748b" }}>Style:</span>
              <select
                className="form-select"
                style={{ width: 145, fontSize: "13px", height: "35px", padding: "4px 8px" }}
                value={printStyle}
                onChange={(e) => setPrintStyle(e.target.value)}
              >
                <option value="barcode">Barcode (Code 39)</option>
                <option value="qrcode">QR Code (2D Link)</option>
              </select>
            </div>

            {selectedAssetIds.size === 0 ? (
              <button 
                className="btn btn-secondary" 
                disabled 
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "not-allowed", opacity: 0.6 }}
                title="Select assets first to print tags"
              >
                <FileText size={15} /> Print Tags (0)
              </button>
            ) : (
              <a 
                href={`/api/assets/print-tags?ids=${Array.from(selectedAssetIds).join(",")}&style=${printStyle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary" 
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
                title="Print tags for selected assets"
              >
                <FileText size={15} /> Print Tags ({selectedAssetIds.size})
              </a>
            )}

            <button 
              className="btn btn-secondary" 
              onClick={() => setShowBatchModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "var(--blue, #1d4ed8)", color: "white", border: "none" }}
            >
              <Upload size={15} /> Batch Photo-Audit
            </button>

            <button 
              className="btn btn-secondary" 
              onClick={() => { fetchBatchHistory(); setShowBatchHistoryModal(true); }}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <ClipboardList size={15} /> Upload History
            </button>

            <button className="btn btn-secondary" onClick={handleDownloadTemplate} title="Download CSV Import Template" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <FileText size={15} /> Template
            </button>
            <button className="btn btn-secondary" onClick={handleExportCsv} title="Export Assets to CSV" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Download size={15} /> Export CSV
            </button>
            <label className="btn btn-secondary" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }} title="Import Assets from CSV">
              {uploading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Import CSV
                </>
              )}
              <input type="file" accept=".csv" onChange={handleImportCsv} style={{ display: "none" }} disabled={uploading} />
            </label>

            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + Register Asset
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {activeView === "inventory" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="card" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={paginatedFiltered.length > 0 && paginatedFiltered.every(a => selectedAssetIds.has(a.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSet = new Set(selectedAssetIds);
                            paginatedFiltered.forEach(a => newSet.add(a.id));
                            setSelectedAssetIds(newSet);
                          } else {
                            const newSet = new Set(selectedAssetIds);
                            paginatedFiltered.forEach(a => newSet.delete(a.id));
                            setSelectedAssetIds(newSet);
                          }
                        }}
                      />
                    </th>
                    <th>Asset Tag</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Serial Number</th>
                    <th>Value</th>
                    {activeWaveFilter === "all" ? <th>Checkout Assignment</th> : <th>Verification Status</th>}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFiltered.map((a) => {
                    const lifecycle = getAssetStatusDetails(a);
                    return (
                      <tr key={a.id} className="cursor-pointer" onClick={() => setSelectedAsset(a)}>
                        <td onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                          <input 
                            type="checkbox" 
                            checked={selectedAssetIds.has(a.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedAssetIds);
                              if (e.target.checked) {
                                newSet.add(a.id);
                              } else {
                                newSet.delete(a.id);
                              }
                              setSelectedAssetIds(newSet);
                            }}
                          />
                        </td>
                        <td style={{ fontWeight: 600 }}>{a.assetTag}</td>
                        <td>
                          <div>{a.name}</div>
                          {lifecycle.isEol && (
                            <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "3px", background: "rgba(220, 53, 69, 0.15)", color: "#e63946", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                              <AlertTriangle size={10} /> EOL
                            </span>
                          )}
                          {lifecycle.isNearingEol && (
                            <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "3px", background: "rgba(247, 127, 0, 0.15)", color: "#f77f00", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                              <AlertTriangle size={10} /> Nearing EOL
                            </span>
                          )}
                        </td>
                        <td className="muted">{CATEGORIES[a.category] || a.category}</td>
                        <td className="muted">{a.serialNumber || "—"}</td>
                        <td>{a.value ? `$${parseFloat(a.value).toLocaleString()}` : "—"}</td>
                        {activeWaveFilter === "all" ? (
                          <td className="muted">{a.assignedTo?.name || "Available in Stock"}</td>
                        ) : (
                          <td onClick={(e) => e.stopPropagation()}>
                            {reconciliationData[a.id] ? (
                              <div>
                                {reconciliationData[a.id].verificationStatus === "presence_verified" ? (
                                  <span className="badge badge-warning" style={{ background: "#d97706", color: "white", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", padding: "2px 6px" }} title="Hardware presence verified via GPS coordinate match, individual tag scan pending">
                                    <CheckCircle size={10} /> Presence Verified
                                  </span>
                                ) : (
                                  <span className="badge badge-active" style={{ background: "#16a34a", color: "white", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", padding: "2px 6px" }}>
                                    <CheckCircle size={10} /> Verified
                                  </span>
                                )}
                                <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px" }}>
                                  {new Date(reconciliationData[a.id].auditedAt).toLocaleDateString()} by {reconciliationData[a.id].userName}
                                  {reconciliationData[a.id].latitude && reconciliationData[a.id].longitude && (
                                    <a 
                                      href={`https://www.google.com/maps/search/?api=1&query=${reconciliationData[a.id].latitude},${reconciliationData[a.id].longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ marginLeft: "6px", color: "var(--blue)", textDecoration: "underline" }}
                                    >
                                      Maps
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="badge badge-danger" style={{ background: "#dc2626", color: "white", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", padding: "2px 6px" }}>
                                <X size={10} /> Pending
                              </span>
                            )}
                          </td>
                        )}
                        <td>
                          <span className={`badge badge-${a.status === "available" ? "active" : a.status === "assigned" ? "submitted" : a.status === "repair" ? "draft" : "retired"}`}>
                            {ASSET_STATUSES[a.status] || a.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: 24 }} className="muted">
                        No physical/IT assets found in inventory.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filtered.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", border: "1px solid var(--border)", background: "var(--surface-3)", flexWrap: "wrap", gap: 12, borderRadius: 8 }}>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Showing {Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filtered.length, currentPage * pageSize)} of {filtered.length.toLocaleString()} assets
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Page Size:</span>
                  <select
                    className="form-select"
                    style={{ width: 80, padding: "4px 8px", height: "auto", fontSize: "13px" }}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    First
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    Prev
                  </button>
                  
                  {(() => {
                    const totalPages = Math.ceil(filtered.length / pageSize);
                    const pages = [];
                    const maxPageButtons = 5;
                    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
                    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
                    if (endPage - startPage + 1 < maxPageButtons) {
                      startPage = Math.max(1, endPage - maxPageButtons + 1);
                    }
                    for (let p = startPage; p <= endPage; p++) {
                      pages.push(p);
                    }
                    return (
                      <>
                        {startPage > 1 && <span className="muted" style={{ alignSelf: "center", padding: "0 4px" }}>...</span>}
                        {pages.map(p => (
                          <button
                            key={p}
                            type="button"
                            className={`btn btn-sm ${currentPage === p ? "btn-primary" : "btn-secondary"}`}
                            style={currentPage === p ? { backgroundColor: "var(--blue)", borderColor: "var(--blue)", color: "white" } : {}}
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </button>
                        ))}
                        {endPage < totalPages && <span className="muted" style={{ alignSelf: "center", padding: "0 4px" }}>...</span>}
                      </>
                    );
                  })()}

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage >= Math.ceil(filtered.length / pageSize)}
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filtered.length / pageSize), prev + 1))}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage >= Math.ceil(filtered.length / pageSize)}
                    onClick={() => setCurrentPage(Math.ceil(filtered.length / pageSize))}
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeView === "planner" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* KPI Cards Row */}
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              <div className="kpi-card kpi-purple">
                <div className="kpi-label">Expired / EOL Assets</div>
                <div className="kpi-value">{plannerKpis.eolCount}</div>
                <div className="kpi-subtitle">Requires immediate replacement</div>
              </div>
              <div className="kpi-card kpi-gold">
                <div className="kpi-label">Nearing EOL (&lt; 6 Mos)</div>
                <div className="kpi-value">{plannerKpis.criticalCount}</div>
                <div className="kpi-subtitle">Needs replacement cycles soon</div>
              </div>
              <div className="kpi-card kpi-blue">
                <div className="kpi-label">Total Replacement Value</div>
                <div className="kpi-value">${plannerKpis.replacementCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="kpi-subtitle">Estimated cycle budget</div>
              </div>
            </div>

            {/* Planner Sub-Bar */}
            <div className="search-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Lifecycle Filter:</span>
                <select
                  className="form-select"
                  value={lifeLeftFilter}
                  onChange={(e) => { setLifeLeftFilter(e.target.value); setSelectedDayKey(null); }}
                  style={{ width: 220 }}
                >
                  <option value="all">All Remaining Lifespans</option>
                  <option value="expired">Expired / EOL (Overdue)</option>
                  <option value="6_months">Critical (&lt; 6 Mos remaining)</option>
                  <option value="12_months">Plan Needed (&lt; 1 Year remaining)</option>
                  <option value="24_months">Nearing Cycle (&lt; 2 Years remaining)</option>
                </select>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSyncEolToBudget}
                disabled={syncingBudget}
                style={{ backgroundColor: "var(--gold)", border: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {syncingBudget ? (
                  <>
                    <svg className="animate-spin" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', fill: 'none', stroke: 'currentColor', strokeWidth: '3px' }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" opacity="0.25" />
                      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" stroke="none" />
                    </svg>
                    Syncing...
                  </>
                ) : (
                  <>
                    <Zap size={14} /> Sync EOL Cycle Costs to IT Budget
                  </>
                )}
              </button>
            </div>

            {/* Split Calendar & Replacement List */}
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              {/* Calendar Grid */}
              <div className="card" style={{ flex: "1 1 55%", padding: 16 }}>
                {/* Calendar Header with Navigation */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                    {new Date(currentYear, currentMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </h3>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                      setSelectedDayKey(null);
                      if (currentMonth === 0) {
                        setCurrentMonth(11);
                        setCurrentYear(currentYear - 1);
                      } else {
                        setCurrentMonth(currentMonth - 1);
                      }
                    }}>◀</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                      setSelectedDayKey(null);
                      setCurrentMonth(new Date().getMonth());
                      setCurrentYear(new Date().getFullYear());
                    }}>Today</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                      setSelectedDayKey(null);
                      if (currentMonth === 11) {
                        setCurrentMonth(0);
                        setCurrentYear(currentYear + 1);
                      } else {
                        setCurrentMonth(currentMonth + 1);
                      }
                    }}>▶</button>
                  </div>
                </div>

                {/* Calendar Grid cells */}
                <div style={calendarGridStyle}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                    <div key={day} style={headerCellStyle}>{day}</div>
                  ))}
                  {(() => {
                    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
                    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
                    const prevMonthDays = currentMonth === 0 ? getDaysInMonth(11, currentYear - 1) : getDaysInMonth(currentMonth - 1, currentYear);
                    const calendarCells = [];

                    for (let i = firstDay - 1; i >= 0; i--) {
                      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
                      const m = currentMonth === 0 ? 11 : currentMonth - 1;
                      const d = prevMonthDays - i;
                      calendarCells.push({ day: d, month: m, year: y, isCurrentMonth: false });
                    }
                    for (let i = 1; i <= daysInMonth; i++) {
                      calendarCells.push({ day: i, month: currentMonth, year: currentYear, isCurrentMonth: true });
                    }
                    const remainingCells = 42 - calendarCells.length;
                    for (let i = 1; i <= remainingCells; i++) {
                      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
                      const m = currentMonth === 11 ? 0 : currentMonth + 1;
                      calendarCells.push({ day: i, month: m, year: y, isCurrentMonth: false });
                    }

                    return calendarCells.map((cell, idx) => {
                      const dateKey = formatDateKey(cell.year, cell.month, cell.day);
                      const dateData = assetsByDate[dateKey] || { eol: [], disposal: [] };
                      const isSelected = selectedDayKey === dateKey;
                      const isToday = new Date().getDate() === cell.day && new Date().getMonth() === cell.month && new Date().getFullYear() === cell.year;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedDayKey(isSelected ? null : dateKey)}
                          style={getDayCellStyle(cell.isCurrentMonth, isSelected, isToday)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ 
                              fontWeight: isToday ? 700 : 500, 
                              fontSize: 11, 
                              color: isToday ? "var(--blue)" : "var(--text-secondary)" 
                            }}>{cell.day}</span>
                            {isToday && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--blue)" }} />}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4, overflow: "hidden" }}>
                            {dateData.eol.map(a => (
                              <div key={a.id} style={{ 
                                fontSize: 9, 
                                padding: "1px 3px", 
                                borderRadius: 3, 
                                background: "var(--red-dim)", 
                                color: "var(--red)", 
                                border: "1px solid rgba(239, 71, 111, 0.2)",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                gap: "2px"
                              }} title={`${a.assetTag}: ${a.name} EOL`}>
                                <AlertTriangle size={8} /> {a.assetTag}
                              </div>
                            ))}
                            {dateData.disposal.map(a => (
                              <div key={a.id} style={{ 
                                fontSize: 9, 
                                padding: "1px 3px", 
                                borderRadius: 3, 
                                background: "var(--purple-dim)", 
                                color: "var(--purple)", 
                                border: "1px solid rgba(123, 104, 238, 0.2)",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                gap: "2px"
                              }} title={`${a.assetTag}: Scheduled Disposal`}>
                                <ArrowRight size={8} /> {a.assetTag}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Replacements Detail Pane */}
              <div className="card" style={{ flex: "1 1 45%", padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 12 }}>
                  {selectedDayKey ? `Timeline for ${new Date(selectedDayKey + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : `Monthly Summary: ${new Date(currentYear, currentMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
                </h3>

                <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                  {(() => {
                    const list = selectedDayKey 
                      ? [
                          ...(assetsByDate[selectedDayKey]?.eol.map(a => ({ asset: a, type: "eol" })) || []),
                          ...(assetsByDate[selectedDayKey]?.disposal.map(a => ({ asset: a, type: "disposal" })) || [])
                        ]
                      : selectedMonthAssets.map(a => {
                          const eolDate = getAssetUsefulLifeEndDate(a);
                          const isEol = eolDate && eolDate.getMonth() === currentMonth && eolDate.getFullYear() === currentYear;
                          return { asset: a, type: isEol ? "eol" : "disposal" };
                        });

                    if (list.length === 0) {
                      return (
                        <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
                          No replacements or disposals mapped for this period.
                        </div>
                      );
                    }

                    return list.map(({ asset, type }) => {
                      const end = getAssetUsefulLifeEndDate(asset);
                      const rem = getAssetRemainingMonths(asset);
                      return (
                        <div 
                          key={asset.id} 
                          className="cursor-pointer"
                          onClick={() => setSelectedAsset(asset)}
                          style={{ 
                            padding: 12, 
                            borderRadius: 6, 
                            border: "1px solid var(--border)", 
                            background: "var(--surface-3)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 600 }}>{asset.assetTag}</span>
                              <span style={{ 
                                fontSize: 10, 
                                padding: "1px 5px", 
                                borderRadius: 3, 
                                fontWeight: 600,
                                background: type === "eol" ? "var(--red-dim)" : "var(--purple-dim)",
                                color: type === "eol" ? "var(--red)" : "var(--purple)"
                              }}>
                                {type === "eol" ? "EOL Expiry" : "Disposal"}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, marginTop: 2 }}>{asset.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                              {type === "eol" 
                                ? `Useful Life End: ${end?.toLocaleDateString()}` 
                                : `Disposal Date: ${asset.disposalDate ? new Date(asset.disposalDate).toLocaleDateString() : "—"}`}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 600 }}>{asset.value ? `$${parseFloat(asset.value).toLocaleString()}` : "—"}</div>
                            <div style={{ fontSize: 11, color: rem <= 0 ? "var(--red)" : "var(--text-secondary)" }}>
                              {rem <= 0 ? "Expired" : `${Math.ceil(rem)} mos left`}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        ) : activeView === "forecasting" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Top Stats Cards */}
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              <div className="kpi-card kpi-blue">
                <div className="kpi-label">10-Year Projected Capital (Adjusted)</div>
                <div className="kpi-value">
                  ${forecastingData.reduce((sum, d) => sum + d.inflatedCost, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="kpi-subtitle">
                  Flat CapEx: ${forecastingData.reduce((sum, d) => sum + d.cost, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="kpi-card kpi-purple">
                <div className="kpi-label">Total Assets in Cycle</div>
                <div className="kpi-value">
                  {forecastingData.reduce((sum, d) => sum + d.count, 0).toLocaleString()}
                </div>
                <div className="kpi-subtitle">Equipment requiring lifecycle refreshes</div>
              </div>
              <div className="kpi-card kpi-gold">
                <div className="kpi-label">Current Backlog (Overdue)</div>
                <div className="kpi-value">
                  ${(forecastingData.find(d => d.year === new Date().getFullYear())?.inflatedCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="kpi-subtitle">Past EOL backlog requirements</div>
              </div>
            </div>

            {/* Timelines Visualizer Card */}
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "600", color: "var(--text)", margin: 0 }}>
                    10-Year Lifecycle Replacement Timeline (Inflation Adjusted)
                  </h3>
                  <p className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>
                    Select a year bar below to view details and list individual assets.
                  </p>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
                      Annual Inflation Rate:
                    </label>
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.1"
                        value={inflationRate}
                        onChange={(e) => setInflationRate(Math.max(0, parseFloat(e.target.value) || 0))}
                        style={{
                          width: "70px",
                          padding: "4px 20px 4px 8px",
                          fontSize: "12px",
                          fontWeight: "600",
                          background: "var(--surface-3)",
                          border: "1px solid var(--border)",
                          borderRadius: "4px",
                          color: "var(--text)",
                          textAlign: "right"
                        }}
                      />
                      <span style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "var(--text-secondary)", pointerEvents: "none" }}>
                        %
                      </span>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", fontSize: "12px" }}
                    onClick={() => {
                      const tenYearAssets = assets.filter(a => {
                        if (forecastingCategoryFilter !== "all" && a.category !== forecastingCategoryFilter) return false;
                        const eolDate = getAssetUsefulLifeEndDate(a);
                        return !!eolDate;
                      });
                      handleExportForecastingCsv(tenYearAssets, `stochos_expiring_assets_10year_${forecastingCategoryFilter}.csv`);
                    }}
                    title="Download all assets in the 10-year timeline matching the current filter"
                  >
                    <Download size={14} /> Export 10-Year Timeline
                  </button>
                </div>
              </div>

              {/* Equipment Type Category Filter Navigation */}
              <div className="tab-nav" style={{ display: "flex", gap: "4px", overflowX: "auto", borderBottom: "1px solid var(--border)", paddingBottom: "2px", marginBottom: "20px" }}>
                <button
                  type="button"
                  className={`tab-btn ${forecastingCategoryFilter === "all" ? "active" : ""}`}
                  onClick={() => setForecastingCategoryFilter("all")}
                  style={{ padding: "8px 12px", fontSize: "12px" }}
                >
                  All Equipment
                </button>
                {Object.entries(CATEGORIES).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`tab-btn ${forecastingCategoryFilter === key ? "active" : ""}`}
                    onClick={() => setForecastingCategoryFilter(key)}
                    style={{ padding: "8px 12px", fontSize: "12px" }}
                  >
                    {label}s
                  </button>
                ))}
              </div>
              
              <div style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                height: "200px",
                paddingBottom: "10px",
                borderBottom: "1px solid var(--border)",
                gap: "12px",
                margin: "0 10px 10px 10px"
              }}>
                {forecastingData.map((d) => {
                  const maxVal = Math.max(...forecastingData.map(y => y.inflatedCost), 1);
                  const pct = (d.inflatedCost / maxVal) * 100;
                  const isSelected = selectedForecastYear === d.year;
                  const isCurrent = d.year === new Date().getFullYear();
                  
                  return (
                    <div 
                      key={d.year} 
                      onClick={() => setSelectedForecastYear(d.year)}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        height: "100%",
                        justifyContent: "flex-end",
                        position: "relative"
                      }}
                    >
                      <div style={{
                        position: "absolute",
                        top: "-24px",
                        background: "var(--surface-3)",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        padding: "1px 4px",
                        fontSize: "9px",
                        whiteSpace: "nowrap",
                        color: "var(--text)",
                        opacity: isSelected ? 1 : 0.7
                      }}>
                        ${(d.inflatedCost / 1000000).toFixed(1)}M
                      </div>

                      <div style={{
                        width: "100%",
                        maxWidth: "50px",
                        height: `${Math.max(6, pct)}%`,
                        background: isSelected 
                          ? "linear-gradient(180deg, var(--blue) 0%, rgba(59, 130, 246, 0.4) 100%)" 
                          : isCurrent 
                            ? "linear-gradient(180deg, var(--gold) 0%, rgba(245, 158, 11, 0.3) 100%)"
                            : "linear-gradient(180deg, var(--border) 0%, var(--surface-3) 100%)",
                        border: isSelected 
                          ? "1px solid var(--blue)" 
                          : isCurrent 
                            ? "1px solid var(--gold)" 
                            : "1px solid var(--border-dim)",
                        borderRadius: "4px 4px 0 0",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? "0 0 8px rgba(59, 130, 246, 0.4)" : "none"
                      }} />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", margin: "0 10px" }}>
                {forecastingData.map((d) => (
                  <div 
                    key={d.year} 
                    onClick={() => setSelectedForecastYear(d.year)}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: selectedForecastYear === d.year ? "700" : "500",
                      color: selectedForecastYear === d.year ? "var(--text)" : "var(--text-secondary)",
                      cursor: "pointer",
                      padding: "4px 0",
                      borderRadius: "4px",
                      background: selectedForecastYear === d.year ? "var(--surface-3)" : "transparent"
                    }}
                  >
                    {d.year}
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Forecast Details */}
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <div className="card" style={{ flex: "1 1 55%", padding: "20px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Replacement Category Details: {selectedForecastYear}</span>
                  <span style={{ fontSize: "12px", fontWeight: "normal", color: "var(--text-secondary)" }}>
                    Selected Year Capital (Inflated): ${ (forecastingData.find(d => d.year === selectedForecastYear)?.inflatedCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) }
                  </span>
                </h4>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Assets Expiring</th>
                      <th>Flat CapEx Cost</th>
                      <th>Projected Cost ({inflationRate}%)</th>
                      <th>% of Year Capital</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const yearData = forecastingData.find(d => d.year === selectedForecastYear);
                      if (!yearData) return null;
                      const yearTotalCost = yearData.inflatedCost || 1;

                      const renderedRows = Object.entries(yearData.categories)
                        .filter(([catKey]) => forecastingCategoryFilter === "all" || catKey === forecastingCategoryFilter)
                        .map(([catKey, data]) => {
                          const pctOfTotal = ((data.inflatedCost / yearTotalCost) * 100).toFixed(1);
                          return (
                            <tr key={catKey}>
                              <td style={{ fontWeight: 600 }}>{CATEGORIES[catKey] || catKey}</td>
                              <td>{data.count}</td>
                              <td>${data.cost.toLocaleString()}</td>
                              <td style={{ color: "var(--blue)", fontWeight: "600" }}>${Math.round(data.inflatedCost).toLocaleString()}</td>
                              <td className="muted">{pctOfTotal}%</td>
                            </tr>
                          );
                        });

                      if (renderedRows.length === 0) {
                        return (
                          <tr>
                            <td colSpan="5" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                              No expiring assets for the selected category.
                            </td>
                          </tr>
                        );
                      }
                      return renderedRows;
                    })()}
                  </tbody>
                </table>
              </div>

              <div className="card" style={{ flex: "1 1 38%", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)" }}>Lifecycle Analysis &amp; Guidelines</h4>
                <div style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--text-secondary)" }}>
                  <p>
                    Capital Expenditure (CapEx) projections are dynamically computed using the acquisition date and estimated useful lifespan of each hardware component.
                  </p>
                  <blockquote style={{ borderLeft: "3px solid var(--blue)", paddingLeft: "12px", margin: "12px 0", fontStyle: "italic" }}>
                    Formula: <code style={{ fontFamily: "monospace", fontSize: "12px" }}>Useful Life End = Purchase Date + Useful Life (Months)</code>
                  </blockquote>
                  <p>
                    <strong>Backlog Backfill Strategy:</strong> All hardware assets that have currently exceeded their useful life term are grouped under the current year ({new Date().getFullYear()}) as immediate backfill requirements. This explains large capital spikes in the current year.
                  </p>
                  <p>
                    <strong>IT Budget Synchronization:</strong> Use the "Replacement Planner" tab to automatically push EOL hardware values directly into the active GFPA Division Proposal for approval.
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Assets Expiring Table */}
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)", margin: 0 }}>
                  Detailed Assets Expiring in {selectedForecastYear} ({selectedYearAssets.length} Items)
                </h4>
                {selectedYearAssets.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", fontSize: "12px" }}
                    onClick={() => handleExportForecastingCsv(selectedYearAssets, `stochos_expiring_assets_${selectedForecastYear}_${forecastingCategoryFilter}.csv`)}
                    title="Download list of expiring assets in selected year as CSV"
                  >
                    <Download size={14} /> Export Selected Year CSV
                  </button>
                )}
              </div>

              {selectedYearAssets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--text-secondary)", fontSize: "13px" }}>
                  No hardware assets are scheduled to reach the end of their useful life in {selectedForecastYear}.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ marginBottom: "10px" }}>
                    <thead>
                      <tr>
                        <th>Asset Tag</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Serial Number</th>
                        <th>Status</th>
                        <th>Location</th>
                        <th>Useful Life End</th>
                        <th style={{ textAlign: "right" }}>Flat Cost</th>
                        <th style={{ textAlign: "right" }}>Inflated Cost ({inflationRate}%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedForecastAssets.map(a => {
                        const eolDate = a._eolDate;
                        const locationName = a._locationName;
                        const flatCost = a.value ? parseFloat(a.value) : 0;
                        const n = Math.max(0, selectedForecastYear - new Date().getFullYear());
                        const inflatedCost = flatCost * Math.pow(1 + (inflationRate / 100), n);
                        
                        return (
                          <tr key={a.id} className="hover-row">
                            <td style={{ fontWeight: 600 }}>
                              <span 
                                onClick={() => setSelectedAsset(a)} 
                                style={{ color: "var(--blue)", cursor: "pointer", textDecoration: "underline" }}
                              >
                                {a.assetTag}
                              </span>
                            </td>
                            <td>{a.name}</td>
                            <td>{CATEGORIES[a.category] || a.category}</td>
                            <td className="muted">{a.serialNumber || "—"}</td>
                            <td>
                              <span className={`badge badge-${a.status === "available" ? "passed" : a.status === "repair" ? "warning" : a.status === "retired" ? "failed" : "draft"}`}>
                                {ASSET_STATUSES[a.status] || a.status}
                              </span>
                            </td>
                            <td>{locationName}</td>
                            <td>{eolDate ? eolDate.toISOString().split("T")[0] : "—"}</td>
                            <td style={{ textAlign: "right", fontFamily: "var(--font-mono, monospace)" }}>
                              ${flatCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "var(--font-mono, monospace)", color: "var(--blue)", fontWeight: "600" }}>
                              ${inflatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Forecast List Pagination Controls */}
                  {selectedYearAssets.length > forecastPageSize && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", padding: "10px 0", borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: "10px" }}>
                      <div className="muted" style={{ fontSize: "13px" }}>
                        Showing {(forecastPage - 1) * forecastPageSize + 1} to {Math.min(forecastPage * forecastPageSize, selectedYearAssets.length)} of {selectedYearAssets.length} expiring items
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          disabled={forecastPage === 1}
                          onClick={() => setForecastPage(1)}
                        >
                          First
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          disabled={forecastPage === 1}
                          onClick={() => setForecastPage(prev => Math.max(1, prev - 1))}
                        >
                          Prev
                        </button>
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "0 10px", fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>
                          Page {forecastPage} of {Math.ceil(selectedYearAssets.length / forecastPageSize)}
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          disabled={forecastPage === Math.ceil(selectedYearAssets.length / forecastPageSize)}
                          onClick={() => setForecastPage(prev => Math.min(Math.ceil(selectedYearAssets.length / forecastPageSize), prev + 1))}
                        >
                          Next
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          disabled={forecastPage === Math.ceil(selectedYearAssets.length / forecastPageSize)}
                          onClick={() => setForecastPage(Math.ceil(selectedYearAssets.length / forecastPageSize))}
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Header controls for Sandbox */}
            <div className="card" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={18} style={{ color: "var(--gold)" }} /> CSV Import Validation Sandbox
                </h3>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Correct invalid inputs directly in the grid below. Red borders (⚠️) indicate validation errors. Double-click any cell to edit.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ backgroundColor: "var(--green, #16a34a)", borderColor: "var(--green, #16a34a)", display: "inline-flex", alignItems: "center", gap: 6 }}
                  onClick={handleCommitSandbox}
                  disabled={saving || sandboxRows.some(r => !r.isValid)}
                  title={sandboxRows.some(r => !r.isValid) ? "Please resolve all errors in the grid first" : "Commit clean spreadsheet records to database"}
                >
                  <CheckCircle size={16} /> Commit Import ({sandboxRows.length} Rows)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (confirm("Are you sure you want to discard this sandbox? All corrected edits will be lost.")) {
                      setSandboxRows([]);
                      setActiveView("inventory");
                    }
                  }}
                  disabled={saving}
                >
                  Discard &amp; Exit
                </button>
              </div>
            </div>

            {/* Spreadsheet Sandbox Grid */}
            <div className="card" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ fontSize: "12px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-3)" }}>
                    <th style={{ width: 60, padding: "8px" }}>Row</th>
                    <th style={{ width: 50, padding: "8px" }}>Status</th>
                    <th style={{ padding: "8px" }}>Asset Tag</th>
                    <th style={{ padding: "8px" }}>Name</th>
                    <th style={{ padding: "8px" }}>Category</th>
                    <th style={{ padding: "8px" }}>Serial Number</th>
                    <th style={{ padding: "8px" }}>Value</th>
                    <th style={{ padding: "8px" }}>Assigned Email</th>
                    <th style={{ padding: "8px" }}>Jurisdiction</th>
                    <th style={{ padding: "8px" }}>Status</th>
                    <th style={{ padding: "8px" }}>Purchase Date</th>
                    <th style={{ padding: "8px" }}>Useful Life (Mos)</th>
                    <th style={{ padding: "8px" }}>Deployment</th>
                    <th style={{ padding: "8px" }}>Retailer ID</th>
                    <th style={{ padding: "8px" }}>Org Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSandboxRows.map((row) => {
                    const rowIndex = sandboxRows.indexOf(row);
                    return (
                      <tr key={rowIndex} style={{ background: row.isValid ? "transparent" : "rgba(220, 38, 38, 0.02)" }}>
                        <td style={{ fontWeight: 600, textAlign: "center", color: "var(--text-secondary)", borderRight: "1px solid var(--border)" }}>
                          {row.rowNumber}
                        </td>
                        <td style={{ textAlign: "center", borderRight: "1px solid var(--border)" }}>
                          {row.isValid ? (
                            <span style={{ color: "var(--green)" }} title="Valid row ready for commit">✔️</span>
                          ) : (
                            <span style={{ color: "#ef4444", fontWeight: "bold" }} title="Row contains validation errors">⚠️</span>
                          )}
                        </td>
                        
                        {renderSandboxCell(row, rowIndex, "assetTag")}
                        {renderSandboxCell(row, rowIndex, "name")}
                        {renderSandboxCell(row, rowIndex, "category", "text", CATEGORIES)}
                        {renderSandboxCell(row, rowIndex, "serialNumber")}
                        {renderSandboxCell(row, rowIndex, "value", "number")}
                        {renderSandboxCell(row, rowIndex, "assignedEmployeeEmail")}
                        {renderSandboxCell(row, rowIndex, "jurisdiction")}
                        {renderSandboxCell(row, rowIndex, "status", "text", ASSET_STATUSES)}
                        {renderSandboxCell(row, rowIndex, "purchaseDate", "date")}
                        {renderSandboxCell(row, rowIndex, "usefulLifeMonths", "number")}
                        {renderSandboxCell(row, rowIndex, "deploymentType", "text", { retail: "Retail", office: "Office" })}
                        {renderSandboxCell(row, rowIndex, "retailerId")}
                        {renderSandboxCell(row, rowIndex, "orgUnit")}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sandbox Pagination */}
            {sandboxRows.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", border: "1px solid var(--border)", background: "var(--surface-3)", borderRadius: "8px" }}>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Showing {Math.min(sandboxRows.length, (sandboxPage - 1) * sandboxPageSize + 1)}-{Math.min(sandboxRows.length, sandboxPage * sandboxPageSize)} of {sandboxRows.length.toLocaleString()} sandbox rows ({sandboxRows.filter(r => !r.isValid).length} errors pending)
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={sandboxPage === 1}
                    onClick={() => setSandboxPage(1)}
                  >
                    First
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={sandboxPage === 1}
                    onClick={() => setSandboxPage(prev => Math.max(1, prev - 1))}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={sandboxPage >= Math.ceil(sandboxRows.length / sandboxPageSize)}
                    onClick={() => setSandboxPage(prev => Math.min(Math.ceil(sandboxRows.length / sandboxPageSize), prev + 1))}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={sandboxPage >= Math.ceil(sandboxRows.length / sandboxPageSize)}
                    onClick={() => setSandboxPage(Math.ceil(sandboxRows.length / sandboxPageSize))}
                  >
                    Last
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Selected Asset Profile Drawer */}
        {selectedAsset && (() => {
          const lifecycle = getAssetStatusDetails(selectedAsset);
          return (
            <div className="card" style={{ width: 340, flexShrink: 0 }}>
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>Asset Profile</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedAsset(null)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px" }}><X size={14} /></button>
              </div>
              <div className="card-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
                {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
                <form onSubmit={handleUpdateAsset}>
                  <div className="form-group">
                    <label className="form-label">Asset Tag / ID</label>
                    <input name="assetTag" className="form-input" required defaultValue={selectedAsset.assetTag} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Asset Name</label>
                    <input name="name" className="form-input" required defaultValue={selectedAsset.name} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select name="category" className="form-select" defaultValue={selectedAsset.category}>
                        {Object.entries(CATEGORIES).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valuation ($)</label>
                      <input name="value" type="number" step="0.01" className="form-input" defaultValue={selectedAsset.value || ""} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Serial Number</label>
                    <input name="serialNumber" className="form-input" defaultValue={selectedAsset.serialNumber || ""} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Employee Checkout</label>
                      <select name="assignedToId" className="form-select" defaultValue={selectedAsset.assignedToId || ""}>
                        <option value="">Available (In Stock)</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select name="status" className="form-select" defaultValue={selectedAsset.status}>
                        <option value="available">Available</option>
                        <option value="assigned">Assigned</option>
                        <option value="repair">In Repair</option>
                        <option value="retired">Retired</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input name="purchaseDate" type="date" className="form-input" defaultValue={selectedAsset.purchaseDate ? selectedAsset.purchaseDate.split('T')[0] : ""} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea name="notes" className="form-input" rows="2" defaultValue={selectedAsset.notes || ""} style={{ width: "100%", background: "var(--surface-overlay)", color: "var(--text)" }} />
                  </div>

                  {/* Lifecycle & Valuation Fields */}
                  <div style={{ margin: "16px 0 8px 0", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--primary)", marginBottom: 8 }}>Lifecycle & Valuation</h4>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Useful Life (Mos)</label>
                      <input name="usefulLifeMonths" type="number" className="form-input" defaultValue={selectedAsset.usefulLifeMonths ?? 36} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Disposal Method</label>
                      <select name="disposalMethod" className="form-select" defaultValue={selectedAsset.disposalMethod || ""}>
                        <option value="">None</option>
                        <option value="sold">Sold</option>
                        <option value="scrapped">Scrapped</option>
                        <option value="donated">Donated</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Disposal Date</label>
                      <input name="disposalDate" type="date" className="form-input" defaultValue={selectedAsset.disposalDate ? selectedAsset.disposalDate.split('T')[0] : ""} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sale / Salvage ($)</label>
                      <input name="salePrice" type="number" step="0.01" className="form-input" placeholder="0.00" defaultValue={selectedAsset.salePrice || ""} />
                    </div>
                  </div>

                  {selectedAsset.value && (
                    <div style={{ background: "var(--surface-overlay)", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", marginTop: 12, fontSize: "11px", lineHeight: "1.4" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span className="muted">Book Value:</span>
                        <span style={{ fontWeight: 600 }}>${parseFloat(lifecycle.bookValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span className="muted">Accum. Depr.:</span>
                        <span>${parseFloat(lifecycle.accumulatedDepreciation).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span className="muted">Monthly Depr.:</span>
                        <span>${parseFloat(lifecycle.monthlyDepreciation).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span className="muted">Age:</span>
                        <span>{lifecycle.monthsAge} months</span>
                      </div>
                      {lifecycle.isEol && (
                        <div style={{ color: "#e63946", fontWeight: 600, marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <AlertTriangle size={15} /> Exceeded Useful Lifecycle Boundaries.
                        </div>
                      )}
                      {lifecycle.isNearingEol && (
                        <div style={{ color: "#f77f00", fontWeight: 600, marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <AlertTriangle size={15} /> Nearing useful lifecycle boundaries.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2" style={{ marginTop: 20 }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Save Changes</button>
                    <a 
                      href={`/api/assets/print-tags?ids=${selectedAsset.id}&style=${printStyle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm" 
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
                    >
                      <FileText size={14} /> Print Tag (PDF)
                    </a>
                    <button type="button" className="btn btn-danger btn-sm" style={{ background: "var(--red)", borderColor: "var(--red)", color: "white" }} onClick={() => handleDeleteAsset(selectedAsset.id)} disabled={saving}>Delete</button>
                  </div>
                </form>

                {/* Photo-Audit Uploader and History */}
                <div style={{ borderTop: "1px solid var(--border)", marginTop: 24, paddingTop: 16 }}>
                  <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--blue)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <ClipboardList size={14} /> Verification Wave Audit History
                  </h4>

                  {/* Drag and Drop Zone */}
                  {!parsedMetadata ? (
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        handlePhotoDrop(file);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: "2px dashed var(--border)",
                        borderRadius: 8,
                        padding: 20,
                        textAlign: "center",
                        cursor: "pointer",
                        background: "var(--surface-3)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                        transition: "border-color 0.15s ease",
                        position: "relative"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--blue)"}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                    >
                      <Upload size={24} style={{ margin: "0 auto 8px auto", color: "var(--blue)" }} />
                      <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Drag geotagged JPEG photo here</p>
                      <p style={{ fontSize: 10 }}>or click to browse local files</p>
                      <p style={{ fontSize: 9, color: "var(--gold)", marginTop: 8, fontStyle: "italic" }}>Note: Photo file is parsed client-side and discarded on save.</p>
                      
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        accept=".jpg,.jpeg" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          handlePhotoDrop(file);
                        }} 
                        style={{ display: "none" }} 
                      />
                    </div>
                  ) : (
                    /* Parsed metadata preview & overrides */
                    <div style={{ background: "var(--surface-overlay)", padding: 12, borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>Import Preview</span>
                        <span style={{ fontSize: 10, color: "var(--text-secondary)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {parsedMetadata.originalFilename}
                        </span>
                      </div>

                      {auditError && (
                        <div style={{ background: "rgba(220, 53, 69, 0.1)", color: "#e63946", padding: 8, borderRadius: 4, marginBottom: 10, fontSize: 11, border: "1px solid rgba(220, 53, 69, 0.2)" }}>
                          {auditError}
                        </div>
                      )}

                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label className="form-label" style={{ fontSize: 10, marginBottom: 2 }}>Audit Date (Taken)</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input 
                            type="date" 
                            className="form-input" 
                            value={parsedMetadata.auditedAt} 
                            onChange={(e) => setParsedMetadata({ ...parsedMetadata, auditedAt: e.target.value })} 
                            required 
                          />
                          {!parsedMetadata.isManual && parsedMetadata.auditedAt && <CheckCircle size={14} style={{ color: "var(--green)" }} title="Verified from EXIF" />}
                        </div>
                      </div>

                      <div className="form-row" style={{ gap: 8, marginBottom: 8 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: 10, marginBottom: 2 }}>Latitude</label>
                          <input 
                            type="number" 
                            step="0.000001" 
                            className="form-input" 
                            placeholder="e.g. 40.7128" 
                            value={parsedMetadata.latitude} 
                            onChange={(e) => setParsedMetadata({ ...parsedMetadata, latitude: e.target.value, isManual: true })} 
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: 10, marginBottom: 2 }}>Longitude</label>
                          <input 
                            type="number" 
                            step="0.000001" 
                            className="form-input" 
                            placeholder="e.g. -74.006" 
                            value={parsedMetadata.longitude} 
                            onChange={(e) => setParsedMetadata({ ...parsedMetadata, longitude: e.target.value, isManual: true })} 
                          />
                        </div>
                      </div>

                      {/* Retailer snap align selector */}
                      {parsedMetadata.latitude && parsedMetadata.longitude && (
                        <div style={{ marginTop: 10, padding: 8, background: "rgba(0, 102, 204, 0.05)", border: "1px solid rgba(0, 102, 204, 0.15)", borderRadius: 4 }}>
                          {fetchingNearby ? (
                            <div className="muted" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                              <RefreshCw size={12} className="animate-spin" /> Querying nearby retail network...
                            </div>
                          ) : nearbyRetailers.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <MapPin size={12} style={{ color: "var(--blue)" }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>Nearby Retailer Detected</span>
                              </div>
                              <select 
                                className="form-select" 
                                value={selectedRetailerId} 
                                onChange={(e) => setSelectedRetailerId(e.target.value)}
                                style={{ padding: "4px 8px", fontSize: 11, height: "auto" }}
                              >
                                <option value="">Keep raw coordinates (don't link)</option>
                                {nearbyRetailers.map(r => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} ({r.distance}m away)
                                  </option>
                                ))}
                              </select>
                              {selectedRetailerId && (
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, cursor: "pointer", marginTop: 2 }}>
                                  <input 
                                    type="checkbox" 
                                    checked={alignToRetailer} 
                                    onChange={(e) => setAlignToRetailer(e.target.checked)} 
                                  />
                                  <span className="muted">Snap to retailer's official coordinates</span>
                                </label>
                              )}
                            </div>
                          ) : (
                            <div className="muted" style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
                              <Info size={12} /> No retailers found within 500m of coordinates.
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2" style={{ marginTop: 12 }}>
                        <button 
                          type="button" 
                          className="btn btn-primary btn-sm" 
                          onClick={handleSaveAudit} 
                          disabled={registeringAudit || !parsedMetadata.auditedAt}
                          style={{ flex: 1, padding: "6px 8px" }}
                        >
                          {registeringAudit ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <RefreshCw size={12} className="animate-spin" /> Saving...
                            </span>
                          ) : "Save & Register Audit"}
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => { setAuditFile(null); setParsedMetadata(null); setNearbyRetailers([]); setSelectedRetailerId(""); setAuditError(""); }}
                          style={{ padding: "6px 8px" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Camera privacy settings guide */}
                  <div style={{ marginTop: 8 }}>
                    <button 
                      type="button" 
                      className="btn btn-link btn-sm"
                      onClick={() => setShowSettingsHelp(!showSettingsHelp)}
                      style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 0", color: "var(--text-secondary)", textDecoration: "underline" }}
                    >
                      <Info size={12} /> DSR Camera Settings Guide (iPhone & Android)
                    </button>
                    
                    {showSettingsHelp && (
                      <div style={{ background: "var(--surface-3)", padding: 10, borderRadius: 6, border: "1px solid var(--border)", fontSize: 11, marginTop: 4, lineHeight: "1.4" }}>
                        <p style={{ fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>Enabling Location for Photo Auditing:</p>
                        <p style={{ fontWeight: 600, color: "var(--blue)", marginTop: 6, marginBottom: 2 }}>iPhone (iOS):</p>
                        <ul style={{ paddingLeft: 14, listStyleType: "disc" }}>
                          <li>Go to <strong>Settings &rarr; Privacy &amp; Security &rarr; Location Services</strong>.</li>
                          <li>Ensure Location Services is enabled.</li>
                          <li>Tap <strong>Camera</strong> and choose <strong>While Using the App</strong>.</li>
                          <li>Turn on <strong>Precise Location</strong>.</li>
                          <li>When emailing photos, send as <strong>Actual Size</strong> to keep metadata.</li>
                        </ul>
                        <p style={{ fontWeight: 600, color: "var(--gold)", marginTop: 6, marginBottom: 2 }}>Android:</p>
                        <ul style={{ paddingLeft: 14, listStyleType: "disc" }}>
                          <li>Open the <strong>Camera App</strong> and tap the gear (Settings) icon.</li>
                          <li>Toggle on <strong>Location tags</strong> or <strong>Save location</strong>.</li>
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Past Verification Logs */}
                  <div style={{ marginTop: 16 }}>
                    <h5 style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                      Verification History
                    </h5>
                    {loadingHistory ? (
                      <div className="muted" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
                        <RefreshCw size={12} className="animate-spin" /> Loading past audit logs...
                      </div>
                    ) : auditHistory.length === 0 ? (
                      <div className="muted" style={{ fontSize: 11, fontStyle: "italic", padding: "8px 0" }}>
                        No past audit verifications logged for this asset.
                      </div>
                    ) : (
                      <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
                        <table className="data-table" style={{ fontSize: 11, margin: 0, border: "none" }}>
                          <thead>
                            <tr style={{ background: "var(--surface-3)" }}>
                              <th style={{ padding: "4px 8px" }}>Date</th>
                              <th style={{ padding: "4px 8px" }}>Verified By</th>
                              <th style={{ padding: "4px 8px" }}>Location</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditHistory.map(log => (
                              <tr key={log.id}>
                                <td style={{ padding: "4px 8px", fontWeight: 500 }}>
                                  {new Date(log.auditedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                </td>
                                <td style={{ padding: "4px 8px" }} className="muted">
                                  {log.user?.name || "System"}
                                  {log.isManual && <span style={{ fontSize: 9, marginLeft: 4, padding: "1px 3px", borderRadius: 2, background: "var(--gold-dim)", color: "var(--gold)" }}>Manual</span>}
                                </td>
                                <td style={{ padding: "4px 8px" }} className="muted">
                                  {log.retailer ? (
                                    <span title={log.retailer.name}>{log.retailer.name}</span>
                                  ) : log.latitude && log.longitude ? (
                                    <a 
                                      href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      style={{ color: "var(--blue)", textDecoration: "underline" }}
                                      title={`${log.latitude}, ${log.longitude}`}
                                    >
                                      Map Pin
                                    </a>
                                  ) : "No location"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Register IT &amp; Physical Asset</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px" }}><X size={14} /></button>
            </div>
            <div className="card-body">
              {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
              <form onSubmit={handleRegisterAsset}>
                <div className="form-group">
                  <label className="form-label">Jurisdiction Owner</label>
                  <select name="jurisdictionId" className="form-select" required>
                    <option value="">Select jurisdiction...</option>
                    {jurisdictions.map((j) => (
                      <option key={j.id} value={j.id}>{j.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Asset Tag (Barcode)</label>
                  <input name="assetTag" className="form-input" required placeholder="e.g. AST-NY-2026-904" />
                </div>
                <div className="form-group">
                  <label className="form-label">Asset Name</label>
                  <input name="name" className="form-input" required placeholder="e.g. MacBook Pro 16-inch M3 Max" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select name="category" className="form-select" required>
                      <option value="">Select category...</option>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Value ($)</label>
                    <input name="value" type="number" step="0.01" className="form-input" placeholder="e.g. 3499.00" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Serial Number</label>
                  <input name="serialNumber" className="form-input" placeholder="e.g. C02F52XSMD6M" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Initial Checkout Assignment</label>
                    <select name="assignedToId" className="form-select">
                      <option value="">Available (In Stock)</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select name="status" className="form-select" defaultValue="available">
                      <option value="available">Available</option>
                      <option value="assigned">Assigned</option>
                      <option value="repair">In Repair</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input name="purchaseDate" type="date" className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Useful Life (Mos)</label>
                    <input name="usefulLifeMonths" type="number" className="form-input" defaultValue="36" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea name="notes" className="form-input" rows="2" style={{ width: "100%", background: "var(--surface-overlay)", color: "var(--text)" }} />
                </div>

                <div className="flex gap-2" style={{ marginTop: 24 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Registering..." : "Register Asset"}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Batch Ingest Modal */}
      {showBatchModal && (
        <div className="modal-backdrop" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 20 }}>
          <div className="modal-content card" style={{ width: "100%", maxWidth: 850, maxHeight: "90vh", display: "flex", flexDirection: "column", background: "var(--card-bg, #0f172a)", border: "1px solid var(--border)", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)", borderRadius: 12, overflow: "hidden" }}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface-3)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Upload size={18} style={{ color: "var(--blue)" }} /> Desktop Folder Batch Photo-Audit
              </h3>
              <button 
                type="button" 
                className="muted cursor-pointer" 
                style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 20 }}
                onClick={() => {
                  if (uploadStatus.active) {
                    if (confirm("Are you sure you want to close? Ingestion is currently in progress.")) {
                      setIsCancelled(true);
                      setShowBatchModal(false);
                    }
                  } else {
                    setShowBatchModal(false);
                  }
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* Initial Dropzone State */}
              {!parsingStatus.active && !uploadStatus.active && batchAudits.length === 0 && (
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFolderDrop}
                  onClick={() => folderInputRef.current?.click()}
                  style={{
                    border: "2px dashed var(--border)",
                    borderRadius: 12,
                    padding: "48px 20px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "var(--surface-3, #1e293b)",
                    color: "var(--text-secondary)",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--blue)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                >
                  <Upload size={40} style={{ color: "var(--blue)" }} />
                  <div>
                    <p style={{ fontWeight: 600, color: "var(--text)", fontSize: 15, marginBottom: 4 }}>Drag &amp; Drop Photo Audit Folder Here</p>
                    <p style={{ fontSize: 13 }} className="muted">Or click to select directory from your system</p>
                  </div>
                  <input 
                    type="file" 
                    ref={folderInputRef} 
                    webkitdirectory="true" 
                    directory="true" 
                    multiple 
                    style={{ display: "none" }} 
                    onChange={handleFolderSelect} 
                  />
                  
                  {process.env.NODE_ENV === "development" && (
                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px dashed var(--border)", width: "100%", maxWidth: 300 }}>
                      <span style={{ fontSize: 11, display: "block", marginBottom: 8 }} className="muted">Developer Testing Utilities</span>
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm" 
                        style={{ width: "100%" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleScaleSimulation();
                        }}
                      >
                        ⚡ Generate 150 Mock Audits (Scale Test)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Parsing State */}
              {parsingStatus.active && (
                <div style={{ padding: "30px 10px", textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
                  <RefreshCw size={36} className="animate-spin" style={{ margin: "0 auto", color: "var(--blue)" }} />
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Scanning Folder Directories</h4>
                    <p className="muted" style={{ fontSize: 13 }}>Reading EXIF geolocation metadata client-side (Zero data footprint saved)</p>
                  </div>
                  
                  <div style={{ maxWidth: 400, margin: "0 auto", width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                      <span>Progress</span>
                      <span>{parsingStatus.current} / {parsingStatus.total} files ({Math.round((parsingStatus.current / (parsingStatus.total || 1)) * 100)}%)</span>
                    </div>
                    <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "var(--blue)", width: `${(parsingStatus.current / (parsingStatus.total || 1)) * 100}%`, transition: "width 0.1s ease" }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", gap: 24, fontSize: 13 }} className="muted">
                    <span>Speed: <strong>{parsingStatus.speed} files/sec</strong></span>
                    <span>Remaining: <strong>{parsingStatus.timeRemaining}s</strong></span>
                  </div>
                </div>
              )}

              {/* Uploading State */}
              {uploadStatus.active && (
                <div style={{ padding: "30px 10px", textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
                  <RefreshCw size={36} className="animate-spin" style={{ margin: "0 auto", color: "var(--blue)" }} />
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Registering Audit Batches</h4>
                    <p className="muted" style={{ fontSize: 13 }}>Uploading matching photo coordinates in chunks of 50</p>
                  </div>

                  <div style={{ maxWidth: 400, margin: "0 auto", width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                      <span>Registration Progress</span>
                      <span>{uploadStatus.current} / {uploadStatus.total} ({Math.round((uploadStatus.current / (uploadStatus.total || 1)) * 100)}%)</span>
                    </div>
                    <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "var(--green, #16a34a)", width: `${(uploadStatus.current / (uploadStatus.total || 1)) * 100}%`, transition: "width 0.1s ease" }} />
                    </div>
                  </div>

                  <div style={{ fontSize: 13 }} className="muted">
                    Processing Batch Chunk <strong>{uploadStatus.chunkIndex} of {uploadStatus.totalChunks}</strong>
                  </div>

                  <div>
                    <button 
                      type="button" 
                      className="btn btn-danger btn-sm" 
                      style={{ background: "var(--red)", borderColor: "var(--red)", color: "white" }}
                      onClick={() => {
                        setIsCancelled(true);
                      }}
                    >
                      Halt &amp; Cancel Ingestion
                    </button>
                  </div>
                </div>
              )}

              {/* Parsed & Match Overview Dashboard */}
              {!parsingStatus.active && !uploadStatus.active && batchAudits.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  
                  {/* Telemetry Metric Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-3)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>AUTO-MATCHED</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
                        {batchAudits.filter(a => a.confidence === "high").length}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>High Confidence</div>
                    </div>
                    <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-3)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>NEEDS REVIEW</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b", marginTop: 4 }}>
                        {batchAudits.filter(a => a.confidence === "review" || a.confidence === "none").length}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>Manual Map Required</div>
                    </div>
                    <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-3)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>FAILED / IGNORED</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", marginTop: 4 }}>
                        {ignoredFiles.length}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>Invalid / Missing GPS</div>
                    </div>
                    <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-3)", gridColumn: "span 2" }}>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>FOOTPRINT SAVED</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginTop: 4 }}>
                        {(() => {
                          const totalBytes = batchAudits.reduce((s, b) => s + (b.fileSize || 0), 0) + ignoredFiles.reduce((s, f) => s + (f.fileSize || 0), 0);
                          const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
                          return `Processed ${totalMB} MB of JPEGs. Discarded bin. Saved 99.9% storage footprint.`;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Impact Summary Alert */}
                  <div style={{ padding: "10px 14px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 8, fontSize: 12, display: "flex", gap: 10, alignItems: "center" }}>
                    <Info size={16} style={{ color: "var(--blue)" }} />
                    <div>
                      {(() => {
                        const verifiedCount = batchAudits.filter(a => a.matchedAsset !== null).length;
                        const verifiedInWave = assets.filter(a => reconciliationData[a.id]).length;
                        const pctBefore = assets.length > 0 ? ((verifiedInWave / assets.length) * 100).toFixed(1) : "0.0";
                        
                        const newlyVerified = assets.filter(a => reconciliationData[a.id] || batchAudits.some(ba => ba.matchedAsset?.id === a.id)).length;
                        const pctAfter = assets.length > 0 ? ((newlyVerified / assets.length) * 100).toFixed(1) : "0.0";
                        const delta = (parseFloat(pctAfter) - parseFloat(pctBefore)).toFixed(1);

                        return (
                          <span>
                            This batch maps <strong>{verifiedCount} photo audits</strong>, increasing verification wave coverage from <strong>{pctBefore}%</strong> to <strong>{pctAfter}% (+{delta}% shift)</strong>.
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* View Tabs */}
                  <div className="tab-nav" style={{ marginBottom: 0, fontSize: 12 }}>
                    <button type="button" className={`tab-btn ${batchViewTab === "matched" ? "active" : ""}`} onClick={() => setBatchViewTab("matched")}>
                      Matched ({batchAudits.filter(a => a.confidence === "high" || a.confidence === "manual").length})
                    </button>
                    <button type="button" className={`tab-btn ${batchViewTab === "review" ? "active" : ""}`} onClick={() => setBatchViewTab("review")}>
                      Needs Review ({batchAudits.filter(a => a.confidence === "review" || a.confidence === "none").length})
                    </button>
                    <button type="button" className={`tab-btn ${batchViewTab === "ignored" ? "active" : ""}`} onClick={() => setBatchViewTab("ignored")}>
                      Ignored / Failed ({ignoredFiles.length})
                    </button>
                  </div>

                  {/* Tab Contents */}
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, minHeight: 200, maxHeight: 300, overflowY: "auto", background: "var(--surface-overlay, #0b0f19)" }}>
                    
                    {batchViewTab === "matched" && (
                      <div>
                        {batchAudits.filter(a => a.confidence === "high" || a.confidence === "manual").map((item, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderBottom: "1px solid var(--border-dim)", fontSize: 12 }}>
                            <div>
                              <strong style={{ color: "var(--green)" }}>{item.matchedAsset.assetTag}</strong> - {item.matchedAsset.name}
                              <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{item.originalFilename} | Lat: {item.latitude}, Lon: {item.longitude}</div>
                            </div>
                            <span className="badge badge-active" style={{ background: "rgba(22, 163, 74, 0.15)", color: "#16a34a", fontSize: 10 }}>Auto-Matched</span>
                          </div>
                        ))}
                        {batchAudits.filter(a => a.confidence === "high" || a.confidence === "manual").length === 0 && (
                          <div style={{ textAlign: "center", padding: 24 }} className="muted">No successfully matched assets. Check "Needs Review" tab.</div>
                        )}
                      </div>
                    )}

                    {batchViewTab === "review" && (
                      <div>
                        {batchAudits.filter(a => a.confidence === "review" || a.confidence === "none").map((item, idx) => {
                          const realIdx = batchAudits.indexOf(item);
                          return (
                            <ManualAssetMatcherRow 
                              key={realIdx} 
                              item={item} 
                              index={realIdx} 
                              assets={assets}
                              setBatchAudits={setBatchAudits}
                            />
                          );
                        })}
                        {batchAudits.filter(a => a.confidence === "review" || a.confidence === "none").length === 0 && (
                          <div style={{ textAlign: "center", padding: 24 }} className="muted">All photo audits successfully mapped!</div>
                        )}
                      </div>
                    )}

                    {batchViewTab === "ignored" && (
                      <div>
                        {ignoredFiles.map((file, idx) => (
                          <div key={idx} style={{ padding: "8px", borderBottom: "1px solid var(--border-dim)", fontSize: 12 }}>
                            <div style={{ fontWeight: 600, color: "var(--red)" }}>{file.filename}</div>
                            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                              Category: <strong>{file.category}</strong> | Reason: {file.reason}
                            </div>
                          </div>
                        ))}
                        {ignoredFiles.length === 0 && (
                          <div style={{ textAlign: "center", padding: 24 }} className="muted">No files ignored. All folders are clean!</div>
                        )}
                      </div>
                    )}

                  </div>

                </div>
              )}

              {/* Heartbeat scrolling console logs */}
              {(parsingStatus.active || uploadStatus.active || batchLogs.length > 0) && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Ingestion Live Diagnostic Console Log</div>
                  <div style={{ 
                    height: 100, 
                    background: "#020617", 
                    border: "1px solid var(--border)", 
                    borderRadius: 6, 
                    padding: 8, 
                    fontFamily: "monospace", 
                    fontSize: 10, 
                    color: "#38bdf8", 
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column-reverse"
                  }}>
                    {Array.from(batchLogs).reverse().map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", background: "var(--surface-3)" }}>
              <div>
                {batchAudits.length > 0 && !uploadStatus.active && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setBatchAudits([]); setIgnoredFiles([]); setBatchLogs([]); }}>
                    Clear Folder Ingest
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setShowBatchModal(false)}
                  disabled={uploadStatus.active}
                >
                  Close
                </button>
                {batchAudits.length > 0 && !uploadStatus.active && (
                  <button 
                    type="button" 
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: "var(--green, #16a34a)", border: "none", color: "white" }}
                    onClick={handleRegisterBatch}
                  >
                    Register Batch ({batchAudits.filter(a => a.matchedAsset !== null).length} Assets)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload History / Rollback Modal */}
      {showBatchHistoryModal && (
        <div className="modal-backdrop" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 20 }}>
          <div className="modal-content card" style={{ width: "100%", maxWidth: 750, maxHeight: "85vh", display: "flex", flexDirection: "column", background: "var(--card-bg, #0f172a)", border: "1px solid var(--border)", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)", borderRadius: 12, overflow: "hidden" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface-3)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <ClipboardList size={18} style={{ color: "var(--blue)" }} /> Photo-Audit Ingestion Batches History
              </h3>
              <button 
                type="button" 
                className="muted cursor-pointer" 
                style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 20 }}
                onClick={() => setShowBatchHistoryModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Uploaded Date</th>
                    <th>Folder Directory</th>
                    <th>Files Audited</th>
                    <th>Uploaded By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batchHistory.map((batch) => (
                    <tr key={batch.id}>
                      <td style={{ fontWeight: 600 }}>{new Date(batch.uploadedAt).toLocaleString()}</td>
                      <td>{batch.folderName || "—"}</td>
                      <td>{batch.fileCount}</td>
                      <td>{batch.user?.name || "System"}</td>
                      <td>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm text-red" 
                          style={{ color: "var(--red, #ef4444)", borderColor: "var(--red, #ef4444)" }}
                          onClick={() => handleRollbackBatch(batch.id)}
                        >
                          Rollback Ingest
                        </button>
                      </td>
                    </tr>
                  ))}
                  {batchHistory.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: 24 }} className="muted">
                        No batch audits ingestion logs found in history.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", background: "var(--surface-3)" }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowBatchHistoryModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedAssetIds.size > 0 && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--card-bg, #0f172a)",
          border: "1px solid var(--blue)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 0 15px rgba(59, 130, 246, 0.4)",
          borderRadius: "12px",
          padding: "16px 24px",
          zIndex: 999,
          display: "flex",
          alignItems: "center",
          gap: "20px"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>
              {selectedAssetIds.size} Assets Selected
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Bulk updates are applied atomically in a database transaction.
            </span>
          </div>

          <div style={{ width: "1px", height: "30px", background: "var(--border)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <select
              className="form-select"
              style={{ width: "160px", padding: "6px 10px", fontSize: "13px", height: "auto" }}
              value={bulkActionStatus}
              onChange={(e) => setBulkActionStatus(e.target.value)}
            >
              <option value="">— Change Status —</option>
              {Object.entries(ASSET_STATUSES).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            <select
              className="form-select"
              style={{ width: "180px", padding: "6px 10px", fontSize: "13px", height: "auto" }}
              value={bulkActionEmployeeId}
              onChange={(e) => setBulkActionEmployeeId(e.target.value)}
            >
              <option value="">— Reassign Employee —</option>
              <option value="clear">Clear Assignment (Return to Stock)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: "var(--blue)", borderColor: "var(--blue)", display: "inline-flex", alignItems: "center", gap: "4px" }}
              onClick={handleBulkUpdate}
              disabled={bulkActionSaving || (!bulkActionStatus && !bulkActionEmployeeId)}
            >
              {bulkActionSaving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Apply Updates"
              )}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSelectedAssetIds(new Set());
                setBulkActionStatus("");
                setBulkActionEmployeeId("");
              }}
              disabled={bulkActionSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Autocomplete search row helper for manual mapping of unmapped assets
function ManualAssetMatcherRow({ item, index, assets, setBatchAudits }) {
  const [search, setSearch] = useState("");
  
  const suggestions = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return assets.filter(a => 
      a.assetTag.toLowerCase().includes(q) || 
      (a.serialNumber && a.serialNumber.toLowerCase().includes(q)) ||
      a.name.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [search, assets]);

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-dim)", justifyContent: "space-between" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{item.originalFilename}</div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
          Lat: {item.latitude || "No GPS"}, Lon: {item.longitude || "No GPS"} | Date: {item.auditedAt}
        </div>
      </div>
      
      <div style={{ flex: "0 0 320px", position: "relative" }}>
        {item.matchedAsset ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>
              Mapped to: {item.matchedAsset.assetTag}
            </span>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              style={{ padding: "2px 6px", fontSize: 10 }}
              onClick={() => {
                setBatchAudits(prev => prev.map((ba, idx) => idx === index ? { ...ba, matchedAsset: null, confidence: "review" } : ba));
              }}
            >
              Clear
            </button>
          </div>
        ) : (
          <div>
            <input 
              type="text" 
              className="form-input" 
              style={{ width: "100%", height: 32, fontSize: 12 }} 
              placeholder="Search Asset Tag or Serial..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {suggestions.length > 0 && (
              <div style={{ 
                position: "absolute", 
                top: 34, 
                left: 0, 
                right: 0, 
                background: "var(--card-bg, #0f172a)", 
                border: "1px solid var(--border)", 
                borderRadius: 4, 
                zIndex: 100, 
                maxHeight: 150, 
                overflowY: "auto",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)"
              }}>
                {suggestions.map(a => (
                  <div 
                    key={a.id} 
                    style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid var(--border-dim)", color: "var(--text)" }}
                    onMouseDown={() => {
                      setBatchAudits(prev => prev.map((ba, idx) => idx === index ? { ...ba, matchedAsset: a, confidence: "manual", verificationStatus: "fully_verified" } : ba));
                      setSearch("");
                    }}
                  >
                    <strong>{a.assetTag}</strong> - {a.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
