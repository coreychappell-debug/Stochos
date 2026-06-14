import "./globals.css";
import Providers from "./components/Providers";
import ErrorBoundary from "./components/ErrorBoundary";

export const metadata = {
  title: "New York State Lottery — Stochos Business Platform",
  description: "Enterprise operations, sales forecasting, contract compliance, and logistics portal for the New York State Lottery.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="light-theme" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{__html: `
          (function() {
            try {
              const savedTheme = localStorage.getItem('theme') || 'light';
              const savedPalette = localStorage.getItem('theme-palette') || 'newyork';
              const cl = document.body.classList;
              cl.remove('light-theme', 'theme-classic', 'theme-newyork', 'theme-california', 'theme-texas', 'theme-florida');
              if (savedTheme === 'light') {
                cl.add('light-theme');
              }
              if (savedPalette !== 'classic') {
                cl.add('theme-' + savedPalette);
              } else {
                cl.add('theme-classic');
              }
            } catch (e) {}
          })();
        `}} />
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
