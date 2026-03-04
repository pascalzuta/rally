// Defines all editable content areas per GRP page.
// Each field maps to a ContentArea row in the database (page + key).
// The admin UI renders a form based on these definitions.

export type FieldType = 'text' | 'textarea' | 'image' | 'list' | 'iframe'

export interface ContentFieldDef {
  key: string
  label: string
  type: FieldType
  placeholder?: string
}

export interface PageDef {
  slug: string
  title: string
  description: string
  fields: ContentFieldDef[]
}

export const GRP_PAGES: PageDef[] = [
  {
    slug: 'home',
    title: 'Home Page',
    description: 'Main landing page with hero, mission, conviction, partnership, and sector themes.',
    fields: [
      { key: 'hero_image', label: 'Hero Background Image URL', type: 'image', placeholder: './assets/optimized/hero-home-ocean-...-1600.jpg' },
      { key: 'hero_heading', label: 'Hero Heading', type: 'text', placeholder: 'e.g. Investing in Innovation...' },
      { key: 'hero_body', label: 'Hero Body', type: 'textarea', placeholder: 'Hero paragraph text' },
      { key: 'hero_supporting', label: 'Hero Supporting Line', type: 'text', placeholder: 'Wave copy text' },
      { key: 'mission_image', label: 'Mission Section Image URL', type: 'image' },
      { key: 'mission_heading', label: 'Our Mission Heading', type: 'text' },
      { key: 'mission_body', label: 'Our Mission Body', type: 'textarea' },
      { key: 'conviction_heading', label: 'Conviction-Led Investing Heading', type: 'text' },
      { key: 'conviction_body', label: 'Conviction-Led Investing Body', type: 'textarea' },
      { key: 'partnership_heading', label: 'Long-Term Partnership Heading', type: 'text' },
      { key: 'partnership_body', label: 'Long-Term Partnership Body', type: 'textarea' },
      { key: 'sector_image_1', label: 'Sector Image 1 URL', type: 'image' },
      { key: 'sector_image_2', label: 'Sector Image 2 URL', type: 'image' },
      { key: 'core_themes_heading', label: 'Core Themes Heading', type: 'text' },
      { key: 'core_themes_items', label: 'Core Themes (one per line)', type: 'list' },
      { key: 'portfolio_discipline_heading', label: 'Portfolio Discipline Heading', type: 'text' },
      { key: 'portfolio_discipline_items', label: 'Portfolio Discipline (one per line)', type: 'list' },
    ],
  },
  {
    slug: 'structure',
    title: 'Structure Page',
    description: 'Operating framework, alignment, investors, and partnership philosophy.',
    fields: [
      { key: 'hero_image', label: 'Hero Background Image URL', type: 'image' },
      { key: 'hero_heading', label: 'Hero Heading', type: 'text' },
      { key: 'hero_body', label: 'Hero Body', type: 'textarea' },
      { key: 'alignment_image', label: 'Alignment Section Image URL', type: 'image' },
      { key: 'investors_heading', label: 'We Are Investors Heading', type: 'text' },
      { key: 'investors_body', label: 'We Are Investors Body', type: 'textarea' },
      { key: 'long_term_heading', label: 'Long-Term First Heading', type: 'text' },
      { key: 'long_term_body', label: 'Long-Term First Body', type: 'textarea' },
      { key: 'tactical_heading', label: 'Tactical Flexibility Heading', type: 'text' },
      { key: 'tactical_body', label: 'Tactical Flexibility Body', type: 'textarea' },
      { key: 'partners_heading', label: 'We Are Partners Heading', type: 'text' },
      { key: 'partners_body', label: 'We Are Partners Body', type: 'textarea' },
    ],
  },
  {
    slug: 'investment',
    title: 'Investment Approach Page',
    description: 'Strategy, market focus, sector focus, key beliefs, and portfolio construction.',
    fields: [
      { key: 'hero_image', label: 'Hero Background Image URL', type: 'image' },
      { key: 'hero_heading', label: 'Hero Heading', type: 'text' },
      { key: 'hero_body', label: 'Hero Body', type: 'textarea' },
      { key: 'execution_image', label: 'Execution Section Image URL', type: 'image' },
      { key: 'market_focus_heading', label: 'Market & Sector Focus Heading', type: 'text' },
      { key: 'market_focus_body', label: 'Market & Sector Focus Body', type: 'textarea' },
      { key: 'sector_focus_heading', label: 'Sector Focus Heading', type: 'text' },
      { key: 'sector_focus_items', label: 'Sector Focus Items (one per line)', type: 'list' },
      { key: 'key_beliefs_heading', label: 'Our Key Beliefs Heading', type: 'text' },
      { key: 'key_beliefs_items', label: 'Key Beliefs (one per line)', type: 'list' },
      { key: 'portfolio_heading', label: 'Portfolio Construction Heading', type: 'text' },
      { key: 'portfolio_body', label: 'Portfolio Construction Body', type: 'textarea' },
    ],
  },
  {
    slug: 'sectors',
    title: 'Explore Sectors Page',
    description: 'Four investment sectors and convergence section.',
    fields: [
      { key: 'hero_image', label: 'Hero Background Image URL', type: 'image' },
      { key: 'hero_heading', label: 'Hero Heading', type: 'text' },
      { key: 'hero_body', label: 'Hero Body', type: 'textarea' },
      { key: 'tech_heading', label: 'Technology Sector Heading', type: 'text' },
      { key: 'tech_body', label: 'Technology Sector Description', type: 'textarea' },
      { key: 'energy_heading', label: 'Energy Transition Heading', type: 'text' },
      { key: 'energy_body', label: 'Energy Transition Description', type: 'textarea' },
      { key: 'industrials_heading', label: 'Advanced Industrials Heading', type: 'text' },
      { key: 'industrials_body', label: 'Advanced Industrials Description', type: 'textarea' },
      { key: 'healthcare_heading', label: 'Healthcare Innovation Heading', type: 'text' },
      { key: 'healthcare_body', label: 'Healthcare Innovation Description', type: 'textarea' },
      { key: 'convergence_heading', label: 'Convergence Section Heading', type: 'text' },
      { key: 'convergence_body', label: 'Convergence Section Body', type: 'textarea' },
    ],
  },
  {
    slug: 'team',
    title: 'Team Page',
    description: 'Section headings for the team page. Team members are managed separately.',
    fields: [
      { key: 'hero_image', label: 'Hero Background Image URL', type: 'image' },
      { key: 'hero_heading', label: 'Hero Heading', type: 'text' },
      { key: 'hero_body', label: 'Hero Body', type: 'textarea' },
      { key: 'founder_section_heading', label: 'Founder Section Heading', type: 'text', placeholder: 'e.g. Meet Our Founder' },
      { key: 'advisory_heading', label: 'Advisory Board Heading', type: 'text' },
      { key: 'advisory_body', label: 'Advisory Board Intro', type: 'textarea' },
      { key: 'fund_advisors_heading', label: 'Fund Advisors Section Heading', type: 'text' },
      { key: 'fund_advisors_body', label: 'Fund Advisors Intro', type: 'textarea' },
      { key: 'stewardship_heading', label: 'Stewardship Advisors Heading', type: 'text' },
      { key: 'stewardship_body', label: 'Stewardship Advisors Intro', type: 'textarea' },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact Page',
    description: 'Contact information, office details, and Google Maps embed.',
    fields: [
      { key: 'hero_image', label: 'Hero Background Image URL', type: 'image' },
      { key: 'hero_heading', label: 'Hero Heading', type: 'text' },
      { key: 'hero_body', label: 'Hero Body', type: 'textarea' },
      { key: 'reach_heading', label: 'Reach Us Heading', type: 'text' },
      { key: 'reach_body', label: 'Reach Us Body', type: 'textarea' },
      { key: 'inquiries_heading', label: 'General Inquiries Card Heading', type: 'text' },
      { key: 'address_heading', label: 'Address Card Heading', type: 'text' },
      { key: 'hours_heading', label: 'Office Hours Card Heading', type: 'text' },
      { key: 'map_embed_url', label: 'Google Maps Embed URL', type: 'iframe' },
      { key: 'message_heading', label: 'Send Us A Message Heading', type: 'text' },
      { key: 'message_body', label: 'Send Us A Message Body', type: 'textarea' },
    ],
  },
  {
    slug: 'news',
    title: 'News Page',
    description: 'News page section headings. Blog posts are managed separately.',
    fields: [
      { key: 'hero_heading', label: 'Hero Heading', type: 'text' },
      { key: 'hero_body', label: 'Hero Body', type: 'textarea' },
      { key: 'latest_heading', label: 'Latest Posts Section Heading', type: 'text' },
      { key: 'latest_body', label: 'Latest Posts Intro Text', type: 'textarea' },
      { key: 'blog_heading', label: 'Partner Blog Section Heading', type: 'text' },
      { key: 'blog_body', label: 'Partner Blog Intro Text', type: 'textarea' },
    ],
  },
]

// Helper to find a page definition by slug
export function getPageDef(slug: string): PageDef | undefined {
  return GRP_PAGES.find((p) => p.slug === slug)
}

// All page slugs
export const PAGE_SLUGS = GRP_PAGES.map((p) => p.slug)
