import { UPDATE_FORM, CLEAR_FORM } from './actions';

const formState = {
  BDAddress: '',
  Devicedetails: {
    Devicename: '',
    LMPversion: '',
    OUIcompany: '',
    Manufacturer: '',
    Modalias: '',
    Class: '',
    Icon: '',
    RSSI: '',
    BatteryPercentage: '',
    UUID: []
  },
  DosAttack: '',
  MACSpoofing: '',
  OperatingSys: '',
  OsVersion: '',
  Encryption: ''
};

const formReducer = (state = formState, action) => {
  switch (action.type) {
    case UPDATE_FORM:
      const { name, value } = action.payload;
      const keys = name.split('.'); 

      if (keys.length === 1) {
        return {
          ...state,
          [name]: value,
        };
      }

      if (keys.length === 2) {
        return {
          ...state,
          [keys[0]]: {
            ...state[keys[0]],
            [keys[1]]: value,
          },
        };
      }

      if (keys.length === 3) {
        return {
          ...state,
          [keys[0]]: {
            ...state[keys[0]],
            [keys[1]]: {
              ...state[keys[1]],
              [keys[2]]: value,
            },
          },
        };
      }

      return state;

    case CLEAR_FORM:
      return formState;

    default:
      return state;
  }
};

export default formReducer;
