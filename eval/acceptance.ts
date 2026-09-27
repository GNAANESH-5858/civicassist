// The fifteen acceptance complaints from page 35 of the knowledge-base PDF,
// with the department and scheme ids we expect them to route to.
export const ACCEPTANCE: { text: string; department: string; schemes: number[] }[] = [
  { text: 'no water supply for three days', department: 'Water Supply & Sewerage', schemes: [1, 84, 139] },
  { text: 'sewer overflowing onto the street', department: 'Water Supply & Sewerage', schemes: [84, 133, 138] },
  { text: 'garbage not collected', department: 'Solid Waste Management', schemes: [2, 86, 137] },
  { text: 'pothole on the main road', department: 'Roads & Storm Water Drains', schemes: [] },
  { text: 'broken streetlight', department: 'Street Lighting', schemes: [41] },
  { text: 'flooding and waterlogging', department: 'Roads & Storm Water Drains', schemes: [142] },
  { text: 'stray dogs menace', department: 'Public Health & Sanitation', schemes: [] },
  { text: 'illegal construction next door', department: 'Buildings & Town Planning', schemes: [] },
  { text: 'air pollution from burning waste', department: 'Pollution Control', schemes: [10] },
  { text: 'loud noise at night', department: 'Pollution Control', schemes: [93] },
  { text: 'street vendor issue', department: 'Social Welfare', schemes: [5, 100] },
  { text: 'homeless person needs shelter', department: 'Social Welfare', schemes: [123] },
  { text: 'park / water body neglected', department: 'Parks & Water Bodies', schemes: [23, 24] },
  { text: 'need affordable housing', department: 'Social Welfare', schemes: [3, 130] },
  { text: 'want rooftop solar connection', department: 'Social Welfare', schemes: [36, 37] },
]
