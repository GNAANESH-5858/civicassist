// Actionable next-step plan, tailored to the routing result. Each step is a message key with
// parameters; facts (channels, timelines) come from the knowledge base, never from a model.
import { categoryOf, type ComplaintFrame } from './frame.ts'
import type { Answers, Message, Routing } from './routing.ts'

export interface PlanStep extends Message {
  id: string
}

export function buildPlan(frame: ComplaintFrame, routing: Routing, answers: Answers = {}): PlanStep[] {
  const cat = categoryOf(frame)
  const steps: PlanStep[] = []
  if (routing.emergency.length) steps.push({ id: 'safety', key: 'plan.safety_first' })

  const premises = answers.public_private ?? frame.premises
  if (['water_supply', 'sewage', 'drainage_flooding', 'parks_trees'].includes(cat.id) && premises !== 'public') {
    steps.push({ id: 'premises', key: premises === 'private' ? 'plan.private_premises' : 'plan.confirm_premises' })
  }
  if (cat.id === 'roads' && answers.road_type !== 'residential') steps.push({ id: 'road', key: 'plan.confirm_road' })

  const missing: string[] = []
  if (!frame.locality && !frame.ward && !answers.location) missing.push('location')
  if (!frame.landmark && !answers.landmark) missing.push('landmark')
  if (!frame.duration && !answers.started) missing.push('started')
  const gatherKey = missing.length && cat.evidence.length ? 'plan.gather' : missing.length ? 'plan.gather_missing' : cat.evidence.length ? 'plan.gather_evidence' : 'plan.gather_generic'
  steps.push({ id: 'gather', key: gatherKey, params: { missing: missing.join(','), evidence: cat.evidence.join(',') } })

  if (routing.primary) {
    steps.push({ id: 'submit', key: 'plan.submit', params: { channel: routing.primary.id, authority: routing.authority.id } })
  } else {
    steps.push({ id: 'submit', key: 'plan.submit_no_channel', params: { authority: routing.authority.id } })
  }
  steps.push({ id: 'save', key: 'plan.save_reference' })
  steps.push({ id: 'follow_up', key: routing.escalation[0] ? 'plan.follow_up' : 'plan.follow_up_generic', params: { channel: routing.escalation[0]?.channel.id ?? '' } })
  steps.push({ id: 'timeline', key: 'plan.no_timeline' })
  if (routing.escalation.length > 1) steps.push({ id: 'escalate', key: 'plan.escalate', params: { channels: routing.escalation.slice(1).map((e) => e.channel.id).join(',') } })
  return steps
}
