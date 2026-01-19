import { createStore, combineReducers } from 'redux';
import formReducer from './reducer';
import { loadState, saveState } from './localstorage';

const preloadedState = loadState() || {}; 

const rootReducer = combineReducers({
  form: formReducer,
});

const store = createStore(
  rootReducer,
  { form: preloadedState.form } 
);

store.subscribe(() => {
  saveState(store.getState().form);
});

export default store;
