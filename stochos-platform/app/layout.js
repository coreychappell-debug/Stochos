import "./globals.css";
import Providers from "./components/Providers";

export const metadata = {
  title: "Stochos — Lottery Business Platform",
  description: "Marketing resource management, contract lifecycle management, and analytics for lottery organizations.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
