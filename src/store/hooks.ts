import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './index'

// Hooks typés : à utiliser partout à la place de useDispatch / useSelector
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
