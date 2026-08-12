import type { ReactNode } from "react";
import { siteConfig } from "@/lib/site";

export function LegalPage({
  title,
  updatedIso,
  updatedLabel,
  children,
}: {
  title: string;
  updatedIso: string;
  updatedLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Last updated: <time dateTime={updatedIso}>{updatedLabel}</time>
        </p>
      </header>
      <div className="space-y-10">{children}</div>
    </div>
  );
}

export function LegalSection({
  heading,
  id,
  children,
}: {
  heading: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold mb-3">{heading}</h2>
      {children}
    </section>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return (
    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
      {children}
    </p>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 mb-4 space-y-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalJsonLd({
  title,
  description,
  path,
  updatedIso,
}: {
  title: string;
  description: string;
  path: string;
  updatedIso: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: `${siteConfig.url}${path}`,
    dateModified: updatedIso,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
