const allowedDevOrigins = ["192.168.1.74", "100.79.201.44", "localhost"];
if (process.env.NEXTAUTH_URL) {
  try {
    const hostname = new URL(process.env.NEXTAUTH_URL).hostname;
    if (!allowedDevOrigins.includes(hostname)) {
      allowedDevOrigins.push(hostname);
    }
  } catch (e) {
    // Ignore invalid URL
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  allowedDevOrigins,
  trailingSlash: true,
  async rewrites() {
    return [
      {
        source: "/shiny-proxy/:path*",
        destination: "http://localhost:3838/:path*",
      },
      {
        source: "/executive",
        destination: "http://localhost:3838/executive/",
      },
      {
        source: "/executive/",
        destination: "http://localhost:3838/executive/",
      },
      {
        source: "/executive/:path+",
        destination: "http://localhost:3838/executive/:path+",
      },
      {
        source: "/ews",
        destination: "http://localhost:3838/ews/",
      },
      {
        source: "/ews/",
        destination: "http://localhost:3838/ews/",
      },
      {
        source: "/ews/:path+",
        destination: "http://localhost:3838/ews/:path+",
      },
      {
        source: "/shared/:path*",
        destination: "http://localhost:3838/shared/:path*",
      },
    ];
  },
};

export default nextConfig;
