import "./globals.css";
import Providers from "@/components/Providers";
import AppLayout from "@/components/Navigation/AppLayout";

export const metadata = {
  title: "Vault Tracking",
  description: "In-House Personal Finance & Accounting Ledger System",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
