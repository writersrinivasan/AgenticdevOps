import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/Nav";
import { AssistantWidget } from "@/components/AssistantWidget";

export const metadata: Metadata = {
  title: "Agentic DevOps Academy",
  description: "A 5-hour learning portal and live multi-agent lab for Agentic AI DevOps, built with LangGraph and Groq.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="aurora min-h-screen">
        <Providers>
          <Nav />
          <main>{children}</main>
          <AssistantWidget />
        </Providers>
      </body>
    </html>
  );
}
