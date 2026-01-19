const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const scanInstantSchema = new Schema({
    timestamp: {
        type: String,
        required: true
    },
    devices: {
        type: Schema.Types.Mixed,
        required: true
    }
});

const Scaninstant = mongoose.model('Scaninstant', scanInstantSchema);

module.exports = Scaninstant;
