import type { AppState, AppAction } from '../data/types';

export const initialState: AppState = {
  phase: 'intro',
  selectedCategory: null,
  selectedEvent: null,
  events: [],
  loading: false,
  error: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.payload };

    case 'SELECT_CATEGORY':
      return {
        ...state,
        selectedCategory: action.payload,
        selectedEvent: null,
        events: [],
        error: null,
        phase: 'category',
      };

    case 'SET_EVENTS':
      return { ...state, events: action.payload, loading: false };

    case 'SELECT_EVENT':
      return { ...state, selectedEvent: action.payload, phase: 'event' };

    case 'CLEAR_EVENT':
      return { ...state, selectedEvent: null, phase: 'category' };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };

    default:
      return state;
  }
}
