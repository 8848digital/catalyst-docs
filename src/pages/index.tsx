import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const ENTRY_POINTS = [
  {
    title: 'Why Catalyst',
    to: '/docs/why-catalyst',
    description: 'The problem it was built to solve, what it changes about delivery, and where it fits.',
  },
  {
    title: 'Quickstart',
    to: '/docs/build/quickstart',
    description: 'Create a project from the template and get the web application running in about ten minutes.',
  },
  {
    title: 'Your first feature',
    to: '/docs/build/your-first-feature',
    description: 'A complete vertical slice - local database, repository, hook, component, and route.',
  },
];

// Infima's `hero--primary` forces the inverse font colour, which resolves to
// near-black in dark mode and left the title unreadable on a coloured fill.
// This page uses its own surface tokens so both themes stay legible.
function Hero() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className="container">
        <Heading as="h1" className={styles.title}>
          {siteConfig.title}
        </Heading>
        <p className={styles.subtitle}>{siteConfig.tagline}</p>
        <div className={styles.actions}>
          <Link className={styles.primaryAction} to="/docs/why-catalyst">
            Read the docs
          </Link>
          <Link className={styles.secondaryAction} to="/docs/build/quickstart">
            Quickstart
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description="Documentation for the Catalyst stack - offline-first Web and Mobile applications.">
      <Hero />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.grid}>
            {ENTRY_POINTS.map((entry) => (
              <Link key={entry.to} to={entry.to} className={styles.card}>
                <span className={styles.cardTitle}>{entry.title}</span>
                <span className={styles.cardText}>{entry.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </Layout>
  );
}
