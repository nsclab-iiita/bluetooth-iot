export const UPDATE_FORM = 'UPDATE_FORM';
export const CLEAR_FORM = 'CLEAR_FORM';

export const updateForm = (name, value) => ({
  type: UPDATE_FORM,
  payload: { name, value },
});

export const clearForm = () => ({
  type: CLEAR_FORM,
});
