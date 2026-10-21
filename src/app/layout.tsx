import type { Metadata } from "next";
import { Figtree, JetBrains_Mono } from "next/font/google";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { AppThemeProvider, MODE_STORAGE_KEY } from "@/components/theme/AppThemeProvider";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "GTM AI Chat",
  description: "GTM AI chat — Gemini researches with the GTM CLI, Jev decides when and which interactive components to show.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`h-full antialiased ${figtree.variable} ${jetbrainsMono.variable}`}>
      <body className="flex min-h-full flex-col">
        <InitColorSchemeScript attribute="class" defaultMode="light" modeStorageKey={MODE_STORAGE_KEY} />
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <AppThemeProvider>{children}</AppThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
