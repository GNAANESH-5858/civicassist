// Greater Chennai Corporation service areas used for triage.
export const DEPARTMENTS = [
  'Water Supply & Sewerage',
  'Solid Waste Management',
  'Roads & Storm Water Drains',
  'Street Lighting',
  'Public Health & Sanitation',
  'Parks & Water Bodies',
  'Buildings & Town Planning',
  'Health Services',
  'Social Welfare',
  'Pollution Control',
] as const

export type Department = (typeof DEPARTMENTS)[number]
