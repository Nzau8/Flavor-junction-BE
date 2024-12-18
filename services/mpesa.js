const axios = require('axios');
const config = require('../config/mpesa');

class MpesaService {
    constructor() {
        this.baseUrl = config.environment === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
    }

    async getAccessToken() {
        const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
        
        try {
            const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
                headers: {
                    Authorization: `Basic ${auth}`
                }
            });
            return response.data.access_token;
        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    }

    async initiateSTKPush(phoneNumber, amount, orderId) {
        const accessToken = await this.getAccessToken();
        const timestamp = this.getTimestamp();
        const password = this.generatePassword(timestamp);

        const requestBody = {
            BusinessShortCode: config.shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.ceil(amount),
            PartyA: this.formatPhoneNumber(phoneNumber),
            PartyB: config.shortcode,
            PhoneNumber: this.formatPhoneNumber(phoneNumber),
            CallBackURL: `${config.callbackUrl}/api/payments/callback`,
            AccountReference: `Order-${orderId}`,
            TransactionDesc: `Payment for Order ${orderId}`
        };

        try {
            const response = await axios.post(
                `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
                requestBody,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('STK Push error:', error.response?.data || error);
            throw error;
        }
    }

    generatePassword(timestamp) {
        const str = config.shortcode + config.passkey + timestamp;
        return Buffer.from(str).toString('base64');
    }

    getTimestamp() {
        const date = new Date();
        return date.getFullYear() +
            ('0' + (date.getMonth() + 1)).slice(-2) +
            ('0' + date.getDate()).slice(-2) +
            ('0' + date.getHours()).slice(-2) +
            ('0' + date.getMinutes()).slice(-2) +
            ('0' + date.getSeconds()).slice(-2);
    }

    formatPhoneNumber(phoneNumber) {
        // Remove any non-digit characters
        phoneNumber = phoneNumber.replace(/\D/g, '');
        
        // Remove leading 0 if present
        if (phoneNumber.startsWith('0')) {
            phoneNumber = phoneNumber.substring(1);
        }
        
        // Remove leading +254 if present
        if (phoneNumber.startsWith('254')) {
            phoneNumber = phoneNumber.substring(3);
        }
        
        // Add 254 prefix
        return '254' + phoneNumber;
    }
}

module.exports = new MpesaService(); 