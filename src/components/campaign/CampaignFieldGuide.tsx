'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'

interface Term {
  term: string
  explanation: string
}

interface GuideSection {
  title: string
  terms: Term[]
}

const SECTIONS: GuideSection[] = [
  {
    title: 'Campaign basics',
    terms: [
      { term: 'Campaign name', explanation: 'Just a label for you to recognize this campaign later — Meta doesn’t use it to decide anything. Name it so you can tell it apart from others (e.g. what audience or offer it’s testing).' },
      { term: 'Product', explanation: 'Which of your products this campaign sells. This tells the system which purchase event and rupee value to track when measuring return on ad spend (ROAS).' },
      { term: 'Daily budget', explanation: 'How much you’re willing to spend per day, in rupees. Meta tries to spend close to this every day the campaign runs — think of it as a spending limit, not a guaranteed spend.' },
      {
        term: 'Objective',
        explanation: 'What result you want Meta to chase with your money:',
      },
    ],
  },
  {
    title: 'Campaign type',
    terms: [
      { term: 'Advantage+', explanation: 'You hand control to Meta’s AI. It automatically decides who sees your ad — age, gender, location, interests — based on who it predicts is most likely to convert. Fast to set up, but you can’t say "only show this to women 25-35 in Mumbai."' },
      { term: 'Custom Targeting', explanation: 'You decide exactly who sees the ad. More setup, but you keep control — useful when you already know your buyers’ profile, or want to re-reach people who’ve visited your site before.' },
    ],
  },
  {
    title: 'Ad set & targeting',
    terms: [
      { term: 'Ad set', explanation: 'A sub-group inside your campaign with its own audience and slice of the budget. One campaign can have several ad sets, each testing a different audience with the same (or different) ads.' },
      { term: 'Budget share (%)', explanation: 'If you have more than one ad set, this is how the daily budget splits between them. All ad sets’ shares must add up to 100%.' },
      { term: 'Custom audience', explanation: 'People from a list you’ve already saved in Meta — e.g. past website visitors, or a customer list you uploaded.' },
      { term: 'Retarget', explanation: 'The same idea as a custom audience, specifically used to re-show ads to people who’ve already interacted with you (visited your site, added to cart, etc).' },
      { term: 'Lookalike audience', explanation: 'Meta finds new people who resemble an existing audience you provide — e.g. "find more people like my past customers." You never chose these people directly; Meta matches by behavior pattern.' },
      { term: 'Interest-based', explanation: 'A cold audience — people who’ve shown interest in related topics (e.g. "astrology," "spirituality") on Facebook/Instagram, but have never interacted with your brand before.' },
      { term: 'Meta audience', explanation: 'The specific saved list or lookalike group to use for this ad set. Only appears for Custom / Retarget / Lookalike — Interest-based ad sets use the interest search below instead.' },
      { term: 'Age min / Age max', explanation: 'The youngest and oldest age Meta will show this ad to.' },
      { term: 'Gender', explanation: 'Restrict delivery to only men, only women, or everyone.' },
      { term: 'Geo (ISO codes)', explanation: 'Which countries to show the ad in. "IN" = India. Add more separated by commas, e.g. "IN, US".' },
      { term: 'Interests', explanation: 'For interest-based targeting only — topics people have engaged with that make them likely to care about your product. Searched live against Meta’s own list, so results are real audiences Meta can actually target.' },
      {
        term: 'Optimization goal',
        explanation: 'What specific action Meta tries to get for your money within this ad set:',
      },
      {
        term: 'Creative format',
        explanation: 'Which type of ad Meta builds from your creative below:',
      },
    ],
  },
  {
    title: 'Creative (the ad itself)',
    terms: [
      { term: 'Headline', explanation: 'The bold, short title shown above or below your ad image — usually 5-7 words. This is the first thing people read.' },
      { term: 'Primary text', explanation: 'The main body text of the ad — the paragraph people read above the image, where you make the case for why they should care.' },
      { term: 'CTA (Call To Action)', explanation: 'The button on the ad — "Learn More," "Shop Now," "Sign Up" — that tells people what to do next.' },
      { term: 'Image URL / Video URL', explanation: 'A direct web link to your ad’s image or video file. It must be publicly reachable (not a private Google Drive link) — Meta downloads the file from this link the moment the campaign launches.' },
    ],
  },
]

const OBJECTIVE_DETAIL = [
  { k: 'Sales', v: 'Get purchases on your website.' },
  { k: 'Leads', v: 'Get people to submit their contact info (form fill).' },
  { k: 'Engagement', v: 'Get likes, comments, and shares on the post.' },
  { k: 'Awareness', v: 'Get your ad seen by as many relevant people as possible, as cheaply as possible.' },
  { k: 'Traffic', v: 'Get clicks to your website — doesn’t care whether they buy once there.' },
]

const OPTIMIZATION_DETAIL = [
  { k: 'Offsite Conversions', v: 'Get people to complete a purchase/signup on your website. The default and usually right choice for sales campaigns.' },
  { k: 'Link Clicks', v: 'Get as many clicks as possible, regardless of what happens after the click.' },
  { k: 'Landing Page Views', v: 'Get people who actually load your page (filters out clicks where the page never finishes loading).' },
  { k: 'Reach', v: 'Show the ad to as many different people as possible, without repeating it too often to the same person.' },
  { k: 'Impressions', v: 'Rack up as many ad views as possible — the cheapest goal, no click or action required.' },
]

const FORMAT_DETAIL = [
  { k: 'Image (all variants)', v: 'Meta creates a separate ad for every headline/copy variant you wrote, each paired with your image.' },
  { k: 'Video (variant 1 only)', v: 'Only your first copy variant is used, paired with the video.' },
  { k: 'Both', v: 'Runs image ads and the video ad together in this ad set.' },
  { k: 'Mixed', v: 'Automatically splits into two separate ad sets — one all-video, one all-image — so you can compare which format actually performs better.' },
]

function DetailList({ rows }: { rows: Array<{ k: string; v: string }> }) {
  return (
    <ul className="mt-1.5 space-y-1">
      {rows.map(r => (
        <li key={r.k} className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>{r.k}:</strong> {r.v}
        </li>
      ))}
    </ul>
  )
}

export function CampaignFieldGuide() {
  const [open, setOpen] = useState(false)

  return (
    <section className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2.5">
          <BookOpen size={15} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>New to this? Read the field guide</span>
          <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>— plain-English explanations, no marketing jargon</span>
        </span>
        <ChevronDown size={16} style={{ color: 'var(--ink-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-5" style={{ borderTop: '1px solid var(--hairline-light)' }}>
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2.5 mt-4" style={{ color: 'var(--accent)' }}>{section.title}</p>
              <dl className="space-y-3">
                {section.terms.map(t => (
                  <div key={t.term}>
                    <dt className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{t.term}</dt>
                    <dd className="text-[12px] leading-relaxed mt-0.5" style={{ color: 'var(--ink-3)' }}>
                      {t.explanation}
                      {t.term === 'Objective' && <DetailList rows={OBJECTIVE_DETAIL} />}
                      {t.term === 'Optimization goal' && <DetailList rows={OPTIMIZATION_DETAIL} />}
                      {t.term === 'Creative format' && <DetailList rows={FORMAT_DETAIL} />}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
