const mongoose = require('mongoose');
const ksuid = require('ksuid');
const moment = require('moment-timezone');

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true },
    domain: { type: String, required: true },
    products: { type: [mongoose.Schema.Types.Mixed], default: [] },
    clientInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    billingInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    shippingInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    paymentStatus: {
        type: {
            typeStatus: { type: String, enum: ['pending', 'completed', 'failed', 'decline'], default: 'pending' },
            message: { type: String, default: '' },
            date: { type: Date, default: null },
            methodPayment: { type: String, enum: ['credit_card', 'yape', 'plin', 'transfer'], default: null }
        },
        default: {}
    },
    total: { type: Number, required: true },
    currency: { type: String, required: true },
    orderStatus: {
        type: {
            typeStatus: { type: String, enum: ['pending', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
            message: { type: String, default: '' },
            date: { type: String, default: '' }
        },
        default: {}
    }
}, { timestamps: true });

orderSchema.pre('save', async function (next) {
    if (!this.isNew) return next();

    try {
        const now = moment.tz('America/Lima').toDate();
        const ksuidString = await ksuid.random();
        const randomPart = ksuidString.string.slice(0, 7);

        this.orderNumber = `${Date.now()}${randomPart}`;
        this.createdAt = now;
        if (!this.paymentStatus.date) {
            this.paymentStatus.date = now;
        }
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Order', orderSchema);
