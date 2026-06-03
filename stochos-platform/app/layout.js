import "./globals.css";
import Providers from "./components/Providers";
import ErrorBoundary from "./components/ErrorBoundary";

export const metadata = {
  title: "Stochos — Lottery Business Platform",
  description: "Marketing resource management, contract lifecycle management, and analytics for lottery organizations.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="light-theme" suppressHydrationWarning>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
