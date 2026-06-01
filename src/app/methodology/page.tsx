/**
 * Methodology (REGISTRY-DESIGN.md §6.6). Every signal links here. The point of
 * the page is that nothing is a black box — the bands, their sources, and the
 * trust-language rule are all stated plainly.
 */

export default function Methodology() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 prose-zinc">
      <h1 className="text-2xl font-semibold">Methodology</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        ax-registry shows three data layers as distinct bands. They are never
        blended into one opaque score.
      </p>

      <Section title="Static signals">
        Computed from public sources only — npm packument and weekly downloads,
        GitHub repo metadata (stars, presence of a SECURITY.md), the MCP
        registry, declared manifest, version history, license. Anyone can
        re-verify every value from the same public sources. Exists day one for
        every public server, with zero contributors.
      </Section>

      <Section title="Author-declared">
        Context added by a verified author after claiming the page: safer-mode
        flags, intended scopes, recommended config. A claim proves npm or GitHub
        ownership. This band is the author&rsquo;s stated intent — not a verdict.
      </Section>

      <Section title="Community-observed">
        Opt-in, anonymized signal from people who ran ax-ray and chose to share.
        No aggregate is ever shown below the k-anonymity floor (k = 5 to start),
        so an aggregate can&rsquo;t deanonymize a contributor. Opens in v2.
      </Section>

      <Section title="Trust language">
        We say <em>observed</em>, <em>attested by N signals</em>, and{" "}
        <em>listed</em>. We never say <em>verified</em>, <em>safe</em>, or{" "}
        <em>trusted</em>. A page states what was seen, re-checkable by anyone —
        not a verdict on the publisher.
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">{children}</p>
    </section>
  );
}
