import { IconInfo } from './icons.tsx'

export default function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <div className="container">
        <IconInfo size={14} />
        <span>Demo with synthetic complaints. Not an official Greater Chennai Corporation service. Always verify schemes at their official source.</span>
      </div>
    </div>
  )
}
