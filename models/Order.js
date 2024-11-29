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
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    total: { type: Number },
    currency: { type: String },
    orderStatus: { type: String, enum: ['pending', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
    createdAt: { type: Date }  // Aquí solo dejamos el tipo de dato como Date
});

// Middleware para configurar la zona horaria de Lima (UTC-5) y generar orderNumber
orderSchema.pre('save', async function (next) {
    const order = this;

    if (order.isNew) {
        try {
            // Configura la zona horaria a 'America/Lima' (UTC -5)
            const now = moment.tz('America/Lima');  // Obtener la fecha y hora local en Lima

            // Asignar la fecha local a createdAt
            order.createdAt = now.utc().toDate();  // Aquí guardamos la fecha en el campo createdAt en formato UTC

            // Generar un timestamp en milisegundos (13 dígitos)
            const timestamp = now.valueOf();  // Timestamp en milisegundos
            const ksuidString = await ksuid.random();
            const randomPart = ksuidString.string.slice(0, 7);  // Tomamos los primeros 7 caracteres del KSUID

            // Generar el número de orden
            order.orderNumber = `${timestamp}${randomPart}`;

            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

module.exports = mongoose.model('Order', orderSchema);
