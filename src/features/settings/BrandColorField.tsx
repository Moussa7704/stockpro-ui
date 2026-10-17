import { CheckOutlined } from '@ant-design/icons'
import { Button, ColorPicker, ConfigProvider, Input, Switch, Tag, Typography } from 'antd'
import { BRAND_PRESETS, DEFAULT_BRAND_COLOR, HEX_COLOR, isReadableBrandColor } from '../../lib/brand'

interface BrandColorFieldProps {
  /** #rrggbb, ou null pour la couleur StockPro (valeur du Form.Item) */
  value?: string | null
  onChange?: (value: string | null) => void
}

/**
 * Choix de la couleur de l'interface : une couleur proposée (toutes lisibles), ou un code libre
 * (#RRGGBB, ou via la palette), avec un aperçu des boutons et liens dans cette couleur.
 */
export function BrandColorField({ value = null, onChange }: BrandColorFieldProps) {
  const current = (value ?? DEFAULT_BRAND_COLOR).toLowerCase()
  // Aperçu : seulement une couleur valide et lisible, sinon la couleur StockPro
  const preview = isReadableBrandColor(current) ? current : DEFAULT_BRAND_COLOR

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Couleurs proposées" className="flex flex-wrap gap-2">
        {BRAND_PRESETS.map((preset) => {
          const selected = preset.color === current
          return (
            <button
              key={preset.color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={preset.name}
              title={preset.name}
              onClick={() => onChange?.(preset.color === DEFAULT_BRAND_COLOR ? null : preset.color)}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 text-white ${selected ? 'border-slate-900' : 'border-transparent'}`}
              style={{ background: preset.color }}
            >
              {selected && <CheckOutlined aria-hidden />}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ColorPicker
          value={HEX_COLOR.test(current) ? current : DEFAULT_BRAND_COLOR}
          disabledAlpha
          format="hex"
          onChangeComplete={(color) => onChange?.(color.toHexString().toLowerCase())}
          aria-label="Palette de couleurs"
        />
        <Input
          value={value ?? ''}
          placeholder={DEFAULT_BRAND_COLOR}
          onChange={(event) => onChange?.(event.target.value.trim() || null)}
          maxLength={7}
          className="w-32 font-mono"
          aria-label="Code couleur"
        />
        {value !== null && (
          <Button type="link" onClick={() => onChange?.(null)}>
            Rétablir la couleur StockPro
          </Button>
        )}
      </div>

      {/* Aperçu dans la couleur choisie, sans toucher au reste de la page avant l'enregistrement */}
      <ConfigProvider theme={{ token: { colorPrimary: preview } }}>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3" aria-label="Aperçu de la couleur">
          <Typography.Text type="secondary" className="text-xs">
            Aperçu :
          </Typography.Text>
          <Button type="primary">Bouton</Button>
          <Typography.Link>Lien</Typography.Link>
          <Switch defaultChecked size="small" aria-label="Interrupteur d’aperçu" />
          <Tag color={preview}>Étiquette</Tag>
          <span className="font-bold" style={{ color: preview }}>
            StockPro
          </span>
        </div>
      </ConfigProvider>
    </div>
  )
}
