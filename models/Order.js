const mongoose = require('mongoose');
const ksuid = require('ksuid');
const moment = require('moment-timezone');

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true },
    domain: { type: String, required: true },
    products: [],
    clientInfo: {},
    billingInfo: {},
    shippingInfo: {},
    paymentStatus: {
        type: {
            typeStatus: { type: String, enum: ['pending', 'completed', 'failed', 'decline'], default: 'pending' },
            message: { type: String },
            data: { type: String },
            methodPayment: { type: String, enum: ['credit_card', 'yape', 'plin', 'transfer'] }
        },
        default: {}
    },
    total: { type: Number },
    currency: { type: String },
    orderStatus: {
        type: {
            typeStatus: { type: String, enum: ['pending', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
            message: { type: String },
            date: { type: String }
        },
        default: {}
    },
    createdAt: { type: String }
});

orderSchema.pre('save', async function (next) {
    const order = this;

    if (order.isNew) {
        try {
            const now = moment.tz('America/Lima');
            const timestamp = now.valueOf();
            const ksuidString = await ksuid.random();
            const randomPart = ksuidString.string.slice(0, 7);

            order.orderNumber = `${timestamp}${randomPart}`;
            order.createdAt = now.format('DD-MM-YYYY');

            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

module.exports = mongoose.model('Order', orderSchema);
