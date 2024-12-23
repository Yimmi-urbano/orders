const Order = require('../models/Order');
const { handleError } = require('../utils/errorHandler');

exports.createOrder = async (req, res) => {
    try {
        const domain = req.headers['domain'];
        const { products, clientInfo, billingInfo, shippingInfo, currency, total } = req.body;

        const order = new Order({
            domain,
            products,
            clientInfo,
            billingInfo,
            shippingInfo,
            total,
            currency
        });

        const savedOrder = await order.save();
        res.status(201).json(savedOrder);
    } catch (error) {
        handleError(res, error);
    }
};

exports.getOrders = async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ status: false, message: 'El dominio es requerido' });
        }

        const { clientName, orderNumber, page = 1 } = req.query;

        const filter = { domain };

        if (clientName) {
            filter['clientInfo.name'] = { $regex: clientName, $options: 'i' };
        }
        if (orderNumber) {
            filter.orderNumber = orderNumber;
        }

        const limit = 20;
        const skip = (page - 1) * limit;

        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalRecords = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalRecords / limit);

        if (orders.length === 0) {
            return res.status(404).json({ status: false, message: 'No se encontraron registros' });
        }

        res.status(200).json({
            status: true,
            data: orders,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords
            }
        });
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
        const { typeStatus, message, data, methodPayment } = req.body;

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                paymentStatus: { typeStatus, message, data, methodPayment }
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Pedido no encontrado' });
        }
        res.status(200).json(updatedOrder);
    } catch (error) {
        handleError(res, error);
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { typeStatus, message, date } = req.body;

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                orderStatus: { typeStatus, message, date }
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Pedido no encontrado' });
        }
        res.status(200).json(updatedOrder);
    } catch (error) {
        handleError(res, error);
    }
};