// Board templates (PRD §E.5) and sample data for onboarding.

export const CARD_TYPES = {
  person:      { label: 'Person',      color: 'person' },
  creator:     { label: 'Creator',     color: 'creator' },
  company:     { label: 'Brand',       color: 'brand-cat' },
  tool:        { label: 'Tool',        color: 'tool' },
  opportunity: { label: 'Opportunity', color: 'opportunity' },
  community:   { label: 'Community',   color: 'community' },
  project:     { label: 'Project',     color: 'project' },
  other:       { label: 'Other',       color: 'neutral' },
};

// Type-specific fields stored in card.customFields.
export const TYPE_FIELDS = {
  person:  [['role', 'Role'], ['company', 'Company'], ['location', 'Location']],
  creator: [['platforms', 'Platforms'], ['audience', 'Audience'], ['niche', 'Niche']],
  company: [['industry', 'Industry'], ['partnershipIdea', 'Partnership idea']],
  tool:    [['pricing', 'Pricing'], ['trialStatus', 'Status']],
  opportunity: [['value', 'Why it matters'], ['deadline', 'Deadline']],
  community: [['platform', 'Where'], ['size', 'Size']],
  project: [['goal', 'Goal']],
  other: [],
};

// s(name, color, flags)
const s = (name, colorToken, extra = {}) => ({ name, colorToken, ...extra });

export const TEMPLATES = [
  {
    key: 'partnerships', name: 'Partnerships', description: 'Brands worth building with.', cap: 20, defaultType: 'company',
    empty: ['The next good collaboration starts somewhere.', 'Add a brand'],
    stages: [s('Idea', 'neutral'), s('Reach out', 'person'), s('In conversation', 'creator'), s('Active', 'tool', { celebrate: true }), s('Parked', 'neutral', { isTerminal: true })],
  },
  {
    key: 'creators', name: 'Creators', description: 'People whose work moves you.', cap: 25, defaultType: 'creator',
    empty: ['Keep the people whose work moves you close.', 'Add a creator'],
    stages: [s('Discovered', 'neutral'), s('Research', 'community'), s('Reach out', 'person'), s('Collaborating', 'tool', { celebrate: true }), s('Parked', 'neutral', { isTerminal: true })],
  },
  {
    key: 'people', name: 'People to know', description: 'Mentors, peers, and future friends.', cap: 25, defaultType: 'person',
    empty: ['Start with someone you want to know.', 'Add a person'],
    stages: [s('Interested', 'neutral'), s('Introduce myself', 'person'), s('Connected', 'tool', { celebrate: true }), s('Keep in touch', 'community'), s('Parked', 'neutral', { isTerminal: true })],
  },
  {
    key: 'tools', name: 'Tools to try', description: 'Curiosity, collected.', cap: 20, defaultType: 'tool',
    empty: ['Curiosity, collected.', 'Add a tool'],
    stages: [s('Curious', 'neutral'), s('To try', 'brand-cat'), s('Trying', 'creator'), s('Adopted', 'tool', { celebrate: true }), s('Not for me', 'neutral', { isTerminal: true })],
  },
  {
    key: 'opportunities', name: 'Opportunities', description: 'Grants, gigs, invitations, and openings.', cap: 20, defaultType: 'opportunity',
    empty: ['Good chances deserve a second look.', 'Add an opportunity'],
    stages: [s('Found', 'neutral'), s('Evaluate', 'community'), s('Pursue', 'opportunity'), s('In progress', 'tool', { celebrate: true }), s('Closed', 'neutral', { isTerminal: true })],
  },
  {
    key: 'projects', name: 'Ideas & projects', description: 'Sparks worth following.', cap: 15, defaultType: 'project',
    empty: ['Every project starts as a spark.', 'Add an idea'],
    stages: [s('Spark', 'neutral'), s('Exploring', 'community'), s('Building', 'creator'), s('Shipped', 'tool', { celebrate: true }), s('Parked', 'neutral', { isTerminal: true })],
  },
];

export const BLANK_TEMPLATE = {
  key: 'blank', name: 'New board', description: '', cap: 20, defaultType: 'person',
  empty: ['A few good people to start with.', 'Add a card'],
  stages: [s('Later', 'neutral'), s('Next', 'person'), s('Now', 'tool', { celebrate: true }), s('Parked', 'neutral', { isTerminal: true })],
};

// Sample cards per template: [title, type, stageIndex, description, links, customFields, reminder?]
// reminder: [title, dayOffset, hour]
export const SAMPLES = {
  partnerships: [
    ['Northstar Wellness', 'company', 1, 'Mindful-living brand with a strong creator program.', ['northstar.example', 'partners@northstar.example', 'https://www.instagram.com/northstar.example'], { industry: 'Wellness', partnershipIdea: 'Co-hosted morning-routine challenge' }, ['Send a short intro note', 0, 10]],
    ['Field & Fold Paper Co.', 'company', 0, 'Notebooks and planners. Loved their last limited run.', [], { industry: 'Stationery' }],
    ['Lumen Audio', 'company', 2, 'Talked about sponsoring a video series in the spring.', ['dana@lumenaudio.example', '+1 604 555 0142'], { industry: 'Audio' }, ['Follow up on the spring series', -2, 9]],
    ['Common Thread Coffee', 'company', 3, 'Running the monthly giveaway together.', [], { industry: 'Coffee' }],
  ],
  creators: [
    ['Maya Chen', 'creator', 2, 'Wellness creator focused on sustainable routines.', ['https://www.instagram.com/example', 'https://www.youtube.com/@example', 'maya@example.com'], { platforms: 'Instagram, YouTube', audience: '84K', niche: 'Wellness' }, ['Draft a collaboration idea', 1, 9]],
    ['Jordan Okafor', 'creator', 1, 'Hosts a podcast about small creative businesses.', ['https://podcasts.apple.com/podcast/example', 'jordan@example.com'], { platforms: 'Podcast', niche: 'Indie business' }],
    ['Priya Raman', 'creator', 0, 'Makes calm desk-setup videos.', [], { platforms: 'YouTube', audience: '210K' }],
    ['Alex Rivera', 'creator', 3, 'Co-writing a newsletter issue next month.', [], { platforms: 'Newsletter', niche: 'Design' }, ['Share the outline', 4, 11]],
  ],
  people: [
    ['Sam Whitaker', 'person', 0, 'Met at the indie-makers meetup. Builds hardware.', ['sam@brightwork.example', 'brightwork.example'], { role: 'Founder', company: 'Brightwork' }],
    ['Lena Park', 'person', 1, 'Product designer, generous with feedback.', ['lena@example.com', '(778) 555-0199', 'https://www.linkedin.com/in/example'], { role: 'Designer' }, ['Say thanks for the portfolio notes', 0, 15]],
    ['Dev Kapoor', 'person', 3, 'Former teammate. Catch up every couple of months.', [], { role: 'Engineer' }],
  ],
  tools: [
    ['Studio Notes', 'tool', 2, 'Voice-first notes app. Trying it for scripting.', ['https://studionotes.example'], { pricing: '$8/mo', trialStatus: 'Trying' }],
    ['Framewise', 'tool', 1, 'Thumbnail testing. Several creators recommend it.', [], { pricing: 'Free tier' }],
    ['Ledgerly', 'tool', 0, 'Simple bookkeeping for one-person businesses.', [], {}],
  ],
  opportunities: [
    ['Creator grant, spring cohort', 'opportunity', 1, 'Funding for independent educational series.', [], { deadline: 'Dec 1' }, ['Read the application guide', 2, 10]],
  ],
  projects: [
    ['Morning routines mini-course', 'project', 1, 'Five short lessons. Could pair with Northstar.', [], { goal: 'Launch in January' }],
  ],
};
