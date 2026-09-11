import type { EngineConfig } from "@rotation/shared";
import { api } from "../api";
import { Btn, C, Field, Panel, iCls, iSty } from "../components/ui";

export function ConfigPage({ config, setConfig, onReset }: { config: EngineConfig; setConfig: (c: EngineConfig) => void; onReset: () => void }) {
  return (
    <Panel title="ENGINE CONFIG">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          ["Max frequency per window", "max_assignment_frequency"],
          ["Day headcount min", "min_staff_day"],
          ["Night headcount min", "min_staff_night"],
        ] as const).map(([l, k]) => (
          <Field key={k} label={l}>
            <input type="number" min={1} className={iCls} style={iSty} value={config[k]} onChange={async (e) => setConfig((await api.saveConfig({ [k]: +e.target.value })).config)} />
          </Field>
        ))}
      </div>
      <div className="mt-3 text-xs font-mono" style={{ color: C.sub }}>
        Rotation memory uses a calendar-month window (not a rolling 42-day lookback). Night shifts starting on the last day of a month stay attributed to that month.
      </div>
      <div className="mt-4">
        <Btn tone="red" onClick={onReset}>RESET ALL DATA</Btn>
      </div>
    </Panel>
  );
}
