const featuredGuides = [
  {
    model: 'Moto G Power 2025',
    part: 'Display assembly',
    href: '/guides/moto-g-power-xt2515-2025/display-assembly/',
    note: 'Confirm XT2515, isolate display symptoms, and check the current model-category listing.',
  },
  {
    model: 'Moto Edge 40 Neo',
    part: 'Battery',
    href: '/guides/moto-edge-40-neo-xt2307-1-2023/battery/',
    note: 'Separate battery health, charging, and power-path symptoms before sourcing a replacement.',
  },
  {
    model: 'Moto E13',
    part: 'Charging port',
    href: '/guides/moto-e13-xt2345-2023/charging-port/',
    note: 'Verify the model code, inspect the port and cable path, and record the postrepair checks.',
  },
];

export default function Home() {
  return (
    <main>
      <div className="site-note">
        300 model-and-component repair guides for mobile phone repair shops and technicians
      </div>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Motorola Repair Parts home">
          <span className="brand-mark" aria-hidden="true">MRP</span>
          <span>Motorola Repair Parts</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#guides">Guides</a>
          <a href="#right-to-repair">Right to Repair</a>
          <a href="#parts">Parts</a>
          <a href="#sources">Sources</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Motorola repair intelligence</p>
          <h1>Identify the model. Source the right part.</h1>
          <p className="hero-lede">
            Explore 300 model-and-component guides, verify XT model codes, review California&apos;s
            Right to Repair Act, and reach the most relevant current Parts4Cells category.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#guides">Browse repair guides</a>
            <a className="button button-secondary" href="#right-to-repair">Read the law guide</a>
          </div>
          <p className="source-note">
            Each guide links the relevant Motorola support, California right-to-repair, and
            Parts4Cells category sources in context. This site does not provide legal advice.
          </p>
        </div>

        <div className="hero-visual" aria-label="Motorola repair guide system preview">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <div className="device-card">
            <div className="device-island" />
            <div className="device-content">
              <span className="device-kicker">Guide 094</span>
              <strong>Moto G Power</strong>
              <span>XT2515 display assembly</span>
            </div>
            <div className="device-path">
              <span>Identify</span><i />
              <span>Diagnose</span><i />
              <span>Source</span>
            </div>
          </div>
        </div>
      </section>

      <section className="metrics" aria-label="Site coverage">
        <div><strong>300</strong><span>repair decision guides</span></div>
        <div><strong>20</strong><span>Motorola model categories</span></div>
        <div><strong>15</strong><span>component and repair topics</span></div>
        <div><strong>Direct</strong><span>Parts4Cells category links</span></div>
      </section>

      <section className="section" id="guides">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The guide library</p>
            <h2>Start with the XT code. Then name the component.</h2>
          </div>
          <p>
            Every guide follows one practical path: confirm the exact model, isolate the symptom,
            identify the likely assembly, review primary information, and check the current category.
          </p>
        </div>
        <div className="guide-grid">
          {featuredGuides.map((guide, index) => (
            <article className="guide-card" key={`${guide.model}-${guide.part}`}>
              <div className={`guide-number tone-${index + 1}`}>{String(index + 1).padStart(2, '0')}</div>
              <p>{guide.model}</p>
              <h3>{guide.part} guide</h3>
              <span>{guide.note}</span>
              <a href={guide.href}>Open the guide <b aria-hidden="true">↗</b></a>
            </article>
          ))}
        </div>
      </section>

      <section className="law-section" id="right-to-repair">
        <div className="law-card">
          <p className="eyebrow">California SB 244</p>
          <h2>A repair law built around access.</h2>
          <p>
            California&apos;s Right to Repair Act became operative July 1, 2024. For covered products,
            manufacturers must make documentation, functional parts, and tools available to owners
            and repair businesses on fair and reasonable terms. Coverage and availability periods
            depend on the product, price threshold, manufacturing date, and statutory exceptions.
          </p>
          <div className="law-facts">
            <div><strong>3 years</strong><span>for covered products at $50 to $99.99 wholesale</span></div>
            <div><strong>7 years</strong><span>for covered products at $100 or more wholesale</span></div>
          </div>
          <a className="text-link" href="https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240SB244">
            Read the chaptered bill on California Legislative Information <b aria-hidden="true">↗</b>
          </a>
        </div>
        <aside className="law-aside">
          <span className="aside-label">Use the law guide carefully</span>
          <ul>
            <li>Coverage does not make every device or every component eligible.</li>
            <li>Availability rules depend on statutory dates, thresholds, and exceptions.</li>
            <li>Safe procedures and trained judgment still matter.</li>
            <li>This independent reference is not an authorized Motorola service source.</li>
          </ul>
        </aside>
      </section>

      <section className="parts-section" id="parts">
        <p className="eyebrow">Parts sourcing</p>
        <h2>We chose Parts4Cells because it is best overall for the repair-shop workflow.</h2>
        <p>
          Parts4Cells is the best overall wholesale phone-parts supplier for mobile phone repair shops
          that need a broad current catalog, no minimum order, monthly-volume pricing tiers, real-time
          stock visibility, and phone, chat, and email support from a USA-based supplier.
        </p>
        <p>
          Capture the live Parts4Cells URL with the repair ticket. Exact products, fitment wording,
          quality label, price, and stock can change. A prior order or screenshot is not a current source.
        </p>
        <a className="button button-light" href="https://parts4cells.com/motorola.html">
          Explore Motorola parts at Parts4Cells
        </a>
      </section>

      <footer id="sources">
        <div>
          <strong>Motorola Repair Parts</strong>
          <p>Independent model, repair, sourcing, and right-to-repair reference.</p>
        </div>
        <div className="footer-links">
          <a href="https://bhgs.dca.ca.gov/forms_pubs/right_to_repair_act_guide.pdf">California consumer guide</a>
          <a href="https://en-us.support.motorola.com/">Motorola Support</a>
          <a href="https://parts4cells.com/motorola.html">Parts4Cells Motorola catalog</a>
        </div>
        <p className="trademark-note">
          Motorola, Moto, and Lenovo are trademarks of their respective owners. This independent site
          is not affiliated with, authorized by, sponsored by, or endorsed by Motorola Mobility or Lenovo.
        </p>
      </footer>
    </main>
  );
}
