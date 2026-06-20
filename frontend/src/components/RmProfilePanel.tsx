import { useRmProfile } from "../lib/rmProfileStore";
import { GREETING_META, applyTokens } from "../lib/rmProfile";
import type { Greeting } from "../lib/rmProfile";
import { CHANNEL_META } from "../lib/commPrefs";
import type { CommChannel } from "../lib/commPrefs";
import type { Voice } from "../types";

export function RmProfilePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, update, setSignoff, reset } = useRmProfile();
  if (!open) return null;

  const greetings = Object.keys(GREETING_META) as Greeting[];
  const channels = Object.keys(CHANNEL_META) as CommChannel[];

  return (
    <div className="rmp-overlay" onClick={onClose}>
      <div className="rmp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rmp-head">
          <h2>Your RM profile</h2>
          <button className="rmp-x" onClick={onClose}>✕</button>
        </div>
        <p className="rmp-sub">How <b>you</b> communicate. These conventions shape every proposed message — layered on top of each client's chosen channel &amp; length.</p>

        <div className="rmp-grid">
          <label className="rmp-field"><span>Display name</span>
            <input value={profile.name} onChange={(e) => update({ name: e.target.value })} />
          </label>
          <label className="rmp-field"><span>Initials</span>
            <input value={profile.initials} onChange={(e) => update({ initials: e.target.value })} maxLength={4} />
          </label>
        </div>

        <div className="rmp-section">Greeting style</div>
        <div className="rmp-opts">
          {greetings.map((g) => (
            <button key={g} className={"rmp-opt" + (profile.greeting === g ? " on" : "")} onClick={() => update({ greeting: g })}>
              {GREETING_META[g].label}
              <span className="rmp-sample">{GREETING_META[g].sample.replace("{name}", "Schneider")}</span>
            </button>
          ))}
        </div>

        <div className="rmp-section">Default tone</div>
        <div className="rmp-opts">
          {(["values-led", "data-driven"] as Voice[]).map((vc) => (
            <button key={vc} className={"rmp-opt" + (profile.defaultVoice === vc ? " on" : "")} onClick={() => update({ defaultVoice: vc })}>
              {vc === "values-led" ? "Values-led" : "Data-driven"}
            </button>
          ))}
        </div>

        <div className="rmp-section">Sign-off &amp; close — per method <span className="rmp-hint">tokens: {"{name}"} · {"{initials}"}</span></div>
        {channels.map((ch) => (
          <label key={ch} className="rmp-signoff">
            <span className="rmp-ch">{CHANNEL_META[ch].label}</span>
            <input value={profile.signoff[ch]} onChange={(e) => setSignoff(ch, e.target.value)} />
            <span className="rmp-preview">{applyTokens(profile.signoff[ch], profile).replace(/\n/g, " ⏎ ")}</span>
          </label>
        ))}

        <div className="rmp-foot">
          <button className="rmp-reset" onClick={reset}>Reset to defaults</button>
          <button className="rmp-done" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
