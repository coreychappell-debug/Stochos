// verify_osrm_api.js
// Hits the Next.js optimization API on localhost:3000 and verifies OSRM response.

async function test() {
  const payload = {
    startPoint: { lat: 42.81432, lng: -73.94314, name: "Schenectady" },
    waypoints: [
      { id: "1", externalId: "1", name: "Fishkill", address: "1 Main St", city: "Fishkill", latitude: 41.52402, longitude: -73.89785 },
      { id: "2", externalId: "2", name: "Manhattan", address: "2 Broadway", city: "New York", latitude: 40.70494, longitude: -74.01258 },
      { id: "3", externalId: "3", name: "Garden City", address: "3 Ring Rd", city: "Garden City", latitude: 40.72591, longitude: -73.59374 },
      { id: "4", externalId: "4", name: "Syracuse", address: "4 Erie Blvd", city: "Syracuse", latitude: 43.05058, longitude: -76.16335 }
    ],
    roundTrip: true
  };

  console.log("Sending optimization request to Next.js API (http://localhost:3000)...");
  try {
    const res = await fetch("http://localhost:3000/api/fomo/route/optimize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-simulated-test": "true" // Bypasses auth check for testing
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`API returned status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    console.log("\n=== API Response ===");
    console.log("Is Fallback (Haversine calculations used):", data.isFallback);
    console.log("Total Distance (miles):", data.totalDistanceMiles);
    console.log("Total Duration (minutes):", data.totalDurationMinutes);
    console.log("Google Maps URL:", data.googleMapsUrl);
    console.log("Geometry (coordinates path) received:", data.routeGeometry ? "Yes" : "No");
    
    if (data.isFallback === false && data.routeGeometry) {
      console.log("\n🎉 SUCCESS: Next.js API integrated with local OSRM routing engine!");
    } else {
      console.log("\n⚠️ WARNING: Next.js fell back to straight-line Haversine math. Local OSRM check failed.");
    }
  } catch (e) {
    console.error("Error executing verification test:", e.message);
  }
}

test();
