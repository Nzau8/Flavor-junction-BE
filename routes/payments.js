const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const auth = require('../middleware/auth');
const mpesaService = require('../services/mpesa');

// Initiate payment
router.post('/initiate', auth, async (req, res) => {
    const { orderId, phoneNumber } = req.body;
    const userId = req.user.id;

    try {
        // Get order details
        db.get(
            'SELECT total_amount FROM orders WHERE id = ? AND user_id = ?',
            [orderId, userId],
            async (err, order) => {
                if (err) {
                    return res.status(500).json({ message: 'Error fetching order' });
                }
                if (!order) {
                    return res.status(404).json({ message: 'Order not found' });
                }

                try {
                    // Initiate STK Push
                    const response = await mpesaService.initiateSTKPush(
                        phoneNumber,
                        order.total_amount,
                        orderId
                    );

                    // Store payment request
                    db.run(
                        `INSERT INTO payment_requests (
                            order_id, 
                            checkout_request_id, 
                            merchant_request_id,
                            amount,
                            phone_number,
                            status
                        ) VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            orderId,
                            response.CheckoutRequestID,
                            response.MerchantRequestID,
                            order.total_amount,
                            phoneNumber,
                            'pending'
                        ],
                        (err) => {
                            if (err) {
                                console.error('Error storing payment request:', err);
                            }
                        }
                    );

                    res.json({
                        message: 'Payment initiated',
                        checkoutRequestId: response.CheckoutRequestID
                    });
                } catch (error) {
                    console.error('Payment initiation error:', error);
                    res.status(500).json({ message: 'Error initiating payment' });
                }
            }
        );
    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({ message: 'Error processing payment' });
    }
});

// M-Pesa callback URL
router.post('/callback', async (req, res) => {
    const { Body } = req.body;

    try {
        if (Body.stkCallback.ResultCode === 0) {
            // Payment successful
            const checkoutRequestId = Body.stkCallback.CheckoutRequestID;
            const amount = Body.stkCallback.CallbackMetadata.Item.find(item => item.Name === 'Amount').Value;
            const mpesaReceiptNumber = Body.stkCallback.CallbackMetadata.Item.find(item => item.Name === 'MpesaReceiptNumber').Value;

            // Update payment request and order
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Update payment request
                db.run(
                    `UPDATE payment_requests 
                    SET status = ?, mpesa_receipt = ? 
                    WHERE checkout_request_id = ?`,
                    ['completed', mpesaReceiptNumber, checkoutRequestId],
                    (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('Error updating payment request:', err);
                            return;
                        }

                        // Get order ID
                        db.get(
                            'SELECT order_id FROM payment_requests WHERE checkout_request_id = ?',
                            [checkoutRequestId],
                            (err, result) => {
                                if (err || !result) {
                                    db.run('ROLLBACK');
                                    console.error('Error fetching order ID:', err);
                                    return;
                                }

                                // Update order status
                                db.run(
                                    'UPDATE orders SET status = ?, payment_id = ? WHERE id = ?',
                                    ['paid', mpesaReceiptNumber, result.order_id],
                                    (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            console.error('Error updating order:', err);
                                            return;
                                        }

                                        db.run('COMMIT');
                                    }
                                );
                            }
                        );
                    }
                );
            });
        } else {
            // Payment failed
            const checkoutRequestId = Body.stkCallback.CheckoutRequestID;
            db.run(
                'UPDATE payment_requests SET status = ? WHERE checkout_request_id = ?',
                ['failed', checkoutRequestId]
            );
        }

        res.json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (error) {
        console.error('Callback processing error:', error);
        res.status(500).json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
    }
});

// Check payment status
router.get('/status/:checkoutRequestId', auth, (req, res) => {
    const { checkoutRequestId } = req.params;
    const userId = req.user.id;

    db.get(
        `SELECT pr.*, o.user_id 
        FROM payment_requests pr
        JOIN orders o ON pr.order_id = o.id
        WHERE pr.checkout_request_id = ? AND o.user_id = ?`,
        [checkoutRequestId, userId],
        (err, payment) => {
            if (err) {
                return res.status(500).json({ message: 'Error checking payment status' });
            }
            if (!payment) {
                return res.status(404).json({ message: 'Payment not found' });
            }
            res.json(payment);
        }
    );
});

module.exports = router; 