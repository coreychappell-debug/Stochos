async function main() {
  const res = await fetch('http://localhost:3000/api/reporting/upload/', {
    headers: { 'x-simulated-test': 'true' }
  });
  console.log("GET Status:", res.status);
  console.log("GET Response:", (await res.text()).substring(0, 200));

  const resPost = await fetch('http://localhost:3000/api/reporting/upload/', {
    method: 'POST',
    headers: { 'x-simulated-test': 'true' }
  });
  console.log("\nPOST Status:", resPost.status);
  console.log("POST Response:", (await resPost.text()).substring(0, 200));
}

main().catch(console.error);
