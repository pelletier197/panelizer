import { MATERIAL_COLORS } from '../../lib/materials'
import { useDesignStore } from '../../store/designStore'

/** Editor for the design's material list. A material is just a name and a
 *  colour; thickness is set per panel. */
export function MaterialsPanel() {
  const materials = useDesignStore((s) => s.materials)
  const addMaterial = useDesignStore((s) => s.addMaterial)
  const updateMaterial = useDesignStore((s) => s.updateMaterial)
  const removeMaterial = useDesignStore((s) => s.removeMaterial)

  return (
    <section className="sidebar__section materials">
      <div className="sidebar__header">
        <h2>Materials</h2>
        <button onClick={addMaterial}>+ Add</button>
      </div>

      {materials.map((m) => (
        <div className="material" key={m.id}>
          <div className="material__row">
            <input
              type="text"
              value={m.name}
              onChange={(e) => updateMaterial(m.id, { name: e.target.value })}
            />
            <button
              className="material__remove"
              aria-label="Remove material"
              disabled={materials.length === 1}
              onClick={() => removeMaterial(m.id)}
            >
              ✕
            </button>
          </div>

          <div className="color-swatches">
            {MATERIAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${m.color === c ? 'is-active' : ''}`}
                style={{ background: c }}
                aria-label={c}
                onClick={() => updateMaterial(m.id, { color: c })}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
