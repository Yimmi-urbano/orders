const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const validateDomain = require('../middlewares/validateDomain');

router.post('/', validateDomain, orderController.createOrder);
router.get('/list', orderController.getOrders);
router.put('/:orderId/payment-status', orderController.updatePaymentStatus);
router.put('/:orderId/order-status', orderController.updateOrderStatus);
router.get('/id/:orderNumber', orderController.getOrderByDomainAndOrderNumber);
router.get('/product/top-selling-product', orderController.getTopSellingProduct);
router.get('/sell/month', orderController.getDailySales);

module.exports = router;
