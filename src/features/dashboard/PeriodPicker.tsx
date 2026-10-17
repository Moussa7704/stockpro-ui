import { DatePicker, Segmented } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { defaultSelection, type PeriodMode, type PeriodSelection } from './period'

const DAY = 'YYYY-MM-DD'
const MAX_RANGE_DAYS = 731 // deux ans, comme le serveur

const future = (date: Dayjs) => date.isAfter(dayjs(), 'day')

/** Choix de la période du tableau de bord ; jamais de date dans le futur. */
export function PeriodPicker({ value, onChange }: { value: PeriodSelection; onChange: (value: PeriodSelection) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented<PeriodMode>
        value={value.mode}
        onChange={(mode) => onChange(defaultSelection(mode))}
        options={[
          { value: 'today', label: 'Aujourd’hui' },
          { value: 'day', label: 'Jour' },
          { value: 'month', label: 'Mois' },
          { value: 'range', label: 'Période' },
        ]}
        aria-label="Période affichée"
      />
      {value.mode === 'day' && (
        <DatePicker
          value={dayjs(value.day)}
          onChange={(date) => date && onChange({ mode: 'day', day: date.format(DAY) })}
          format="DD/MM/YYYY"
          allowClear={false}
          disabledDate={future}
          aria-label="Date"
        />
      )}
      {value.mode === 'month' && (
        <DatePicker
          picker="month"
          value={dayjs(`${value.month}-01`)}
          onChange={(date) => date && onChange({ mode: 'month', month: date.format('YYYY-MM') })}
          format="MMMM YYYY"
          allowClear={false}
          disabledDate={(date) => date.isAfter(dayjs(), 'month')}
          aria-label="Mois"
        />
      )}
      {value.mode === 'range' && (
        <DatePicker.RangePicker
          value={[dayjs(value.from), dayjs(value.to)]}
          onChange={(range) => range?.[0] && range[1] && onChange({ mode: 'range', from: range[0].format(DAY), to: range[1].format(DAY) })}
          format="DD/MM/YYYY"
          allowClear={false}
          disabledDate={(date, { from }) => future(date) || (!!from && Math.abs(date.diff(from, 'day')) >= MAX_RANGE_DAYS)}
          aria-label="Période"
        />
      )}
    </div>
  )
}
