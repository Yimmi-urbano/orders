// controllers/orderController.js

const Order = require('../models/Order');
const { handleError } = require('../utils/errorHandler');

exports.createOrder = async (req, res) => {
    try {
        const domain = req.headers['domain'];
        const { products, clientInfo, billingInfo, shippingInfo,currency,total } = req.body;

        const order = new Order({
            domain,
            products,
            clientInfo,
            billingInfo,
            shippingInfo,
            total,
            currency,
            paymentStatus: 'pending',
            orderStatus: 'pending'
        });
        
        const savedOrder = await order.save();
        res.status(201).json(savedOrder);
    } catch (error) {
        handleError(res, error);
    }
};

exports.getOrdersByDomain = async (req, res) => {
    try {
        const domain = req.headers['domain'];
        const orders = await Order.find({ domain });
        res.status(200).json(orders);
    } catch (error) {
        handleError(res, error);
    }
};

exports.getOrderByDomainAndOrderNumber = async (req, res) => {
    try {
        const domain = req.headers['domain'];
        const { orderNumber } = req.params;

        if (!domain || !orderNumber) {
            return res.status(400).json({ status: false, message: 'Faltan parámetros necesarios' });
        }

        const order = await Order.findOne({ domain, orderNumber });
        if (!order) {
            return res.status(404).json({ status: false, message: 'Pedido no encontrado' });
        }
        res.status(200).json(order);
    } catch (error) {
        console.error('Error al obtener el pedido:', error);
        handleError(res, error);
    }
};



exports.updatePaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { paymentStatus } = req.body;
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { paymentStatus },
            { new: true }
        );
        if (!updatedOrder) return res.status(404).json({ message: 'Pedido no encontrado' });
        res.status(200).json(updatedOrder);
    } catch (error) {
        handleError(res, error);
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { orderStatus } = req.body;
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { orderStatus },
            { new: true }
        );
        if (!updatedOrder) return res.status(404).json({ message: 'Pedido no encontrado' });
        res.status(200).json(updatedOrder);
    } catch (error) {
        handleError(res, error);
    }
};
