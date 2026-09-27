// Offline fallback for gen_complaints.ts when no LLM key is configured.
// Each issue has 2+ phrasings so "reworded" repeats can be produced.
import type { Department } from '../../src/lib/nlp/departments.ts'
import type { Urgency } from '../../src/lib/nlp/urgency.ts'

export interface IssueTemplate {
  urgency: Urgency
  phrasings: string[]
}

export const TEMPLATES: Record<Department, IssueTemplate[]> = {
  'Water Supply & Sewerage': [
    { urgency: 'medium', phrasings: ['No water supply in our street for {n} days', 'Metro water has not come to our area for the last {n} days, taps are dry'] },
    { urgency: 'high', phrasings: ['Sewage is overflowing from the manhole onto the road', 'Drainage water is overflowing from the sewer and entering houses'] },
    { urgency: 'high', phrasings: ['Contaminated drinking water with foul smell coming in the tap', 'We are getting muddy and dirty water in the pipeline, children falling sick'] },
    { urgency: 'medium', phrasings: ['Very low water pressure, water comes only for 10 minutes', 'Water supply is irregular and pressure is too low to fill the sump'] },
    { urgency: 'medium', phrasings: ['Water pipeline leaking on the main road for a week', 'Big leak in the water pipe, lot of drinking water wasted daily'] },
    { urgency: 'low', phrasings: ['Applied for new water connection two months ago, no update', 'New sewer connection request pending, nobody responding'] },
  ],
  'Solid Waste Management': [
    { urgency: 'medium', phrasings: ['Garbage not collected from our street for a week', 'Conservancy workers have not picked up waste for {n} days, bins full'] },
    { urgency: 'medium', phrasings: ['Garbage bins overflowing near the market and stinking', 'Dustbin is overflowing and waste is spilling on the road'] },
    { urgency: 'low', phrasings: ['People dumping waste on the empty plot next to our house', 'Open dumping of garbage near the bus stop every night'] },
    { urgency: 'low', phrasings: ['Door to door collection vehicle does not come regularly', 'Waste collection van skips our lane most days'] },
    { urgency: 'low', phrasings: ['Construction debris dumped on the pavement', 'Someone left building rubble and debris blocking the footpath'] },
  ],
  'Roads & Storm Water Drains': [
    { urgency: 'low', phrasings: ['Big pothole on the main road causing trouble', 'Road is full of potholes, two wheelers struggling'] },
    { urgency: 'medium', phrasings: ['Flooding and waterlogging on our street after rain', 'Rain water stagnating knee deep, storm water drain blocked'] },
    { urgency: 'medium', phrasings: ['Storm water drain is clogged with silt and plastic', 'Drain near the school is blocked, water not flowing'] },
    { urgency: 'low', phrasings: ['Road dug up for cable work and never relaid', 'Road cut for pipeline work left open for weeks'] },
    { urgency: 'high', phrasings: ['Open storm water drain without cover, a child fell in', 'Drain slab broken and open, dangerous for elderly people at night'] },
  ],
  'Street Lighting': [
    { urgency: 'low', phrasings: ['Street light not working on our road', 'Broken streetlight near the junction, area is dark'] },
    { urgency: 'high', phrasings: ['Live wire hanging from the street light pole', 'Exposed electric wire at the lamp post, sparking in rain'] },
    { urgency: 'low', phrasings: ['Street lights are on during the day, wasting power', 'Lamp posts glowing even in daytime'] },
    { urgency: 'medium', phrasings: ['Whole stretch of street lights off for {n} days, women afraid to walk', 'All lamps on the road dark for a week, chain snatching risk'] },
  ],
  'Public Health & Sanitation': [
    { urgency: 'medium', phrasings: ['Mosquito menace, no fogging done in our area', 'Too many mosquitoes, dengue fever cases in the street'] },
    { urgency: 'medium', phrasings: ['Stray dogs menace, dogs chasing children', 'Pack of stray dogs attacking people at night'] },
    { urgency: 'medium', phrasings: ['Public toilet is filthy and not cleaned', 'Community toilet has no water and is unusable'] },
    { urgency: 'medium', phrasings: ['Dead animal lying on the road for two days', 'Carcass of a dog on the street, foul smell'] },
    { urgency: 'low', phrasings: ['Public urination near the bus stand, very unhygienic', 'Open defecation near the canal bank'] },
  ],
  'Parks & Water Bodies': [
    { urgency: 'low', phrasings: ['Park is neglected, broken swings and overgrown grass', 'Children park not maintained, play equipment broken'] },
    { urgency: 'low', phrasings: ['Lake near our area is polluted with sewage and plastic', 'Temple tank water body neglected and full of waste'] },
    { urgency: 'low', phrasings: ['Park gates locked in the evening, walkers cannot use it', 'Park lights not working and gate closed early'] },
    { urgency: 'low', phrasings: ['Encroachment on the lake bund', 'Water body being filled with debris for encroachment'] },
  ],
  'Buildings & Town Planning': [
    { urgency: 'medium', phrasings: ['Illegal construction next door without approval', 'Unauthorised extra floor being built in the next building'] },
    { urgency: 'high', phrasings: ['Old building in our street is about to collapse', 'Cracks in the old dilapidated building, may collapse any time'] },
    { urgency: 'low', phrasings: ['Shop encroaching on the footpath with a shed', 'Building setback violated, footpath blocked'] },
    { urgency: 'low', phrasings: ['Building plan approval pending for three months', 'Planning permission file not moving'] },
  ],
  'Health Services': [
    { urgency: 'medium', phrasings: ['Urban primary health centre has no doctor in the morning', 'UPHC closed during working hours, patients waiting'] },
    { urgency: 'medium', phrasings: ['No medicines available at the corporation dispensary', 'Health centre ran out of basic medicines'] },
    { urgency: 'low', phrasings: ['Need vaccination camp for children in our area', 'Immunisation for babies not happening at the health post'] },
    { urgency: 'medium', phrasings: ['Maternity ward at the corporation hospital is overcrowded', 'Pregnant women have to wait hours at the hospital'] },
  ],
  'Social Welfare': [
    { urgency: 'medium', phrasings: ['Homeless person needs shelter near the flyover', 'Elderly homeless man sleeping on the pavement, needs a night shelter'] },
    { urgency: 'low', phrasings: ['Need affordable housing, living in a rented hut', 'Want to apply for a house under a housing scheme'] },
    { urgency: 'low', phrasings: ['Old age pension not received for three months', 'Widow pension stopped without reason'] },
    { urgency: 'low', phrasings: ['Street vendor issue, vendors evicted without notice', 'Street vendors need a vending certificate and space'] },
    { urgency: 'low', phrasings: ['Want rooftop solar connection for my house', 'How to get solar panels installed on my roof with subsidy'] },
    { urgency: 'low', phrasings: ['Disabled person needs ramp at the corporation office', 'Wheelchair access missing at the ward office'] },
  ],
  'Pollution Control': [
    { urgency: 'medium', phrasings: ['Air pollution from burning waste every evening', 'People burning garbage and plastic, thick smoke in the area'] },
    { urgency: 'low', phrasings: ['Loud noise at night from a marriage hall', 'Loudspeakers blaring past midnight, cannot sleep'] },
    { urgency: 'medium', phrasings: ['Factory releasing black smoke into the residential area', 'Industrial unit emitting fumes, residents coughing'] },
    { urgency: 'low', phrasings: ['Construction dust everywhere from the site next door', 'Dust from road work causing breathing problems'] },
  ],
}

const WARD_FORMATS = ['Ward {w}', 'ward {w}', 'Ward No. {w}', 'ward no {w}', 'W-{w}', 'ward#{w}']
const OPENERS = ['', '', '', 'Sir, ', 'Respected sir, ', 'Pls sir ', 'Dear officer, ', 'hello ']
const CLOSERS = ['', '', '', ' Please take action.', ' Kindly do the needful.', ' very worst situation', ' pls help urgently', ' Nobody is responding.']
const STREETS = ['Anna Salai', 'Gandhi Street', '2nd Cross Street', 'Nehru Nagar', 'Kamarajar Road', 'Temple Street', 'Velachery Main Road', 'MGR Nagar 4th Street']

/** Introduces light typos for "poor writing quality" samples. */
export function typo(s: string, rand: () => number): string {
  return s
    .split(' ')
    .map((w) => (w.length > 4 && rand() < 0.15 ? w.slice(0, -2) + w.slice(-1) + w.slice(-2, -1) : w))
    .join(' ')
}

export interface Styled {
  text: string
  ward: number | null
}

export function styleComplaint(base: string, ward: number | null, rand: () => number): Styled {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  let s = base.replace('{n}', String(2 + Math.floor(rand() * 6)))
  const loc = ward === null ? ` near ${pick(STREETS)}` : ` in ${pick(WARD_FORMATS).replace('{w}', String(ward))}, ${pick(STREETS)}`
  s = `${pick(OPENERS)}${s}${loc}.${pick(CLOSERS)}`
  const r = rand()
  if (r < 0.2) s = s.toLowerCase().replace(/[.,]/g, '')
  else if (r < 0.35) s = typo(s, rand)
  else if (r < 0.42) s = s.toUpperCase()
  return { text: s.trim(), ward }
}
