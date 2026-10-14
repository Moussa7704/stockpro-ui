import { Spin } from 'antd'

export function FullPageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spin size="large" />
    </div>
  )
}
