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
    createdAt: { type: String }
});

orderSchema.pre('save', async function (next) {
    const order = this;

    if (order.isNew) {
        try {
            // Configura la zona horaria a 'America/Lima' (UTC -5)
            const country = order.clientInfo.country || 'America/Lima';  
            const now = moment.tz(country); // Obtener la fecha local en la zona horaria correcta

            // Convertir la fecha local a UTC
            const utcDate = now.utc(); // Convertir a UTC

            // Asignar la fecha UTC al campo createdAt
            order.createdAt = utcDate.toDate(); // Este es el valor que se almacenará en MongoDB

            // Generar un timestamp en milisegundos (13 dígitos)
            const timestamp = utcDate.valueOf(); // Timestamp en milisegundos
            const ksuidString = await ksuid.random(); 
            const randomPart = ksuidString.string.slice(0, 7); // Los primeros 7 caracteres del KSUID

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
